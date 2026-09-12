"""Intron Sahara v2.5, in BOTH configurations.

Corrections OFF is the primary column AND the configuration the product ships. Corrections ON is
reported separately to quantify what the undisclosed post-processor contributes — most teams will
benchmark the API default and not notice they are measuring an ASR model plus a hidden LLM.

Response shape CONFIRMED against the live API on 12 Sep 2026, not inferred from the docs:

    {"data": {"audio_file_name": ..., "audio_transcript": ..., "file_id": ...,
              "processed_audio_duration_in_seconds": ..., "processing_status": ...},
     "message": "file status found", "status": "Ok"}

Note `processing_status` came back as "FILE_QUEUED" on a response that already contained a
complete transcript. It is not a completion signal; do not gate on it.

Rate limits from the docs: sync 30/min. The caller paces.
"""
from __future__ import annotations

import os
import time

import numpy as np

from .base import ASRError, TranscribeResult, to_wav_bytes

BASE = os.environ.get("SAHARA_BASE_URL", "https://infer.voice.intron.io")


def _extract_text(payload) -> str | None:
    if isinstance(payload, str):
        return payload
    if not isinstance(payload, dict):
        return None
    for key in ("audio_transcript", "transcript", "transcription", "text", "hypothesis"):
        value = payload.get(key)
        if isinstance(value, str):
            return value
    for key in ("data", "result", "response", "payload"):
        nested = payload.get(key)
        if isinstance(nested, dict):
            found = _extract_text(nested)
            if found is not None:
                return found
    return None


def _classify(status: int, body: str) -> str:
    upper = body.upper()
    if "QUOTA_EXCEEDED" in upper or "INSUFFICIENT_CREDIT" in upper:
        return "quota"
    if "INSUFFICIENT_AUDIO_ACTIVITY" in upper:
        return "insufficient_audio"
    if status in (401, 403):
        return "auth"
    if status == 429:
        return "rate_limit"
    if status >= 500:
        return "server"
    return "unknown"


class SaharaAdapter:
    def __init__(self, disable_llm_corrections: bool = True, api_key: str | None = None) -> None:
        self.api_key = api_key or os.environ.get("SAHARA_API_KEY", "")
        if not self.api_key:
            raise ASRError("auth", "SAHARA_API_KEY is not set.", "sahara-v2.5")
        self.disable_corrections = disable_llm_corrections
        suffix = "off" if disable_llm_corrections else "on"
        self.name = "sahara-v2.5-corr-" + suffix

    def transcribe(self, audio: np.ndarray, sampling_rate: int, lang: str = "sw") -> TranscribeResult:
        import httpx

        wav = to_wav_bytes(audio, sampling_rate)
        started = time.perf_counter()
        try:
            response = httpx.post(
                BASE + "/file/v1/upload/sync",
                headers={"Authorization": "Bearer " + self.api_key},
                files={"audio_file_blob": ("turn.wav", wav, "audio/wav")},
                data={
                    "audio_file_name": "turn.wav",
                    "use_language_asr_input": lang,
                    "use_disable_llm_corrections": "TRUE" if self.disable_corrections else "FALSE",
                },
                timeout=240.0,
            )
        except Exception as exc:  # noqa: BLE001
            raise ASRError("network", "Could not reach Sahara: " + str(exc), self.name) from exc

        latency_ms = int((time.perf_counter() - started) * 1000)
        body = response.text
        try:
            payload = response.json()
        except Exception:  # noqa: BLE001
            payload = body

        if response.status_code != 200:
            retry_after = response.headers.get("retry-after")
            raise ASRError(
                _classify(response.status_code, body),
                "Sahara " + str(response.status_code) + ": " + body[:300],
                self.name,
                status=response.status_code,
                retry_after_ms=int(float(retry_after) * 1000) if retry_after else None,
            )

        text = _extract_text(payload)
        if text is None:
            keys = list(payload) if isinstance(payload, dict) else type(payload).__name__
            raise ASRError(
                "unknown",
                "Sahara returned 200 with no recognisable transcript field. Keys: " + str(keys),
                self.name,
            )

        reported = None
        if isinstance(payload, dict):
            data = payload.get("data")
            if isinstance(data, dict):
                reported = data.get("processed_audio_duration_in_seconds")

        return TranscribeResult(
            text=text,  # returned unmodified, per the contract
            latency_ms=latency_ms,
            meta={"model": self.name, "reported_duration_s": reported},
        )

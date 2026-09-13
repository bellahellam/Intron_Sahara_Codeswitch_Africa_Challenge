"""ElevenLabs Scribe v2 adapter.

Language code: "swa" (ISO 639-2/T for Swahili). Note this differs from Sahara's "sw" (BCP-47).

No benchmarking restriction found in ElevenLabs Terms of Service as of September 2026 —
unlike Deepgram (#9) and AssemblyAI, which are explicitly excluded (spec §18.3).

Pricing: ~$0.22/hr. At 1.54 h for AfriSwitchCare Swahili that is ~$0.34 per run — negligible.

API docs: https://elevenlabs.io/docs/api-reference/speech-to-text/convert
"""
from __future__ import annotations

import os
import time

import numpy as np

from .base import ASRError, TranscribeResult, to_wav_bytes

_BASE = "https://api.elevenlabs.io/v1/speech-to-text"


class ElevenLabsAdapter:
    name = "elevenlabs-scribe-v2"

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.environ.get("ELEVENLABS_API_KEY", "")
        if not self.api_key:
            raise ASRError("auth", "ELEVENLABS_API_KEY is not set.", self.name)

    def transcribe(self, audio: np.ndarray, sampling_rate: int, lang: str = "sw") -> TranscribeResult:
        import httpx

        # ElevenLabs uses ISO 639-2/T codes — "swa" for Swahili, not "sw"
        el_lang = "swa" if lang in ("sw", "swa") else lang

        wav = to_wav_bytes(audio, sampling_rate)
        started = time.perf_counter()

        try:
            response = httpx.post(
                _BASE,
                headers={"xi-api-key": self.api_key},
                files={"file": ("audio.wav", wav, "audio/wav")},
                data={
                    "model_id": "scribe_v2",
                    "language_code": el_lang,
                    # tag_audio_events=false keeps the output as plain transcript text
                    "tag_audio_events": "false",
                },
                timeout=180.0,
            )
        except Exception as exc:
            raise ASRError("network", f"Could not reach ElevenLabs: {exc}", self.name) from exc

        latency_ms = int((time.perf_counter() - started) * 1000)

        if response.status_code == 401:
            raise ASRError("auth", "ElevenLabs 401 — check ELEVENLABS_API_KEY.", self.name, status=401)
        if response.status_code == 422:
            raise ASRError("bad_request", f"ElevenLabs 422: {response.text[:300]}", self.name, status=422)
        if response.status_code == 429:
            retry_after = response.headers.get("retry-after")
            raise ASRError(
                "rate_limit", "ElevenLabs 429 — rate limited.", self.name,
                status=429,
                retry_after_ms=int(float(retry_after) * 1000) if retry_after else 60_000,
            )
        if response.status_code != 200:
            raise ASRError(
                "server", f"ElevenLabs {response.status_code}: {response.text[:300]}",
                self.name, status=response.status_code,
            )

        try:
            payload = response.json()
        except Exception as exc:
            raise ASRError("parse", f"ElevenLabs non-JSON response: {response.text[:200]}", self.name) from exc

        # Response shape: {"text": "...", "words": [...], "language_code": "swa", ...}
        text = payload.get("text", "")
        if not isinstance(text, str):
            raise ASRError("parse", f"ElevenLabs 'text' field is not a string: {type(text)}", self.name)

        return TranscribeResult(
            text=text,
            latency_ms=latency_ms,
            meta={
                "model": self.name,
                "language_code": payload.get("language_code"),
                "word_count": len(payload.get("words", [])),
            },
        )

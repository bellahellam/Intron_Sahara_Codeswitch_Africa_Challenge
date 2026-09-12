"""Jacaranda-Health/ASR-STT — the regional incumbent, and the most product-relevant comparator
that exists.

Why this row matters more than the Whisper rows: it was built by the organisation that actually
runs maternal-health messaging for roughly 3 million Kenyan mothers. It is whisper-medium
fine-tuned bilingual Swahili+English, CC-BY-SA-4.0, self-reporting WER 0.147 with a claimed
code-switch strength.

**If Sahara does not beat the regional incumbent on our task, that is a finding worth publishing.**
A benchmark that only compares the mandated model against generic global baselines is a benchmark
arranged to produce a flattering answer.

⚠️ Their reported 0.147 is on THEIR evaluation data, not ours. It is not comparable to the number
this harness produces and must not be quoted alongside it as though it were.

VRAM: whisper-medium is roughly 3 GB in fp16, which fits the 4.3 GB card here. If it OOMs, the
adapter says so rather than silently falling back to CPU and taking an hour per conversation.
"""
from __future__ import annotations

import time

import numpy as np

from .base import ASRError, TranscribeResult

MODEL_ID = "Jacaranda-Health/ASR-STT"


class JacarandaAdapter:
    def __init__(self) -> None:
        # Hyphens only — Intron's harness splits result filenames on "_".
        self.name = "jacaranda-asr-stt"
        self._pipe = None

    def _load(self):
        if self._pipe is not None:
            return self._pipe
        try:
            import torch
            from transformers import pipeline
        except ImportError as exc:
            raise ASRError(
                "unavailable",
                "transformers and torch are required for the Jacaranda row. "
                "`pip install transformers torch`, or run without it.",
                self.name,
            ) from exc

        use_cuda = torch.cuda.is_available()
        try:
            self._pipe = pipeline(
                "automatic-speech-recognition",
                model=MODEL_ID,
                device=0 if use_cuda else -1,
                torch_dtype=torch.float16 if use_cuda else torch.float32,
                chunk_length_s=30,
            )
        except Exception as exc:  # noqa: BLE001
            raise ASRError(
                "unavailable",
                f"Could not load {MODEL_ID}: {exc}. If this is a VRAM error, free the GPU or "
                f"run this row on its own.",
                self.name,
            ) from exc

        print(f"    loaded {MODEL_ID} on {'cuda' if use_cuda else 'cpu'}")
        return self._pipe

    def transcribe(self, audio: np.ndarray, sampling_rate: int, lang: str = "sw") -> TranscribeResult:
        pipe = self._load()
        if sampling_rate != 16_000:
            raise ASRError("unsupported_media", f"Expected 16 kHz, got {sampling_rate}.", self.name)

        started = time.perf_counter()
        out = pipe({"array": audio.astype("float32"), "sampling_rate": sampling_rate})
        text = (out.get("text") if isinstance(out, dict) else str(out)).strip()

        return TranscribeResult(
            text=text,  # returned unmodified, per the contract
            latency_ms=int((time.perf_counter() - started) * 1000),
            meta={"model": self.name, "hf_model_id": MODEL_ID},
        )

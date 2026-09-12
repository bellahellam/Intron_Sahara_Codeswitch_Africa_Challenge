"""Jacaranda-Health/ASR-STT — the regional incumbent, and the most product-relevant comparator
that exists.

Why this row matters more than the Whisper rows: it was built by the organisation that actually
runs maternal-health messaging for roughly 3 million Kenyan mothers. It is whisper-medium
fine-tuned bilingual Swahili+English, CC-BY-SA-4.0, self-reporting WER 0.147 with a claimed
code-switch strength.

**If Sahara does not beat the regional incumbent on our task, that is a finding worth publishing.**
A benchmark that only compares the mandated model against generic global baselines is arranged to
produce a flattering answer.

⚠️ Their reported 0.147 is on THEIR evaluation data, not ours. It is not comparable to the number
this harness produces and must not be quoted alongside it as though it were.

TWO ENVIRONMENT PROBLEMS THIS ADAPTER ROUTES AROUND, both hit on a real machine:

  1. transformers refuses to load with Keras 3 present. `pip install tf-keras` fixes it, and the
     error message here says so rather than leaving the next person to guess.
  2. The `pipeline()` helper pulls in `torchcodec` for audio handling, whose DLL does not load in
     every Windows/Anaconda install. So this calls the processor and model DIRECTLY. We already
     hold decoded float32 arrays — there is nothing for an audio loader to do.

Because it bypasses the pipeline, the 30 s windowing Whisper needs is done here explicitly. The
UPSTREAM chunking (75 s, shared identically across every model) is untouched; this is a second,
model-specific subdivision that exists only because Whisper's encoder is fixed at 30 s.
"""
from __future__ import annotations

import time

import numpy as np

from .base import ASRError, TranscribeResult

MODEL_ID = "Jacaranda-Health/ASR-STT"

# Whisper's encoder is fixed at 30 s. Anything longer is silently truncated, which would read as
# catastrophic deletion and libel the model.
WHISPER_WINDOW_S = 30


class JacarandaAdapter:
    def __init__(self) -> None:
        # Hyphens only — Intron's harness splits result filenames on "_".
        self.name = "jacaranda-asr-stt"
        self._model = None
        self._processor = None
        self._device = "cpu"

    def _load(self):
        if self._model is not None:
            return self._model, self._processor
        try:
            import torch
            from transformers import WhisperForConditionalGeneration, WhisperProcessor
        except ImportError as exc:
            raise ASRError(
                "unavailable",
                "transformers and torch are required for the Jacaranda row. "
                "`pip install transformers torch`, or run without it.",
                self.name,
            ) from exc

        try:
            self._processor = WhisperProcessor.from_pretrained(MODEL_ID)
            model = WhisperForConditionalGeneration.from_pretrained(MODEL_ID)
        except Exception as exc:  # noqa: BLE001
            hint = ""
            if "Keras" in str(exc):
                hint = " Fix: `pip install tf-keras` (transformers cannot load alongside Keras 3)."
            raise ASRError(
                "unavailable",
                f"Could not load {MODEL_ID}: {str(exc)[:200]}.{hint}",
                self.name,
            ) from exc

        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(self._device)
        if self._device == "cuda":
            model = model.half()
        model.eval()
        self._model = model
        print(f"    loaded {MODEL_ID} on {self._device}")
        return self._model, self._processor

    def transcribe(self, audio: np.ndarray, sampling_rate: int, lang: str = "sw") -> TranscribeResult:
        import torch

        model, processor = self._load()
        if sampling_rate != 16_000:
            raise ASRError("unsupported_media", f"Expected 16 kHz, got {sampling_rate}.", self.name)

        audio = audio.astype("float32")
        window = WHISPER_WINDOW_S * sampling_rate
        started = time.perf_counter()
        pieces: list[str] = []

        for start in range(0, len(audio), window):
            segment = audio[start : start + window]
            # A sliver of trailing audio carries no speech worth a forward pass.
            if len(segment) < sampling_rate:
                continue
            features = processor(segment, sampling_rate=sampling_rate, return_tensors="pt").input_features
            features = features.to(self._device)
            if self._device == "cuda":
                features = features.half()
            with torch.no_grad():
                ids = model.generate(
                    features,
                    max_new_tokens=440,
                    # BEAM SEARCH IS NOT A TUNING CHOICE HERE, IT IS A FAIRNESS ONE.
                    #
                    # Greedy decoding sends this model into a degenerate repetition loop — the
                    # first real run produced "Ni kwa kwa kwa kwa kwa..." for a whole 30 s window.
                    # Reporting a WER from that would have been a false finding about Jacaranda
                    # rather than a true one about code-switched Swahili.
                    #
                    # And the Whisper rows already get beam search: faster-whisper is called with
                    # beam_size=5. Running the incumbent greedily while the baseline gets beams
                    # would have handed Sahara a win it had not earned.
                    num_beams=4,
                    no_repeat_ngram_size=3,
                )
            pieces.append(processor.batch_decode(ids, skip_special_tokens=True)[0].strip())

        return TranscribeResult(
            text=" ".join(p for p in pieces if p).strip(),  # unmodified, per the contract
            latency_ms=int((time.perf_counter() - started) * 1000),
            meta={"model": self.name, "hf_model_id": MODEL_ID, "device": self._device},
        )

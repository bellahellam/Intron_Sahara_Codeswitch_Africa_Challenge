"""OpenAI Whisper — the world's default multilingual baseline, and what most teams will reach for.

RUN IT IN BOTH CONDITIONS. This is not padding: forcing `language="sw"` versus letting Whisper
auto-detect is the experiment. If the auto condition collapses a code-switched utterance into one
language, that is our thesis demonstrated on the most widely used ASR model there is. A single
forced-language row would hide exactly the finding worth reporting.

Two backends, because neither is guaranteed to be present:

  faster-whisper (CTranslate2)  preferred — int8 quantisation makes large-v3 fit in ~3 GB
  transformers                  fallback — always available here, heavier in VRAM

⚠️ VRAM is the binding constraint on this machine (RTX 2050, 4.3 GB). large-v3 in fp16 needs about
10 GB and will NOT fit; int8 via faster-whisper is roughly 3 GB and should. If it OOMs, drop to
`whisper-sw:medium` or `whisper-sw:small` and SAY SO in the report — a smaller Whisper honestly
labelled is a valid comparator, and a silently substituted one is not.
"""
from __future__ import annotations

import time

import numpy as np

from .base import ASRError, TranscribeResult


def _pick_device() -> tuple[str, str]:
    """Returns (device, compute_type) for faster-whisper."""
    try:
        import torch

        if torch.cuda.is_available():
            free_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
            # int8_float16 keeps weights small enough for a 4 GB card while preserving accuracy
            # better than plain int8.
            return "cuda", "int8_float16" if free_gb < 6 else "float16"
    except ImportError:
        pass
    return "cpu", "int8"


class WhisperAdapter:
    def __init__(self, model_size: str = "large-v3", force_language: bool = True) -> None:
        self.force_language = force_language
        self.model_size = model_size
        # Hyphens only: an underscore in a model id silently breaks Intron's evaluation harness,
        # which parses result filenames as file.split("_") with model = parts[0].
        condition = "sw" if force_language else "auto"
        self.name = f"whisper-{model_size}-{condition}"
        self._model = None
        self._backend = None

    def _load(self):
        if self._model is not None:
            return self._model

        device, compute_type = _pick_device()

        try:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(self.model_size, device=device, compute_type=compute_type)
            self._backend = "faster-whisper"
            print(f"    loaded {self.model_size} via faster-whisper on {device} ({compute_type})")
            return self._model
        except ImportError:
            pass
        except Exception as exc:  # noqa: BLE001
            raise ASRError(
                "unavailable",
                f"faster-whisper could not load {self.model_size} on {device}: {exc}. "
                f"If this is a VRAM error, try --models whisper-sw:medium or whisper-sw:small.",
                self.name,
            ) from exc

        try:
            import torch
            from transformers import pipeline

            self._model = pipeline(
                "automatic-speech-recognition",
                model=f"openai/whisper-{self.model_size}",
                device=0 if device == "cuda" else -1,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                chunk_length_s=30,
            )
            self._backend = "transformers"
            print(f"    loaded {self.model_size} via transformers on {device}")
            return self._model
        except ImportError as exc:
            raise ASRError(
                "unavailable",
                "Neither faster-whisper nor transformers is installed. "
                "`pip install faster-whisper` to include the Whisper rows, "
                "or run with --models sahara-off,sahara-on only.",
                self.name,
            ) from exc

    def transcribe(self, audio: np.ndarray, sampling_rate: int, lang: str = "sw") -> TranscribeResult:
        model = self._load()
        if sampling_rate != 16_000:
            raise ASRError("unsupported_media", f"Whisper expects 16 kHz, got {sampling_rate}.", self.name)

        audio = audio.astype("float32")
        started = time.perf_counter()

        if self._backend == "faster-whisper":
            segments, info = model.transcribe(
                audio,
                language="sw" if self.force_language else None,
                beam_size=5,
                # Chunking is done ONCE upstream and shared identically by every model. Letting
                # each adapter apply its own VAD would mean the models saw different audio.
                vad_filter=False,
            )
            text = " ".join(s.text.strip() for s in segments).strip()
            detected = getattr(info, "language", None)
        else:
            kwargs = {"generate_kwargs": {"language": "sw", "task": "transcribe"}} if self.force_language else {}
            out = model({"array": audio, "sampling_rate": sampling_rate}, **kwargs)
            text = (out.get("text") if isinstance(out, dict) else str(out)).strip()
            detected = None

        return TranscribeResult(
            text=text,  # returned unmodified, per the contract
            latency_ms=int((time.perf_counter() - started) * 1000),
            meta={
                "model": self.name,
                "backend": self._backend,
                # The whole point of the auto condition: what did it think the language was?
                "detected_language": detected,
            },
        )

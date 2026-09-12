from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Any, Protocol

import numpy as np


@dataclass
class TranscribeResult:
    text: str
    latency_ms: int
    meta: dict[str, Any] = field(default_factory=dict)


class ASRError(RuntimeError):
    """Errors RAISE. They never return an empty string.

    An empty `text` means "she said nothing". A failed call means "we do not know what she said".
    Conflating those two is how a screening record silently loses a turn, and in the benchmark it
    is how a model gets credited with a perfect deletion.
    """

    def __init__(
        self,
        kind: str,
        message: str,
        adapter: str,
        status: int | None = None,
        retry_after_ms: int | None = None,
    ) -> None:
        super().__init__(message)
        self.kind = kind
        self.adapter = adapter
        self.status = status
        self.retry_after_ms = retry_after_ms


class ASRAdapter(Protocol):
    name: str

    def transcribe(self, audio: np.ndarray, sampling_rate: int, lang: str = "sw") -> TranscribeResult:
        ...


def to_wav_bytes(audio: np.ndarray, sampling_rate: int) -> bytes:
    """16-bit PCM WAV.

    Used by every HTTP adapter so that all models receive byte-identical audio. If one model were
    sent a different encoding the comparison would be void.
    """
    import soundfile as sf

    buf = io.BytesIO()
    sf.write(buf, audio, sampling_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()

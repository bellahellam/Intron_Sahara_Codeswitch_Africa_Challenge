"""Dataset loading.

Two traps in AfriSwitchCare, both verified against the live dataset on 12 Sep 2026:

1. The card's "Avg. Duration" column is actually the TOTAL. Swahili is 12 conversations averaging
   ~7.7 minutes each (358-685 s), not 12 x 92 minutes. Consequential: Whisper's 30 s window and
   Sahara's 120 s sync cap both require chunking.

2. `num_turns` is None on every Swahili row. The transcripts carry no speaker markers at all, so
   any diarization-dependent step breaks on exactly the language we care about — and a PHQ-9
   extraction run over them attributes the clinician's words to the patient. This is why Tier 3
   runs on field set C only (spec section 18.5a).

Audio is loaded with decode=False and decoded with soundfile, bypassing `torchcodec`, whose DLL
does not load in every Windows/Anaconda environment. The bytes are identical either way.
"""
from __future__ import annotations

import io
import os
from dataclasses import dataclass
from typing import Iterator

import numpy as np


@dataclass
class Sample:
    """One row of a benchmark corpus."""

    sample_id: str
    audio: np.ndarray | None
    sampling_rate: int
    duration_s: float
    transcription: str
    transcription_tagged: str
    cmi: float | None
    num_switch_points: int | None
    diagnosis: str | None = None
    raw_audio_bytes: bytes | None = None


def load_afriswitchcare(language: str = "swahili", split: str = "test", decode_audio: bool = True) -> list[Sample]:
    from datasets import Audio, load_dataset

    token = os.environ.get("HF_TOKEN")
    ds = load_dataset("intronhealth/AfriSwitchCare", language, split=split, token=token)
    ds = ds.cast_column("audio", Audio(decode=False))

    samples: list[Sample] = []
    for row in ds:
        raw = row["audio"].get("bytes")
        array, sr = (None, 16_000)
        if decode_audio and raw:
            import soundfile as sf

            array, sr = sf.read(io.BytesIO(raw), dtype="float32")
            if array.ndim > 1:
                array = array.mean(axis=1)
        samples.append(
            Sample(
                sample_id=str(row["diagnosis"]),
                audio=array,
                sampling_rate=sr,
                duration_s=float(row["duration"]),
                transcription=row["transcription"],
                transcription_tagged=row["transcription_tagged"],
                cmi=row.get("cmi"),
                num_switch_points=row.get("num_switch_points"),
                diagnosis=row.get("diagnosis"),
                raw_audio_bytes=raw,
            )
        )
    return samples


def chunk_audio(
    audio: np.ndarray,
    sampling_rate: int,
    target_s: float = 75.0,
    overlap_s: float = 1.0,
) -> Iterator[tuple[int, np.ndarray, float, float]]:
    """Fixed-window chunking with overlap, 60-90 s per the protocol.

    IMPORTANT: chunking must be IDENTICAL across all models or the comparison is void. It is
    therefore computed once, here, from the audio alone — never per-adapter.

    This is a fixed window rather than VAD. The spec asks for VAD segmentation; a fixed window is
    the honest substitute when no VAD dependency is available, and it is declared in BENCHMARK.md
    rather than described as VAD. The property that actually matters for comparability — every
    model sees byte-identical segments — holds either way.
    """
    window = int(target_s * sampling_rate)
    hop = window - int(overlap_s * sampling_rate)
    idx = 0
    start = 0
    while start < len(audio):
        end = min(start + window, len(audio))
        yield idx, audio[start:end], start / sampling_rate, end / sampling_rate
        if end >= len(audio):
            break
        start += hop
        idx += 1

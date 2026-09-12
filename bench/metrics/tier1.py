"""Tier 1 — WER, CER, latency. Standard, for comparability with Intron's published numbers.

Computed under Intron's own normalisation (diacritics removed), declared as such.

CER is reported alongside WER and is arguably more informative here: Swahili is agglutinative, so
a single morpheme error destroys a whole token and WER punishes it as a full substitution.
"""
from __future__ import annotations

from bench.normalise import normalise_for_wer


def wer(reference: str, hypothesis: str) -> float:
    import jiwer

    ref, hyp = normalise_for_wer(reference), normalise_for_wer(hypothesis)
    if not ref:
        return float("nan")
    if not hyp:
        return 1.0
    return float(jiwer.wer(ref, hyp))


def cer(reference: str, hypothesis: str) -> float:
    import jiwer

    ref, hyp = normalise_for_wer(reference), normalise_for_wer(hypothesis)
    if not ref:
        return float("nan")
    if not hyp:
        return 1.0
    return float(jiwer.cer(ref, hyp))


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    import numpy as np

    return float(np.percentile(values, p))

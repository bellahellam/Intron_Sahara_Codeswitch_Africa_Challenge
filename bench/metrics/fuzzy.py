"""Fuzzy phrase matching, mirroring the product's own matcher.

The harness must score a phrase the same way the PRODUCT would recognise it, or CIR and SPR
measure the metric rather than the system. This is the Python twin of
lib/codeswitch/idiom.ts and lib/safety/scan.ts: per-token Levenshtein at >=0.85, diacritics
preserved, negation prefixes never stripped.
"""
from __future__ import annotations

from functools import lru_cache

from bench.normalise import normalise_preserving_diacritics, tokens


@lru_cache(maxsize=100_000)
def similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            curr.append(min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)))
        prev = curr
    return 1 - prev[len(b)] / max(len(a), len(b))


def phrase_present(phrase: str, text: str, ratio: float = 0.85) -> bool:
    """True when `phrase` appears in `text` as a contiguous fuzzy token run.

    Contiguous, unlike the safety scan's gapped matching: here we are asking "did the model
    preserve this phrase", and a phrase whose middle was deleted was NOT preserved. That is the
    thing being measured.
    """
    needle = tokens(normalise_preserving_diacritics(phrase))
    hay = tokens(normalise_preserving_diacritics(text))
    if not needle or len(needle) > len(hay):
        return False
    n = len(needle)
    for i in range(len(hay) - n + 1):
        if all(similarity(hay[i + k], needle[k]) >= ratio for k in range(n)):
            return True
    return False

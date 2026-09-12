"""Tier 2 — the code-switch metrics. This is the contribution.

Intron's own benchmarking repo is NOT a code-switching harness: its README lists under limitations
that "intra-utterance code-switching is present but inconsistently annotated across languages", and
it computes no CMI, no switch-point metric and no per-word LID. Every metric here is net-new and
must be implemented by us (spec section 18.7).

All of these run under the DIACRITIC-PRESERVING normalisation, deliberately (see bench/normalise).

    EESR            Embedded-English Span Recall. Directly measures switch-boundary deletion —
                    the failure aggregate WER structurally cannot see.
    EESR-clinical   EESR restricted to English spans containing an affective/clinical term. The
                    general number can look fine while this subset collapses, and THIS is the
                    number that determines whether the product works.
    CIR             Clinical Idiom Recall. The Kiswahili half of the same question.
    SPR             Safety-Phrase Recall. Reported as SEEN vs HELD-OUT, never merged.
    CMI-delta       Does the model preserve the STRUCTURE of switching, or flatten it?
"""
from __future__ import annotations

from dataclasses import dataclass

from bench.normalise import english_spans, normalise_preserving_diacritics, tokens

# Spec section 18.4. The affective vocabulary that rides in the embedded English, which is exactly
# what makes its deletion a clinical problem rather than a cosmetic one.
CLINICAL_EN_TERMS = {
    "stress", "stressed", "stressful",
    "depress", "depressed", "depressing", "depression",
    "anxious", "anxiety",
    "worry", "worried", "worrying",
    "overwhelm", "overwhelmed", "overwhelming",
    "tired", "tiredness", "exhausted",
    "sleep", "sleeping", "sleepless", "insomnia",
    "sad", "sadness", "unhappy",
    "alone", "lonely", "loneliness",
    "hopeless", "hopelessness",
    "low", "down", "mood",
    "cope", "coping",
    "cry", "crying",
}

# A span is "recalled" if its token sequence survives contiguously, or with >=80% in-order overlap.
SPAN_RECALL_OVERLAP = 0.8


def _contains_subsequence(haystack: list[str], needle: list[str]) -> bool:
    if not needle:
        return False
    n = len(needle)
    return any(haystack[i : i + n] == needle for i in range(len(haystack) - n + 1))


def _in_order_overlap(haystack: list[str], needle: list[str]) -> float:
    """Fraction of `needle` tokens found in `haystack` IN ORDER (not necessarily adjacent).

    In-order matters: deletion removes words from inside a span, it does not shuffle them. A bag
    of-words overlap would score a scrambled hypothesis as a success.
    """
    if not needle:
        return 0.0
    found = 0
    cursor = 0
    for token in needle:
        for i in range(cursor, len(haystack)):
            if haystack[i] == token:
                found += 1
                cursor = i + 1
                break
    return found / len(needle)


def span_recalled(span: str, hypothesis: str) -> bool:
    hyp_tokens = tokens(normalise_preserving_diacritics(hypothesis))
    span_tokens = tokens(normalise_preserving_diacritics(span))
    if not span_tokens:
        return False
    if _contains_subsequence(hyp_tokens, span_tokens):
        return True
    return _in_order_overlap(hyp_tokens, span_tokens) >= SPAN_RECALL_OVERLAP


def is_clinical_span(span: str) -> bool:
    span_tokens = set(tokens(normalise_preserving_diacritics(span)))
    if span_tokens & CLINICAL_EN_TERMS:
        return True
    # Catch inflected forms the set does not list explicitly (depress* -> depressive).
    return any(t.startswith(prefix) for t in span_tokens for prefix in ("depress", "overwhelm", "anxio", "worri"))


@dataclass
class EESRResult:
    total: int
    recalled: int
    clinical_total: int
    clinical_recalled: int
    missed_spans: list[str]
    missed_clinical_spans: list[str]

    @property
    def eesr(self) -> float | None:
        return self.recalled / self.total if self.total else None

    @property
    def eesr_clinical(self) -> float | None:
        return self.clinical_recalled / self.clinical_total if self.clinical_total else None


def eesr(tagged_reference: str, hypothesis: str) -> EESRResult:
    """Embedded-English Span Recall, computed from the corpus's own [[EN]] annotation."""
    spans = english_spans(tagged_reference)
    recalled = 0
    clinical_total = 0
    clinical_recalled = 0
    missed: list[str] = []
    missed_clinical: list[str] = []

    for span in spans:
        ok = span_recalled(span, hypothesis)
        clinical = is_clinical_span(span)
        if clinical:
            clinical_total += 1
        if ok:
            recalled += 1
            if clinical:
                clinical_recalled += 1
        else:
            missed.append(span)
            if clinical:
                missed_clinical.append(span)

    return EESRResult(
        total=len(spans),
        recalled=recalled,
        clinical_total=clinical_total,
        clinical_recalled=clinical_recalled,
        missed_spans=missed,
        missed_clinical_spans=missed_clinical,
    )


@dataclass
class LexiconRecallResult:
    total: int
    recalled: int
    missed: list[str]

    @property
    def recall(self) -> float | None:
        return self.recalled / self.total if self.total else None


def lexicon_recall(
    phrases: list[str],
    reference: str,
    hypothesis: str,
    ratio: float = 0.85,
) -> LexiconRecallResult:
    """Recall over a lexicon, scored ONLY on phrases actually present in the reference.

    Scoring a phrase the mother never said would measure the corpus, not the model. So the
    denominator is "entries present in the gold transcript", not "entries in the lexicon".
    """
    from bench.metrics.fuzzy import phrase_present

    present = [p for p in phrases if phrase_present(p, reference, ratio)]
    missed = [p for p in present if not phrase_present(p, hypothesis, ratio)]
    return LexiconRecallResult(total=len(present), recalled=len(present) - len(missed), missed=missed)


def cmi(text: str, english_token_set: set[str] | None = None) -> float | None:
    """Code-Mixing Index, Das & Gamback (2014) formulation, so our numbers are directly
    comparable to AfriSwitch's published `cmi` column.

        CMI = 100 * (1 - max(w_i) / (n - u))

    where max(w_i) is the token count of the dominant language, n is total tokens, and u is
    language-independent tokens. Returns None for a single-language or empty utterance.

    NOTE the honest limit: deriving CMI from a HYPOTHESIS requires language-tagging that
    hypothesis, and our LID is a heuristic (spec section 24.11 caps it deliberately). CMI-delta
    therefore carries unknown error and is reported as indicative, not as a headline.
    """
    from bench.metrics.lid import tag_tokens

    toks = tokens(normalise_preserving_diacritics(text))
    if not toks:
        return None
    tags = tag_tokens(toks, english_token_set)
    counts: dict[str, int] = {}
    for tag in tags:
        counts[tag] = counts.get(tag, 0) + 1
    n = len(toks)
    u = counts.get("unknown", 0)
    if n - u <= 0:
        return None
    dominant = max((c for t, c in counts.items() if t != "unknown"), default=0)
    if dominant == 0:
        return None
    return 100.0 * (1 - dominant / (n - u))

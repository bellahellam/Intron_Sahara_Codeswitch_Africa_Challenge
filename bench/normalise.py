"""Text normalisation, and two declared deviations from Intron's reference harness.

We follow Intron's `Intron-Multimodal-Benchmarking` conventions so our WER is comparable, with two
deviations stated openly (spec section 18.7).

**Their non-English path** is: EnglishNumberNormalizer -> Whisper BasicTextNormalizer with
`remove_diacritics=True` -> punctuation stripping, where `remove_diacritics = not is_english`.

**Deviation 1 — diacritics.** Their pipeline destroys diacritics for every African language. For
plain Swahili WER that is mostly harmless; for LEXICON MATCHING it is not, because it collapses
distinctions the idiom and safety matchers rely on. So: WER and CER are reported under their exact
normalisation for comparability, and EESR / CIR / SPR are computed under a diacritic-PRESERVING
normalisation. Both are stated wherever a number is reported.

**Deviation 2 — we do not report their "normalized vs unnormalized" split for non-English.** In
their harness both branches call the same `clean_multilingual_text()` for non-English languages,
so every non-English row is byte-identical between the two output files. Reporting both would be
reporting the same number twice.

Two further traps in that repo, if it is ever used directly:
  - Its results README documents a `prediction` column, but `evaluations.py` asserts
    `"hypothesis" in data.columns`. Use `hypothesis` or evaluation raises AssertionError.
  - `transcription_evals()` parses filenames as `file.split("_")` with `model = parts[0]`, so any
    model identifier containing an underscore silently breaks. Our model ids use hyphens only.
"""
from __future__ import annotations

import re
import unicodedata

_PUNCT = re.compile(r"[^\w\s]", flags=re.UNICODE)
_WS = re.compile(r"\s+")

# Latin letters carrying diacritics that matter in Kenyan Swahili orthography and in the
# transliterations found in these corpora.
_COMBINING = re.compile(r"[̀-ͯ]")


def _base(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = _PUNCT.sub(" ", text)
    return _WS.sub(" ", text).strip()


def normalise_for_wer(text: str) -> str:
    """Intron-compatible: lowercase, strip punctuation, REMOVE diacritics.

    Used for WER and CER only, so those numbers sit alongside Intron's published ones.
    """
    text = unicodedata.normalize("NFD", text)
    text = _COMBINING.sub("", text)
    return _base(text)


def normalise_preserving_diacritics(text: str) -> str:
    """Ours: identical except diacritics survive.

    Used for EESR, CIR and SPR, because those are lexicon-matching metrics and the reference
    pipeline's diacritic stripping collapses distinctions the matcher depends on.
    """
    return _base(text)


def tokens(text: str) -> list[str]:
    return text.split() if text else []


# ---------------------------------------------------------------------------------------------
# Embedded-English span extraction from `transcription_tagged`.
#
# AfriSwitch and AfriSwitchCare mark embedded English inline as [[EN]]...[[/EN]]. That means EESR
# is computable straight from the corpus's own annotation and requires NO new labelling — which is
# the whole reason the metric is affordable.
# ---------------------------------------------------------------------------------------------

_EN_SPAN = re.compile(r"\[\[EN\]\](.*?)\[\[/EN\]\]", flags=re.DOTALL)


def english_spans(tagged: str) -> list[str]:
    """Every [[EN]]...[[/EN]] span, in order, with the markers stripped."""
    return [s.strip() for s in _EN_SPAN.findall(tagged or "") if s.strip()]


def strip_tags(tagged: str) -> str:
    """The tagged transcript with its markers removed, for sanity-checking against `transcription`."""
    return _WS.sub(" ", re.sub(r"\[\[/?EN\]\]", " ", tagged or "")).strip()


def matrix_spans(tagged: str) -> list[str]:
    """The non-English (matrix language) segments between the English spans."""
    parts = _EN_SPAN.split(tagged or "")
    # re.split with one capture group alternates: matrix, english, matrix, english, ...
    return [p.strip() for i, p in enumerate(parts) if i % 2 == 0 and p.strip()]

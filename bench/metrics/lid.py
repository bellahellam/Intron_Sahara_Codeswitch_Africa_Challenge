"""Heuristic token-level language ID for the harness.

Same deliberate limitation as the product's (spec section 24.11): a wordlist plus character
shape, not a model. It exists so CMI can be estimated from a hypothesis at all. Because its error
is unknown, CMI-delta is reported as INDICATIVE and never as a headline number.
"""
from __future__ import annotations

EN_COMMON = {
    "the","a","an","and","or","but","so","because","if","when","then","that","this","these","those",
    "i","you","he","she","it","we","they","me","him","her","us","them","my","your","his","their","our",
    "is","am","are","was","were","be","been","being","have","has","had","do","does","did","can","could",
    "will","would","should","must","not","no","yes","very","just","really","only","also","too","now",
    "of","to","in","on","at","for","with","from","by","about","up","down","out","over","as","like",
    "what","which","who","how","why","where","there","here","some","any","all","more","most","other",
    "good","bad","fine","okay","ok","well","doctor","hospital","clinic","pain","stress","sleep","tired",
    "baby","mother","father","child","today","day","night","morning","time","week","month","year",
}

SW_MARKERS = ("ny", "ng'", "mb", "nd", "nj", "mw", "kw", "sh", "ch")
SW_PREFIXES = ("nime", "aname", "tume", "wame", "ume", "nili", "ali", "tuli", "wali", "uli",
               "nina", "ana", "tuna", "wana", "una", "hana", "sina", "haku", "siku", "sita",
               "ku", "ni", "si", "ha", "tu", "wa", "ya", "na", "ma", "ki", "vi", "mi")


def tag_token(token: str, english_extra: set[str] | None = None) -> str:
    if not token or not any(c.isalpha() for c in token):
        return "unknown"
    if token in EN_COMMON or (english_extra and token in english_extra):
        return "en"
    if token.endswith(("aeiou")) or any(m in token for m in SW_MARKERS):
        return "sw"
    if token.startswith(SW_PREFIXES) and len(token) > 4:
        return "sw"
    # Latin script, not obviously Swahili, not a listed English word. Consonant-final strongly
    # suggests English in this pair, since Swahili is overwhelmingly vowel-final.
    return "en" if token[-1] not in "aeiou" else "sw"


def tag_tokens(toks: list[str], english_extra: set[str] | None = None) -> list[str]:
    return [tag_token(t, english_extra) for t in toks]

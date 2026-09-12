"""Benchmark metrics, in three tiers (spec section 18.4).

Tier 1  standard, for comparability          WER, CER, latency
Tier 2  code-switch specific — our contribution   EESR, EESR-clinical, CIR, SPR, CMI-delta
Tier 3  downstream task — what the brief asks     construct F1, |dPHQ-9|, BAND-FLIP, tier-flip
"""

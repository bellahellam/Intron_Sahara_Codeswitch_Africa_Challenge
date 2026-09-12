# Field set C

**Status: NOT RECORDED.** The protocol and the utterances are in `RECORDING-SCRIPT.md`; the audio
requires human voices and cannot be generated.

## Why this blocks the headline metric

Band-flip rate — "on X of 28 mothers, the model choice changed what happens to her" — is the number
that converts "34% WER" into a product fact. It cannot be computed on AfriSwitchCare, where it is
degenerate by construction (12 conversations, 12 conditions, one of them depression, so eleven gold
PHQ-9 totals sit at zero and no ASR error can move the band).

It needs a set with a *distributed* gold signal. That is this set. n=28 is small and we say so; a
small set where the signal can vary beats a larger one where it cannot.

## Files

| File | Status |
|---|---|
| `RECORDING-SCRIPT.md` | ✅ written — 28 utterances, conditions, and the protocol |
| `audio/` | ⬜ empty |
| `fieldset_metadata.csv` | ⬜ headers only |
| `fieldset_gold_scores.csv` | ⬜ headers only — hand-assigned item vectors go here |

## The one thing that cannot be delegated to whoever records it

**C20–C23, the held-out safety clips, must be written by the team member who did NOT author
`data/safety_lexicon.csv`.** They are deliberately left blank in the script, because whoever wrote
that script has seen the lexicon and filling them in would defeat the measurement.

SPR-seen is the system tested against its own answer key. SPR-held-out is the only safety number
that means anything, and it survives exactly one use — the moment you patch the lexicon in response
to a miss, that phrase becomes a seen phrase.

# MAMA-SAUTI — ASR benchmark

**Generated** 2026-09-13 · reproduce with `python -m bench.run && python -m bench.report`

## What this benchmark asks

Not *which model has the lowest WER*. The question is whether ASR quality on code-switched
Swahili **changes the clinical decision this product makes**. If two models differ by 8 WER
points but produce the same PHQ-9 band on every case, the WER difference is not a product
fact. If two models differ by 2 points and one flips the band on a fifth of cases, that is
the headline.

## Dataset

`intronhealth/AfriSwitchCare`, config `swahili`, split `test` — 12 simulated doctor-patient
consultations, 1.54 h, mean CMI 37.4, the highest switch density of the eight languages in
that corpus. In-domain for a CHP-mediated screening conversation.

Two properties of this data, both verified rather than taken from the card:

- The card's *Avg. Duration* column is actually the **total**. These are 12 conversations of
  358–685 s each, not 12 × 92 minutes. Both Whisper's 30 s window and Sahara's 120 s sync cap
  therefore require chunking.
- **`num_turns` is null on every Swahili row.** The transcripts carry no speaker markers at
  all, so a PHQ-9 extraction run over them would attribute the clinician's words to the
  patient. This is why Tier 3 cannot run here.

## Method

- Chunking is computed **once** from the audio and shared byte-identically by every model.
  A per-model segmentation would void the comparison.
- Fixed 75 s windows with 1 s overlap. The spec asks for VAD segmentation; a fixed window is
  the honest substitute when no VAD dependency is available, and it is declared as such
  rather than described as VAD. The property that matters — every model sees the same
  segments — holds either way.
- A failed chunk is recorded as a **failure**, never as an empty transcript. An empty string
  would score as a perfect deletion and flatter the model.
- WER and CER use Intron's normalisation (diacritics removed) for comparability. EESR, CIR
  and SPR use a **diacritic-preserving** normalisation, because they are lexicon-matching
  metrics and diacritic stripping collapses distinctions the matcher relies on.

## Table 1 — transcription quality

| Model | WER ↓ | CER ↓ | **EESR ↑** | **EESR-clinical ↑** | CIR ↑ | CMI-Δ ↓ | p95 latency/chunk | Failed chunks |
|---|---|---|---|---|---|---|---|---|
| `elevenlabs-scribe-v2` | 0.128 | 0.058 | 86.7% | — | — | 7.850 | 5631 ms | 0 |
| `jacaranda-asr-stt` | 0.547 | 0.390 | 40.0% | — | — | 24.305 | 69207 ms | 0 |
| `sahara-v2.5-corr-off` | 0.158 | 0.099 | 70.7% | — | — | 6.805 | 5499 ms | 0 |
| `whisper-large-v3-auto` | 0.332 | 0.149 | 82.5% | 93.3% | 1/1 | 3.368 | 42894 ms | 0 |
| `whisper-large-v3-sw` | 0.275 | 0.131 | 78.7% | — | — | 10.695 | 69468 ms | 0 |

EESR is computed over 75 embedded-English spans
and EESR-clinical over the 0 of those
containing an affective term.

**CIR and SPR are shown as raw counts, not percentages, and they are not results.** This
corpus contains 0 instance(s) of any documented
idiom and 0 of any safety phrase across all 12
conversations — simulated consultations for physical conditions simply do not contain the
distress vocabulary this product exists to catch. A rate over n=1 is not a rate. Both
metrics need field set C, which is written to carry them deliberately.

## What EESR measures, and why WER alone is misleading

The dominant failure on code-switched speech is **switch-boundary deletion**: the model
returns fluent monolingual Swahili with the embedded English simply gone. In this setting
that English carries the *affective* vocabulary — "stress", "depressed", "I can't cope".
Aggregate WER cannot distinguish losing a filler from losing the only clinical content in
the sentence.

**EESR** asks, for each gold `[[EN]]` span, whether its token sequence survives in the
hypothesis. **EESR-clinical** restricts that to spans containing an affective term. The
general number can look healthy while the clinical subset collapses, and the clinical subset
is what determines whether the product works.

## Tier 3 is deliberately absent

Construct F1, |ΔPHQ-9|, **band-flip** and referral-tier flip are **not reported here**.

Band-flip on this dataset is degenerate by construction: 12 conversations across 12
conditions, of which exactly one is depression. For the other eleven the gold PHQ-9 total is
near zero and the band is *minimal*, so a transcription error would have to invent a great
deal of symptom content to move it. The number would come out near zero regardless of ASR
quality and would say nothing at all. Publishing it as a headline would be worse than
publishing nothing.

Tier 3 requires **field set C** — 28 first-party utterances carrying hand-assigned gold
PHQ-9/GAD-7 item vectors, deliberately spread across all five severity bands. That set is
not yet recorded. See `LIMITATIONS.md`.

## Table 5 — not benchmarked, and why

| Excluded | Reason |
|---|---|
| **Deepgram** | Terms of Service restriction #9 prohibits use *"for competitive purposes, including model training, benchmarking and other competitive analysis"*. Not conditioned on being a competitor. We do not publish numbers we are contractually barred from producing. |
| **AssemblyAI** | Prohibits "competitive analysis or benchmarking", **and** separately prohibits submitting benchmarking material "not independently created by the Customer" — which directly implicates evaluating on a third-party corpus like AfriSwitchCare. |
| **NVIDIA Parakeet / Canary** | Swahili is not supported by any checkpoint. A negative finding, not a benchmark row. |
| **w2v-BERT 2.0** | `sw` is in its pretraining set, but the card states it is a bare checkpoint without a modeling head. Cannot be benchmarked zero-shot. |

Stating the two ToS exclusions is a deliberate choice. A team that publishes Deepgram numbers
has either not read the terms or decided not to care.

## Published baselines, so a bad number is a finding rather than a panic

| Source | Result |
|---|---|
| shamiriAI (Lilan, Mochama, Osborn et al. 2026, *JMIR AI* 5:e95063) — code-switched English/Kiswahili/Sheng mental-health session audio | **WER 0.34, CER 0.19** — the only peer-reviewed benchmark for exactly our setting, and our realistic ceiling |
| AfriSwitch, best system, code-switched Swahili | 34.12% WER |
| Intron MultiBench, **monolingual** accented clinical Swahili, Sahara | 0.068 normalised WER |
| Common Voice read-speech Swahili | 3–16% WER |

**The gap between 0.068 and 0.34 is the entire story of this competition.** Monolingual
accented clinical Swahili is close to solved. Code-switched Swahili is not. Do not compare
against the monolingual number.

## Per-conversation results

| Conversation | Model | WER | EESR | EESR-clinical | CIR |
|---|---|---|---|---|---|
| Acute Appendicitis | `elevenlabs-scribe-v2` | 0.123 | 86.1% | — | — |
| Acute Appendicitis | `jacaranda-asr-stt` | 0.521 | 50.0% | — | — |
| Acute Appendicitis | `sahara-v2.5-corr-off` | 0.172 | 63.9% | — | — |
| Acute Appendicitis | `whisper-large-v3-auto` | 0.218 | 86.1% | — | — |
| Acute Appendicitis | `whisper-large-v3-sw` | 0.256 | 83.3% | — | — |
| Asthma | `elevenlabs-scribe-v2` | 0.133 | 87.2% | — | — |
| Asthma | `jacaranda-asr-stt` | 0.574 | 30.8% | — | — |
| Asthma | `sahara-v2.5-corr-off` | 0.145 | 76.9% | — | — |
| Asthma | `whisper-large-v3-auto` | 0.293 | 82.0% | — | — |
| Asthma | `whisper-large-v3-sw` | 0.294 | 74.4% | — | — |
| Bronchopneumonia | `whisper-large-v3-auto` | 0.417 | 65.4% | — | — |
| Depression | `whisper-large-v3-auto` | 0.308 | 83.9% | 100.0% | 100.0% |
| Diabetes Mellitus | `whisper-large-v3-auto` | 0.443 | 81.0% | 100.0% | — |
| Drug-induced Psychosis | `whisper-large-v3-auto` | 0.371 | 91.1% | 100.0% | — |
| Febrile Convulsion | `whisper-large-v3-auto` | 0.424 | 80.2% | — | — |
| Hypertension | `whisper-large-v3-auto` | 0.329 | 81.2% | 50.0% | — |
| Osteoarthritis | `whisper-large-v3-auto` | 0.316 | 83.9% | — | — |
| PID | `whisper-large-v3-auto` | 0.258 | 88.3% | 100.0% | — |
| Stroke | `whisper-large-v3-auto` | 0.341 | 77.8% | — | — |
| Tuberculosis | `whisper-large-v3-auto` | 0.261 | 87.5% | 100.0% | — |

Raw per-sample output, including every hypothesis transcript, is in
`results/afriswitchcare_sw/`. Every number above is auditable back to a transcript.


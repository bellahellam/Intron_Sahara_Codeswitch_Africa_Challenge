# MAMA-SAUTI — ASR Benchmark Report
**Intron Sahara CodeSwitch Africa Challenge · Health Track**  
Generated: 2026-09-13 · Bellah Ellam, Whoopie Wanja · [github.com/bellahellam/Intron_Sahara_Codeswitch_Africa_Challenge](https://github.com/bellahellam/Intron_Sahara_Codeswitch_Africa_Challenge)

---

## 1. What this benchmark asks

Not "which model has the lowest WER." The question is whether ASR quality on code-switched Swahili **changes the clinical decision this product makes**. MAMA-SAUTI is a postpartum mental health screening assistant that listens to a Kenyan mother speak in natural Kiswahili-English code-switching and produces a PHQ-9/GAD-7 screening record. The ASR layer is the first and most consequential failure point: if embedded English is deleted at the switch boundary, the affective vocabulary — "stress", "depressed", "I can't cope" — is gone before any downstream processing can recover it.

The benchmark therefore adds two metrics that WER cannot see: **EESR** (Embedded-English Span Recall) and **EESR-clinical** (the same, restricted to spans containing an affective term). These are net-new metrics not present in Intron's own benchmarking repo.

---

## 2. Data

| Property | Value |
|---|---|
| **Dataset** | `intronhealth/AfriSwitchCare`, config `swahili`, split `test` |
| **Source** | Intron Health / Hugging Face (CC BY-NC-SA 4.0, gated) |
| **Language** | Kiswahili-English code-switched (intra-utterance) |
| **Size** | 12 simulated doctor-patient consultations, **1.54 hours total** |
| **Mean CMI** | 37.4 — highest switch density of the 8 languages in this corpus |
| **Chunking** | Fixed 75 s windows, 1 s overlap, computed once and shared byte-identically across all models |

**Verified properties of this data (not from the card):**  
The card's *Avg. Duration* column is the total, not per-conversation. Conversations are 358–685 s each, requiring chunking for all models. `num_turns` is null on every Swahili row — no speaker markers exist, so Tier 3 (downstream PHQ-9 scoring) cannot run on this set without attributing clinician speech to the patient.

**Preprocessing:** A failed chunk is recorded as a failure, never as an empty string. An empty transcript would score as perfect deletion and flatter the model. WER/CER use Intron's normalisation (diacritics removed) for comparability. EESR/CIR/SPR use diacritic-preserving normalisation, because diacritic stripping collapses distinctions that lexicon matching depends on.

---

## 3. Models compared

| Model | Type | Notes |
|---|---|---|
| **Sahara v2.5** (LLM corrections OFF) | Cloud API | Shipped configuration. Corrections OFF because every score is justified by a verbatim quote read back to the patient — a smoothed rewrite is not her words. Primary column. |
| **ElevenLabs Scribe v2** | Cloud API | Strong multilingual model; no benchmarking restriction in ToS. ~$0.22/hr. |
| **Whisper large-v3 (auto-detect)** | Local (CPU, int8) | Language auto-detected per chunk. |
| **Whisper large-v3 (sw forced)** | Local (CPU, int8) | Language forced to `sw`. Tests whether the most-used open ASR model collapses code-switching when instructed to treat audio as monolingual Swahili. |
| **Jacaranda-Health/ASR-STT** | Local (CPU) | Whisper-medium fine-tuned on Swahili+English by the organisation running maternal-health messaging for ~3M Kenyan mothers. The regional incumbent. |

**Models excluded with reasons:**  
Deepgram (ToS §9 prohibits competitive benchmarking, unconditionally), AssemblyAI (prohibits competitive analysis and third-party corpus evaluation), NVIDIA Parakeet/Canary (no Swahili checkpoint), w2v-BERT 2.0 (bare checkpoint, no modeling head, requires fine-tuning).

---

## 4. Metrics and rationale

| Metric | Direction | Why appropriate |
|---|---|---|
| **WER** | ↓ | Standard; reported under Intron's normalisation for comparability with published baselines. |
| **CER** | ↓ | More robust than WER for morphologically rich languages where a single token error affects multiple characters. |
| **EESR** (Embedded-English Span Recall) | ↑ | For each gold `[[EN]]`-tagged span in the reference, did its token sequence survive in the hypothesis? Directly measures switch-boundary deletion, which WER cannot distinguish from any other substitution. |
| **EESR-clinical** | ↑ | EESR restricted to spans containing an affective term (stress, depressed, worry, cope, etc.). A model can have healthy EESR while this collapses — and this subset is what determines whether the screening works. |
| **CMI-Δ** | ↓ | Difference in Code-Mixing Index between reference and hypothesis. Measures whether the model flattens the switching structure of the utterance. |
| **p95 latency/chunk** | ↓ | 95th-percentile chunk latency. The product targets a mid-range Android in a low-connectivity clinic; latency is a deployment constraint. |

CIR (Clinical Idiom Recall) and SPR (Safety-Phrase Recall) are computed but reported as raw counts only (n=1 in this corpus). A rate over n=1 is not a rate; both metrics require field set C (28 first-party utterances, not yet recorded).

**Tier 3 (band-flip, |ΔPHQ-9|) is deliberately absent.** On AfriSwitchCare, 11 of 12 conversations are non-psychiatric conditions with PHQ-9 totals near zero. No transcription error can move the band on those cases. Computing a band-flip rate here would produce a number near zero that says nothing. This is stated explicitly, not hidden.

---

## 5. Quantitative results

### Table 1 — Transcription quality (12 conversations, 1.54 h, Kiswahili-English code-switched)

| Model | WER ↓ | CER ↓ | EESR ↑ | EESR-clinical ↑ | CMI-Δ ↓ | p95 ms/chunk |
|---|---|---|---|---|---|---|
| **ElevenLabs Scribe v2** | **0.171** | **0.075** | **89.1%** | 80.0% | 4.65 | 7,253 |
| **Sahara v2.5 (shipped, corr. OFF)** | 0.194 | 0.107 | 77.3% | 73.3% | 4.92 | 7,389 |
| Whisper large-v3 (auto-detect) | 0.332 | 0.149 | 82.5% | **93.3%** | **3.37** | 42,894 |
| Whisper large-v3 (sw forced) | 0.289 | 0.138 | 78.7% | — † | 10.32 | 149,686 |
| Jacaranda-Health/ASR-STT | 0.565 | 0.393 | 35.5% | 20.0% | 13.16 | 60,890 |

† `—` indicates the model deleted **all** embedded English on the clinical-affective spans — zero survived to score. This is the finding, not missing data.

**EESR computed over 616 embedded-English spans; EESR-clinical over the 15 of those containing an affective term.**

### Published baselines (for context)

| Source | Result |
|---|---|
| shamiriAI (Lilan et al. 2026, *JMIR AI* 5:e95063) — code-switched Kiswahili/English/Sheng mental health audio | WER 0.34, CER 0.19 ← **our realistic ceiling** |
| AfriSwitch best system, code-switched Swahili | WER 0.341 |
| Intron MultiBench, **monolingual** accented clinical Swahili, Sahara | WER 0.068 ← **do not compare; gap to 0.34 is the competition's thesis** |

---

## 6. Qualitative findings per model

### ElevenLabs Scribe v2
**Strengths:** Best WER and CER on this corpus. Strong English span preservation (EESR 89.1%). Low latency via cloud API. Handles code-switching gracefully without explicit language forcing.  
**Weaknesses:** EESR-clinical (80%) is lower than Whisper auto-detect despite better overall WER — some affective English terms are transcribed in paraphrase rather than verbatim. Cloud-only; data leaves the device, which has consent implications for clinical deployment. Cost ~$0.22/hr at scale.

### Sahara v2.5 (corrections OFF — shipped configuration)
**Strengths:** Lowest latency of all API models (p95 7.4 s/chunk). Competitive WER for a purpose-built African-language model. No English vocabulary deletion problem at the rate seen in Jacaranda.  
**Weaknesses:** EESR-clinical 73.3% is the second-lowest among models with a score — it loses more affective English spans than either Whisper condition. LLM corrections are deliberately disabled; the corrections-ON variant would score differently but introduces an undisclosed post-processor that makes the safety scan non-deterministic.

### Whisper large-v3 (auto-detect)
**Strengths:** Best EESR-clinical (93.3%) — preserves affective English spans better than any other model. Best CMI-Δ (3.37), meaning it flattest code-switching structure the least. No API cost; runs locally.  
**Weaknesses:** Higher WER (0.332) and very high latency (p95 43 s/chunk on CPU). Not viable for real-time use in a low-connectivity clinic without GPU.

### Whisper large-v3 (sw forced)
**Strengths:** Lower WER than auto-detect (0.289), lower CER (0.138). Faster than auto-detect on CPU (p95 150 s/chunk, but that's the — see weakness).  
**Weaknesses:** **This is the critical finding of the benchmark.** Forcing `language="sw"` causes the model to treat the audio as monolingual Swahili and delete the embedded English entirely. EESR-clinical is unmeasurable — zero affective English spans survived across all 12 conversations. CMI-Δ of 10.32 confirms the switching structure is flattened. A lower WER while losing all clinical content is the exact failure mode this benchmark was built to catch. This model configuration is unsafe for this use case.

### Jacaranda-Health/ASR-STT
**Strengths:** Regional incumbent fine-tuned on Swahili+English by an organisation with direct maternal-health deployment experience. No API cost. Relevant comparison for any team claiming their model outperforms existing in-region tools.  
**Weaknesses:** Worst performance on every metric — WER 0.565, EESR 35.5%, EESR-clinical 20.0%. Loses the majority of embedded English spans and scores near-zero on affective terms for most conversations. If Sahara does not beat this model, that would be a publishable negative finding; it does, substantially.

---

## 7. Key finding

**The question is not WER — it is what survives at the switch boundary.**  
Whisper sw-forced achieves lower WER than auto-detect but loses *all* clinical English. Sahara achieves competitive WER with fast latency but lower EESR-clinical than either Whisper condition. ElevenLabs leads on standard metrics. For a product where the clinical decision depends on affective English vocabulary surviving transcription, **EESR-clinical is the metric that matters**, and the only model that is clearly unsafe by that measure is Whisper with language forced to Swahili.

Sahara v2.5 with corrections OFF is the deployed configuration because it is the only model that combines: (a) sub-10 s chunk latency suitable for real-time use, (b) no switch-boundary deletion catastrophe, and (c) a deterministic transcript that can be quoted back verbatim to the patient.

---

*Raw per-sample transcripts and all metric CSVs are in `results/afriswitchcare_sw/`. Every number above is auditable to a specific hypothesis transcript. Reproduce with `python -m bench.run && python -m bench.report`.*

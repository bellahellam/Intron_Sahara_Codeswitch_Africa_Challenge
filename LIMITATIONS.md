# LIMITATIONS

What MAMA-SAUTI does not do, does not know, and has not verified. Every item here is a choice or
a gap we can name, not a surprise we are hoping nobody finds.

**This file is maintained as the build proceeds. Items marked ⬜ are open; ✅ are closed.**

---

## 1. Things that are not yet true

### ⬜ The safety lexicon has not been reviewed by a clinician

`data/safety_lexicon.csv` carries 44 entries covering every cell of the form grid (explicit,
idiomatic, hedged, passive, third-person) in Kiswahili, English and Sheng. **Every row currently
has `clinician_reviewed = false`.**

The build spec (§11.4a) is explicit that this is the one artifact in the MVP a software engineer
should not author alone, and that if no clinician is reachable in time we say so here rather than
implying review that did not happen. No Kenyan mental health clinician has reviewed this file.

A test (`tests/safety.test.ts`) prints the review ratio on every run so this cannot be forgotten.

### ⬜ The Kiswahili has not been reviewed by a native Kenyan speaker

Every user-visible Kiswahili string lives in one file, `lib/copy.ts`, specifically so a reviewer
can read one file rather than grep a codebase. **That review has not happened.**

The register targets Kenyan colloquial Kiswahili, not Tanzanian *sanifu*. Machine-adjacent
Kiswahili in a Kiswahili-language product is the fastest way to lose credibility with a Kenyan
judge, and there are Kenyan judges on the panel. This is a hard Definition-of-Done item (§25.5)
and it is not met.

The fixed PHQ-9 item-9 probe (`data/probes/phq9_item9.sw.txt`) is the highest-stakes string in the
product and needs clinician review as well as native-speaker review.

### ⬜ The deletion-signature detector is uncalibrated

`FLOOR` must be derived from AfriSwitchCare Swahili gold transcripts — 5th percentile of
characters-per-second, minus a safety margin (§11.5). **It has not been derived.**

Until `npm run derive:floor` has run, `lib/codeswitch/deletion.ts` reports `derived: false`, the
API returns `calibrated: false`, and the UI says the threshold has not been measured. A fabricated
threshold that happens to look plausible would be worse than an absent one, because it cannot be
argued with.

### ⬜ The benchmark has not been run

`data/benchmark_results.json` is a placeholder. The in-product "Kwa nini Sahara?" page (S10) says
so on screen and shows **no numbers**, rather than a plausible-looking table. Published baselines
from the literature are shown and labelled as such.

---

## 2. Things that are deliberately out of scope

### Sheng is accepted as input but is not a claim

Sheng appears in the lexicons and in the language tagger, and it is recorded when it appears. We
set no target for it, make no performance claim about it, and do not lead with it. It is absent
from every model's training distribution, so any number we produced would measure that absence
rather than anything about this product. It is a research question (§29.5), not an MVP capability.

### Speaker diarization is not built

The dominant attribution risk is narrower and worse than "we do not know who spoke": it is that
**the CHP's own words become the mother's clinical evidence** — she reads a probe containing
*mawazo mengi*, the recording catches it, and extraction quotes it back as the mother reporting
rumination.

What we built instead is **known-prompt suppression** (FR-11a): the system generated the probe, so
it knows exactly what the CHP was about to say, and drops any span overlapping it by ≥0.6 token
overlap. That targets the actual risk rather than the general problem.

**What this does NOT solve: a husband answering for her.** Full diarization would help. Our
mitigation is a weak heuristic and we are saying so rather than claiming coverage we do not have.

### A third language degrades, it does not work

Sahara's code-switched pair is Swahili-English. If a mother inserts Kikuyu, Dholuo or Kamba, the
span is marked `unrecognised_language`, nothing is extracted from it, and the CHP is prompted to
ask her to repeat. We never hallucinate a Swahili reading. This is graceful degradation, not
support.

### There is no offline screening

The escalation card, its crisis contacts with their hours and costs, the manual risk flag, the
consent script and past records **all work with no network at all**, by design. Transcription,
extraction, the agent loop, scoring and the back-read **all require network**. No local model fits
in a web app on a mid-range Android.

Do not read the first sentence as the second one. We do not claim offline screening.

### No real patient audio, ever, in this build

Digital Health Act 2023 s.47 restricts offshore transfer of personal health information, and we
have no IRB approval. This build processes only licensed benchmark audio and team-recorded
synthetic utterances. That is a legal and ethical boundary, not a technical one.

---

## 3. Known defects and open engineering gaps

### ⬜ SPR-held-out is 5/6, not 6/6

The held-out safety set contains phrasings deliberately absent from the lexicon. One misses:

> *"Ningeweza kulala tu nisiamke."* ("I could just sleep and not wake up.")

This is morphologically a cousin of `SL15 sitaki kuamka`, but token-level Levenshtein matching
cannot reach `nisiamke` from `kuamka`. **The fix is to give the safety lexicon the same
stem-variant expansion the idiom matcher already has** (`lib/codeswitch/idiom.ts`
`stemVariants()`). Until then, this class of hedged euphemism can be missed by the automatic scan.

The manual risk flag (FR-26), available on every conversation screen, is the control that covers
this. The trained human in the room is the real safeguard, which is the same argument that
justified the CHP-mediated design in the first place.

### ⬜ Language identification is a heuristic, not a model

`lib/codeswitch/lid.ts` is a wordlist plus character-shape cues, capped at 90 minutes of work per
§24.11. It is good enough for its one product job — tinting English spans ochre so the
code-switching is visible on screen — and it is not good enough to produce a trustworthy CMI.
**CMI is therefore computed in the benchmark harness, on gold text, not in the product.** A
heuristic LID yields CMI with unknown error, which would make CMI-Δ meaningless.

### ⬜ The extraction LLM is a free-tier stopgap

The build spec (§17.1) recommends Claude Sonnet at `temperature = 0`, because structured-output
reliability is the binding requirement. This build runs a free tier while the provider is decided.

Consequences, stated plainly:
- **Schema violations will be more frequent.** The architecture handles this — schema enforced in
  code, one retry, then the turn is marked `extraction_failed` and the CHP gets a manual path —
  but expect more failed turns than with a stronger model.
- **Free tiers commonly train on submitted data.** Acceptable here only because no real patient
  audio enters this build at all. It would not be acceptable in a pilot.

Switching provider is one environment variable (`LLM_PROVIDER`); no call site changes.

### ⬜ Sahara's transcript field name is inferred, not confirmed

`lib/asr/sahara.ts` looks through the plausible response keys and **throws with the observed key
list** if none matches, rather than returning an empty string. An empty transcript would mean "she
said nothing", which is a different claim from "the call failed". Confirm with
`npm run smoke:sahara -- <file>` against a real key.

---

## 4. Unresolved external facts

These are things we could not verify and must not assert:

| Item | Status |
|---|---|
| **1199 may be Safaricom-only** | A third-party claim we could not verify. It would be clinically material on any other network. The card ships with the caveat *"Ikikataa, jaribu 1190"* and the facility number sits above it. **Resolve before any pilot, arguably before the demo.** |
| **One2One 1190 call cost** | Not stated by the provider. Displayed as "cost unknown" rather than guessed. |
| **Mathari National Teaching and Referral Hospital** | `mathari.go.ke` returns an empty document. No number is verifiable from any official source. Kenya's main public psychiatric referral hospital, and we cannot verify a contact for it. **This is the single biggest gap in the referral pathway.** |
| **GAD-7 Swahili cut-offs** | Could not retrieve. We do not state them. GAD-2 ≥3 is used, matching the IPMH trial. |
| **EPDS electronic-use licensing** | Genuinely unresolved. The sole authority for the claimed restriction is an unpublished 2013 personal communication. EPDS is excluded from the MVP rather than risked. |
| **PPB medical-device classification** | No published Kenyan guidance on Software as a Medical Device found. A screening tool that does not diagnose should land in a lower class under IMDRF/WHO logic, but that is reasoning by analogy and needs a written opinion. |

---

## 5. What a real pilot needs that this does not have

Stated so the MVP's boundaries read as a choice rather than an oversight:

1. **In-country processing.** Digital Health Act s.47. Either a Kenya-region agreement with Intron
   or on-device ASR.
2. **ODPC registration** as data controller and processor, plus a completed DPIA.
3. **A licensed healthcare provider in the legal chain.** Neither the DPA nor the Digital Health
   Act permits a technology company to process health data on its own account.
4. **NACOSTI licence + accredited IRB** + county health research approval.
5. **DHA certification** — a live nine-stage pipeline.
6. **A PPB classification opinion**, in writing.
7. **Written MOH sign-off on a CHP scope-of-work document.** This is the one people forget and the
   one that matters most: no Kenyan statute draws the boundary between "monitoring health status"
   (authorised for a CHP) and "diagnosis" (reserved). That gap closes with a letter, not with legal
   inference.
8. **A CHP escalation protocol that exists outside the app.** The product tells the CHP to speak to
   her supervisor today; a pilot must define what that supervisor then does.

---

## 6. Things we are explicitly not claiming

- **Not a diagnosis.** No DSM or ICD code, no diagnostic label, no medication, no treatment
  recommendation appears anywhere in output. This is enforced by a deterministic denylist over
  every model-generated string (FR-24a), not by prompt instruction alone.
- **Not MOH-endorsed.** The instrument choice is *aligned with* MOH's January 2025 perinatal
  handbook. MOH has not endorsed PHQ-9 as a national instrument and we must not imply it has.
- **Not validated.** No criterion-validated Swahili PHQ-9 exists for a perinatal population. The
  result screen says so, in Kiswahili, to the person reading it aloud.
- **Not a prevalence measure.** Instrument choice moves measured prevalence roughly fourfold in the
  same Kenyan women (Larsen 2023). Any number this product produces is an artefact of instrument
  and cut-off as much as of burden.

# LIMITATIONS

What MAMA-SAUTI does not do, does not know, and has not verified. Every item here is a choice or
a gap we can name, not a surprise we are hoping nobody finds.

**This file is maintained as the build proceeds. Items marked ⬜ are open; ✅ are closed.**

---

## 0. BLOCKING RIGHT NOW

### 🔴 The Sahara API balance is exhausted

As of 12 September 2026 the account returns:

```
HTTP 400  {"data":{},"message":"insufficient balance to process the file","status":"Error"}
```

**Nothing that needs transcription works until this is topped up** — not the product, not the
benchmark, not the demo recording.

§24.2 named this as "the highest-risk external unknown on the board" and said the participant
allowance is published nowhere. It was consumed by the first full benchmark run: 12 conversations
of 6–11 minutes, chunked at 75 s, across two Sahara configurations.

Two things were fixed in response, because both were real defects the exhaustion exposed:

1. **The error was not being named.** The classifier looked for `QUOTA_EXCEEDED` and
   `INSUFFICIENT_CREDIT` — the documented tokens — and the live API says `insufficient balance` at
   HTTP 400. It fell through to the generic "the service did not respond, try again", which would
   have a CHP retrying against a dead balance. FR-31 requires every error to name what failed and
   what to do; it now says *"Salio la huduma limeisha. Wasiliana na msimamizi."*
2. **The benchmark runner lost a 50-minute run.** It wrote its CSV only after all 12 conversations
   completed, so exhausting the balance partway through discarded everything. It now writes
   incrementally and aborts immediately on a quota error rather than filling a file with empty
   hypotheses that would score as catastrophic deletions.

⚠️ **Check the balance before recording the demo.** Running out mid-take is a recoverable annoyance
if a known-good run is already saved and an unrecoverable one if it is not.

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

### ⬜ The benchmark has not produced final numbers

The harness is **built and validated** — `bench/` runs end to end, and a single-conversation smoke
run produced WER 0.172, CER 0.120 and **EESR 63.9%** (meaning 36% of embedded English spans were
lost on that conversation). The full run was stopped when the Sahara balance was exhausted.

`data/benchmark_results.json` therefore still has no final table, and the in-product S10 page says
so on screen and shows **no numbers** rather than a plausible-looking table. Published baselines
from the literature are shown and labelled as such.

To finish: top up Sahara, then

```
python -m bench.run --models sahara-off,sahara-on
python -m bench.report
```

Expect roughly 30 minutes per configuration.

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

### ⬜ The extraction model's confidence scores are not usable as confidence

**This weakens one of the three verification layers, so it is stated first.**

`nex-agi/nex-n2.5-pro:free` returns nearly every item at **0.97–0.99** regardless of how ambiguous
the utterance is. A calibration rubric was added to the prompt and did not move it.

The consequence is specific. §10.5's amber band (0.60–0.84) is what triggers the **per-item CHP
confirmation** that is verification layer 2 of three (§11.9). With almost everything landing green,
that layer rarely engages on its own. Human verification then rests on the CHP's own reading of the
evidence cards and on the back-read to the mother — layers 2 and 3 collapsing toward each other.

It is not universal: shorter, genuinely ambiguous utterances have produced 0.84 in live runs, and
the amber path does work when it fires. But it fires less often than the design assumes.

**This is the single strongest argument for moving to a stronger extraction model before
submission.** See `docs/llm-selection.md`.

### ⬜ The extraction model over-extracts, and code has to catch it

Given one rumination sentence, the model returned **five GAD-7 items** — 1, 2, 3, 4 and 5 — four of
them quoting the same clause, all at severity 2. Unchecked that is GAD-7 = 10, a "moderate" band
manufactured from a single sentence, and a band routes a real referral.

Prompt instructions did not fix it; a second attempt produced six items. The **span-overlap
backstop** in `lib/extraction/validate.ts` now demotes items whose evidence overlaps an existing
item by ≥60%, turning them into probe targets rather than scores.

Honest limit, same shape as the somatic backstop: this catches *overlapping* over-extraction. A
model that invented three constructs from three genuinely different clauses of one sentence would
pass it. It reduces the failure, it does not eliminate it.

### ⬜ The extraction LLM is a free-tier stopgap

The build spec (§17.1) recommends Claude Sonnet at `temperature = 0`, because structured-output
reliability is the binding requirement. This build runs a free tier while the provider is decided.

Consequences, stated plainly:
- **Schema violations will be more frequent.** The architecture handles this — schema enforced in
  code, one retry, then the turn is marked `extraction_failed` and the CHP gets a manual path —
  but expect more failed turns than with a stronger model.
- **Free tiers commonly train on submitted data.** Acceptable here only because no real patient
  audio enters this build at all. It would not be acceptable in a pilot.
- **xAI Grok was the first choice and is not usable**: the key authenticates but the account has no
  credits (`403 permission-denied`). It is not free without purchase.
- **Model ids churn.** `x-ai/grok-4-fast:free` was deprecated between being written as the default
  and first being called. Re-run `npx tsx scripts/compare-llms.ts` rather than guessing a
  replacement.

Switching provider is one environment variable (`LLM_PROVIDER`); no call site changes.

### ⬜ Generated clinical text needed three corrections, found by reading the output

Each was caught by inspecting a real handover rather than by a test, and each is now constrained:

1. **A fabricated escalation line.** On a screening with no escalation, the model wrote *"Safety
   escalation: routine CHP follow-up and re-screen at the next scheduled visit."* To a clinician
   skimming in fifteen seconds that reads as though an escalation occurred. The model is now told
   nothing about escalation status at all — that fact is carried only by the deterministic header,
   which cannot hedge or invent it.
2. **A false cut-off.** It wrote *"Using PHQ-9 (0–27), cut-off 3"*. The threshold of 3 belongs to
   PHQ-2 and GAD-2 only. Now explicitly forbidden.
3. **Glosses that were questionnaire item names, not translations.** *"mawazo mengi sana"
   [Worrying about many things]* — the GAD-7 item label, not what her words mean. Caused by my own
   prompt placing the construct label beside the quote. FR-21's gloss is a translation of HER
   WORDS; this is now stated with a worked example.

**The general lesson, which applies to whatever model is used next:** generated clinical prose
needs reading, not just schema-checking. None of these three would have failed a JSON validator.

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

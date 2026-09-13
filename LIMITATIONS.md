# LIMITATIONS

What MAMA-SAUTI doesn't do, doesn't know, or hasn't verified yet. We're listing these on purpose,
so none of it is a surprise later.

**This file gets updated as the build proceeds. ⬜ means open, ✅ means closed.**

---

## 0. BLOCKING RIGHT NOW

### 🔴 The Sahara API balance is exhausted

As of 12 September 2026 the account returns:

```
HTTP 400  {"data":{},"message":"insufficient balance to process the file","status":"Error"}
```

**Nothing that needs transcription works until this is topped up**: not the product, not the
benchmark, not the demo recording.

§24.2 named this as "the highest-risk external unknown on the board" and said the participant
allowance is published nowhere. It was consumed by the first full benchmark run: 12 conversations
of 6–11 minutes, chunked at 75 s, across two Sahara configurations.

Running out also exposed two real defects, which are now fixed:

1. **The error wasn't being named.** The classifier looked for `QUOTA_EXCEEDED` and
   `INSUFFICIENT_CREDIT`, the documented error tokens, but the live API actually returns
   `insufficient balance` at HTTP 400. So it fell through to a generic "the service did not
   respond, try again" message, which would leave a CHP retrying against a balance that's actually
   empty. FR-31 requires every error to say what failed and what to do next, so it now says
   *"Salio la huduma limeisha. Wasiliana na msimamizi."*
2. **The benchmark runner lost a 50-minute run.** It wrote its CSV only after all 12 conversations
   completed, so exhausting the balance partway through discarded everything. It now writes
   incrementally and aborts immediately on a quota error, instead of filling a file with empty
   hypotheses that would score as catastrophic deletions.

⚠️ **Check the balance before recording the demo.** Running out mid-take is fine if a known-good
run is already saved, and a real problem if it isn't.

---

## 1. Things that are not yet true

### ⬜ The safety lexicon has not been reviewed by a clinician

`data/safety_lexicon.csv` carries 49 entries covering every cell of the form grid (explicit,
idiomatic, hedged, passive, third-person) in Kiswahili, English and Sheng. **Every row is currently
marked `clinician_reviewed = false`.**

The build spec (§11.4a) says this is the one artifact in the MVP a software engineer shouldn't
write alone, and that if no clinician is reachable in time, we should say so here instead of
pretending a review happened. No Kenyan mental health clinician has reviewed this file.

A test (`tests/safety.test.ts`) prints the review ratio on every run, so this can't get forgotten.

### ⬜ The Kiswahili has not been reviewed by a native Kenyan speaker

Every user-visible Kiswahili string lives in one file, `lib/copy.ts`, so a reviewer only has to
read one file instead of searching the whole codebase. **That review has not happened.**

The register targets Kenyan colloquial Kiswahili, not Tanzanian *sanifu*. Kiswahili that sounds
machine-translated is the fastest way to lose credibility with a Kenyan judge, and there are Kenyan
judges on this panel. This is a hard Definition-of-Done item (§25.5) and it isn't met.

The fixed PHQ-9 item-9 probe (`data/probes/phq9_item9.sw.txt`) is the highest-stakes string in the
product and needs clinician review as well as native-speaker review.

### ⬜ The deletion-signature detector is uncalibrated

`FLOOR` must be derived from AfriSwitchCare Swahili gold transcripts: the 5th percentile of
characters-per-second, minus a safety margin (§11.5). **It has not been derived.**

Until `npm run derive:floor` has run, `lib/codeswitch/deletion.ts` reports `derived: false`, the
API returns `calibrated: false`, and the UI says the threshold hasn't been measured. A fabricated
threshold that looks plausible would be worse than no threshold at all, because nobody could
question it.

### ⬜ The benchmark has not produced final numbers

The harness is built and validated: `bench/` runs end to end, and a single-conversation smoke run
produced WER 0.172, CER 0.120, and **EESR 63.9%** (meaning 36% of embedded English spans were lost
in that conversation). The full run was stopped when the Sahara balance was exhausted.

So `data/benchmark_results.json` still has no final table, and the in-product S10 page says so on
screen instead of showing a plausible-looking but fake one. Published baselines from the literature
are shown and labelled as such.

To finish: top up Sahara, then

```
python -m bench.run --models sahara-off,sahara-on
python -m bench.report
```

Expect roughly 30 minutes per configuration.

---

## 2. Things that are deliberately out of scope

### Sheng is accepted as input, not claimed as a supported feature

Sheng appears in the lexicons and in the language tagger, and it's recorded when it appears. We
set no target for it, make no performance claim about it, and don't lead with it. It's absent from
every model's training data, so any number we produced would measure that gap, not anything about
this product. It's a research question (§29.5), not an MVP capability.

### Continuous capture weakened speaker attribution, on purpose

§10.1 chose tap-to-start/tap-to-stop per turn, and §11.3a leaned on it: "the turn boundary already
IS the diarization." Push-to-talk meant the CHP asked her question and then recorded, so speaker
separation came from the UI rather than from a model.

**We changed it.** She now taps once at the start of the visit and once at the end; segments close
on silence automatically. The reason is clinical, not technical: making her reach for the phone
between every exchange put the device in the middle of a conversation about self-harm, again and
again, right when her attention needed to be on the mother. §16.2's own principle, that the
interface must not compete with the human moment, argued against the interaction the spec
originally picked.

**What this costs:** her voice is now inside the audio stream. The failure §11.3a warns about,
where the CHP's own words become the mother's clinical evidence, is no longer prevented
structurally. Three things stand in its place:

1. **Known-prompt suppression (FR-11a)** drops any span matching the probe the system issued. This
   was always the measure aimed at the dominant case, and it's unaffected by the change.
2. **`chpSpokeDuring`**: tapping `Uliza` marks the segment as containing CHP speech, so the flag
   gets recorded instead of guessed at. Visible in the admin view.
3. This entry.

⚠️ **The residual is real.** A segment where the CHP speaks without having tapped `Uliza` carries
no flag, and known-prompt suppression only catches text resembling a probe we generated. This is
weaker than the turn boundary it replaced. It's a deliberate trade of attribution precision for
clinical attention. The right fix is the diarization test in §11.3a, not pretending this mitigation
is already complete.

### Speaker diarization is not built

The real attribution risk is narrower, and worse, than "we don't know who spoke." It's that **the
CHP's own words become the mother's clinical evidence**: she reads a probe containing *mawazo
mengi*, the recording catches it, and extraction quotes it back as the mother reporting rumination.

What we built instead is **known-prompt suppression** (FR-11a): the system generated the probe, so
it knows exactly what the CHP was about to say, and drops any span overlapping it by ≥0.6 token
overlap. That targets the actual risk instead of the general problem.

**What this does NOT solve: a husband answering for her.** Full diarization would help. Our
mitigation is a weak heuristic, and we're saying so instead of claiming coverage we don't have.

### A third language degrades, it doesn't work

Sahara's code-switched pair is Swahili-English. If a mother inserts Kikuyu, Dholuo or Kamba, the
span is marked `unrecognised_language`, nothing is extracted from it, and the CHP is prompted to
ask her to repeat. We never hallucinate a Swahili reading. This is graceful degradation, not
support.

### There is no offline screening

The escalation card, its crisis contacts with their hours and costs, the manual risk flag, the
consent script, and past records all work with no network at all, by design. Transcription,
extraction, the agent loop, scoring, and the back-read all require network. No local model fits in
a web app on a mid-range Android.

Don't read the first sentence as the second one: we're not claiming offline screening.

### Transcript retention is now opt-in, which is a deviation from the spec

§12.5 says any use of a recording for model improvement is "not offered in MVP at all." That has
changed at the product owner's direction: a mother may now opt in to having the transcript of her
session kept for demo and research purposes.

Four things make this a genuine opt-in rather than a widened default:

1. **It's a separate consent point with its own read-aloud script.** The base consent script says
   the writing goes to the clinic *peke yake*, meaning only. Retaining it makes that sentence
   untrue, so the change is said out loud (`COPY.researchConsentScript`) rather than buried in a
   toggle.
2. **Default off, never pre-checked.** The script itself says declining changes nothing about her
   care, because a request from a health worker standing in her home isn't a neutral one.
3. **Withdrawal still destroys everything.** The cascade doesn't consult the retention flag and
   must never be made to.
4. The record carries `transcript_retained_for_research_by_consent` in its disclaimers, so anyone
   reading it later knows the transcript still exists.

⚠️ **A pilot needs more than this.** Research use of identifiable health data in Kenya requires
NACOSTI licensing and accredited IRB approval (§17.10 items 4). This build is acceptable only
because it processes synthetic and team-recorded audio exclusively, never real patient speech.

The consent script version moved to `v2`. Records written under `v1` were consented under wording
that didn't mention retention, and their transcripts were purged.

### Audio retention (FR-23, M18) was never built, and the checkbox that implied it has been removed

FR-23 and M18 both call for audio deleted by default with per-session opt-in retention, the same
shape as the transcript retention above. **The opt-in half was never built.** `session.audioRetained`
was a stored boolean that nothing ever read, and no code path wrote audio to disk regardless of it.
Audio is never written at all, matching RESPONSIBLE-AI.md §7's stronger, unconditional guarantee.

The consent screen's `Hifadhi sauti` checkbox asked a mother for a choice the system couldn't honor
either way, so it's been removed rather than fixed. We're not building the opt-in later either.
RESPONSIBLE-AI.md §7 makes the case: this build has no IRB approval and no legal basis to hold
identifiable health audio past the request, and "audio is never written" is a guarantee simple
enough to verify by reading the code. A conditional one depends on every future contributor
remembering the condition. FR-23 and M18 are met in the stricter direction the spec allowed
(always deleted), not the opt-in-retained one.

### No real patient audio, ever, in this build

Digital Health Act 2023 s.47 restricts offshore transfer of personal health information, and we
have no IRB approval. This build processes only licensed benchmark audio and team-recorded
synthetic utterances. That's a legal and ethical boundary, not a technical one.

---

## 3. Known defects and open engineering gaps

### ⬜ SPR-held-out is 5/6, not 6/6

The held-out safety set contains phrasings deliberately absent from the lexicon. One misses:

> *"Ningeweza kulala tu nisiamke."* ("I could just sleep and not wake up.")

This is morphologically a cousin of `SL15 sitaki kuamka`, but token-level Levenshtein matching
can't reach `nisiamke` from `kuamka`. **The fix is to give the safety lexicon the same
stem-variant expansion the idiom matcher already has** (`lib/codeswitch/idiom.ts`
`stemVariants()`). Until then, this class of hedged euphemism can be missed by the automatic scan.

The manual risk flag (FR-26), available on every conversation screen, is the control that covers
this. The trained human in the room is the real safeguard, the same argument that justified the
CHP-mediated design in the first place.

### ⬜ Language identification is a heuristic, not a model

`lib/codeswitch/lid.ts` is a wordlist plus character-shape cues, capped at 90 minutes of work per
§24.11. It's good enough for its one product job (tinting English spans ochre so the
code-switching is visible on screen), but not good enough to produce a trustworthy CMI. **CMI is
therefore computed in the benchmark harness, on gold text, not in the product.** A heuristic LID
yields CMI with unknown error, which would make CMI-Δ meaningless.

### ⬜ The extraction model's confidence scores are not usable as confidence

**This weakens one of the three verification layers, so it's stated first.**

`nex-agi/nex-n2.5-pro:free` returns nearly every item at **0.97–0.99** regardless of how ambiguous
the utterance is. A calibration rubric was added to the prompt and didn't move it.

The consequence is specific. §10.5's amber band (0.60–0.84) is what triggers the **per-item CHP
confirmation** that is verification layer 2 of three (§11.9). With almost everything landing green,
that layer rarely engages on its own. Human verification then rests on the CHP's own reading of the
evidence cards and on the back-read to the mother, which means layers 2 and 3 end up collapsing
into each other.

It's not universal: shorter, genuinely ambiguous utterances have produced 0.84 in live runs, and
the amber path does work when it fires. But it fires less often than the design assumes.

**This is the single strongest argument for moving to a stronger extraction model before
submission.** See `docs/llm-selection.md`.

### ⬜ The extraction model over-extracts, and code has to catch it

Given one rumination sentence, the model returned **five GAD-7 items** (1, 2, 3, 4, and 5), four of
them quoting the same clause, all at severity 2. Unchecked, that's GAD-7 = 10, a "moderate" band
manufactured from a single sentence, and a band routes a real referral.

Prompt instructions didn't fix it; a second attempt produced six items. The **span-overlap
backstop** in `lib/extraction/validate.ts` now demotes items whose evidence overlaps an existing
item by ≥60%, turning them into probe targets rather than scores.

To be clear about the limit here, it's the same shape as the somatic backstop: it only catches
*overlapping* over-extraction. A model that invented three constructs from three genuinely
different clauses of one sentence would pass it. This reduces the problem. It doesn't eliminate it.

### ⬜ The extraction LLM is a free-tier stopgap

The build spec (§17.1) recommends Claude Sonnet at `temperature = 0`, because structured-output
reliability is the binding requirement. This build runs a free tier while the provider is decided.

Consequences:
- **Schema violations will be more frequent.** The architecture handles this (schema enforced in
  code, one retry, then the turn is marked `extraction_failed` and the CHP gets a manual path), but
  expect more failed turns than with a stronger model.
- **Free tiers commonly train on submitted data.** Acceptable here only because no real patient
  audio enters this build at all. It would not be acceptable in a pilot.
- **xAI Grok was the first choice and isn't usable**: the key authenticates but the account has no
  credits (`403 permission-denied`). It's not free without purchase.
- **Model ids churn.** `x-ai/grok-4-fast:free` was deprecated between being written as the default
  and first being called. Re-run `npx tsx scripts/compare-llms.ts` rather than guessing a
  replacement.

Switching provider is one environment variable (`LLM_PROVIDER`); no call site changes.

### ⬜ Generated clinical text needed three corrections, found by reading the output

Each was caught by inspecting a real handover rather than by a test, and each is now constrained:

1. **A fabricated escalation line.** On a screening with no escalation, the model wrote *"Safety
   escalation: routine CHP follow-up and re-screen at the next scheduled visit."* To a clinician
   skimming in fifteen seconds that reads as though an escalation occurred. The model is now told
   nothing about escalation status at all. That fact is carried only by the deterministic header,
   which can't hedge or invent it.
2. **A false cut-off.** It wrote *"Using PHQ-9 (0–27), cut-off 3"*. The threshold of 3 belongs to
   PHQ-2 and GAD-2 only. Now explicitly forbidden.
3. **Glosses that were questionnaire item names, not translations.** *"mawazo mengi sana"
   [Worrying about many things]*, the GAD-7 item label, not a translation of what she actually
   said. Caused by our own prompt placing the construct label beside the quote. FR-21's gloss is a
   translation of HER WORDS; this is now stated with a worked example.

**The general lesson, which applies to whatever model is used next:** generated clinical prose
needs reading, not just schema-checking. None of these three would have failed a JSON validator.

### ⬜ Sahara's transcript field name is inferred, not confirmed

`lib/asr/sahara.ts` looks through the plausible response keys and **throws with the observed key
list** if none matches, rather than returning an empty string. An empty transcript would mean "she
said nothing," a different claim from "the call failed." Confirm with
`npm run smoke:sahara -- <file>` against a real key.

---

## 4. Unresolved external facts

Things we couldn't verify, and don't assert:

| Item | Status |
|---|---|
| **1199 may be Safaricom-only** | A third-party claim we couldn't verify. It would be clinically material on any other network. The card ships with the caveat *"Ikikataa, jaribu 1190"* and the facility number sits above it. **Resolve before any pilot, arguably before the demo.** |
| **One2One 1190 call cost** | Not stated by the provider. Displayed as "cost unknown" rather than guessed. |
| **Mathari National Teaching and Referral Hospital** | `mathari.go.ke` returns an empty document, and no number is verifiable from any official source. This is Kenya's main public psychiatric referral hospital, and we can't verify a contact for it. **This is the single biggest gap in the referral pathway.** |
| **GAD-7 Swahili cut-offs** | Couldn't retrieve. We don't state them. GAD-2 ≥3 is used, matching the IPMH trial. |
| **EPDS electronic-use licensing** | Genuinely unresolved. The sole authority for the claimed restriction is an unpublished 2013 personal communication. EPDS is excluded from the MVP rather than risked. |
| **PPB medical-device classification** | No published Kenyan guidance on Software as a Medical Device found. A screening tool that doesn't diagnose should land in a lower class under IMDRF/WHO logic, but that's reasoning by analogy and needs a written opinion. |

---

## 5. What a real pilot needs that this does not have

So it's clear these boundaries are a choice, not an oversight:

1. **In-country processing.** Digital Health Act s.47. Either a Kenya-region agreement with Intron
   or on-device ASR.
2. **ODPC registration** as data controller and processor, plus a completed DPIA.
3. **A licensed healthcare provider in the legal chain.** Neither the DPA nor the Digital Health
   Act permits a technology company to process health data on its own account.
4. **NACOSTI licence + accredited IRB** + county health research approval.
5. **DHA certification**, a live nine-stage pipeline.
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
- **Not MOH-endorsed.** The instrument choice is aligned with MOH's January 2025 perinatal
  handbook. MOH has not endorsed PHQ-9 as a national instrument, and we must not imply it has.
- **Not validated.** No criterion-validated Swahili PHQ-9 exists for a perinatal population. The
  result screen says so, in Kiswahili, to the person reading it aloud.
- **Not a prevalence measure.** Instrument choice moves measured prevalence roughly fourfold in the
  same Kenyan women (Larsen 2023). Any number this product produces is an artefact of instrument
  and cut-off as much as of burden.

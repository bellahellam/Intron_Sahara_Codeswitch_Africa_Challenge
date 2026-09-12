# MAMA-SAUTI

**A Community Health Promoter's conversational screening assistant.** It listens to a Kenyan
mother describe how she has been feeling since giving birth, in her own natural mix of Kiswahili
and English, and turns that conversation into a completed, evidence-linked PHQ-9 / GAD-7 screening
record with a routed referral — without ever asking her to answer a translated questionnaire item.

Built for the **Intron Sahara CodeSwitch Africa Challenge**, Health track.

> **This is not a diagnosis.** It is an initial screening that supports a referral. See
> [LIMITATIONS.md](LIMITATIONS.md) for everything this product does not do, does not know, and has
> not verified.

---

## The problem, in one paragraph

Patients in the Global South rarely say "I am depressed." They use somatic idioms — *kichwa
inauma*, *kuchoka moyo*, *mawazo mengi* — and standard medical models read those as purely physical
complaints, producing painkillers instead of a referral. Meanwhile the speech interface itself
loses the evidence: on code-switched Swahili, ASR systematically **deletes the embedded English**,
and in this setting the English is where the affective vocabulary lives (*"niko na stress"*, *"I
can't cope"*). So the two failures compound. The idiom is misread, and the words that would have
corrected the misreading are gone before anything gets to read them.

MAMA-SAUTI's contribution is that it **asks the second question**. When a mother reports a physical
symptom with no psychological content, the system is structurally prevented from scoring a
psychological construct. It probes instead, in her own words.

## What makes it agentic rather than a transcription demo

It maintains **coverage state** across turns — which of the 16 PHQ-9/GAD-7 constructs are
evidenced, which were denied, which were asked about and not answered — and on every turn it
chooses one of three actions: `PROBE`, `ESCALATE`, or `COMPLETE`. When it probes, it generates one
question targeting the highest-value uncovered construct, phrased in the mother's own register,
using her own vocabulary.

The *choice* of action is made in code, deterministically. A model is used only to phrase a
question once that choice is made, and to write two summaries. **Scoring and referral routing
contain no model at all** — a clinical score produced by an LLM is not defensible.

---

## Architecture

```
CHP's Android browser ──── audio (WebM/Opus) ───▶ Next.js route handler
                                                    │
                                          0. CONSENT GATE (server-side)
                                                    │
                                          1. Sahara v2.5, lang="sw"
                                             corrections OFF
                                                    │
                                          2. token LID · cps · deletion check
                                                    │
                                          3. SAFETY SCAN ───────▶ ESCALATE
                                             deterministic, NO MODEL   (short-circuits)
                                                    │
                                          4. extraction (LLM, strict JSON, temp 0)
                                                    │
                                          5. span validation · known-prompt
                                             suppression · somatic backstop
                                                    │
                                          6. coverage → decide()
                                                    │
                                          7. score() · route_referral()
                                             PURE, DETERMINISTIC
                                                    │
                                              Postgres/SQLite
                                              (audio never written)
```

**The ordering guarantee**: the safety path completes before extraction is dispatched, never after
it and never in parallel. `lib/agent/orchestrator.ts` returns early on a hit; that early return is
the point of the function.

### Five design decisions worth defending

1. **Sahara runs with LLM corrections OFF.** The API default applies an undisclosed LLM
   post-processor. We turn it off, because every score here is justified by a verbatim quote that
   is read back to the mother — a quote from a smoothed rewrite is not her words — and because a
   correcting LLM upstream of the safety scan would mean the scan is no longer deterministic.

2. **The safety scan contains no model.** Bilingual lexicon, token-level fuzzy match on the raw
   transcript, before extraction, always. It **fails closed**: a scan that throws or times out is
   treated as a hit, not as a pass.

3. **Every `evidence_span` must be a literal substring of the transcript.** Violations drop the
   item and log. Not repaired, not fuzzy-matched. Dropped. One explicit exception: a failed span on
   the top-level risk flag suppresses the *quote*, never the *flag*.

4. **The item-9 gate.** No path through `decide()` can return `COMPLETE` while PHQ-9 #9 is
   uncovered — not even the negative short path. Suicidal ideation is not conditional on a positive
   depression screen, and a low-scoring screen is the population where an unasked question is most
   dangerous. There is an exhaustive unit test for this.

5. **Escalation is latched.** Referral routing reads the escalation *event*, not the current item
   list. The CHP can remove a disputed item and the score recomputes — the tier does not fall.

---

## Running it

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` — at minimum `SAHARA_API_KEY` and one LLM key. `DATABASE_URL` lives in `.env`
because the Prisma CLI does not read `.env.local`. Neither file is committed.

```bash
npm run db:push
```

```bash
npm run dev
```

### Prove the external dependencies before building on them

```bash
npm run smoke:sahara -- path/to/audio.wav
```

```bash
npm run smoke:llm
```

The Sahara smoke test prints the response shape on failure rather than returning an empty string,
because an empty transcript means "she said nothing" and a failed call means "we do not know what
she said" — conflating those two silently loses a turn from a screening record.

### Walking the acceptance scenarios without spending credits

```bash
ASR_PROVIDER=mock ASR_MOCK_FIXTURE=riskHedged npm run dev
```

Fixtures are the §5.3 reference utterances: `rumination`, `somatic`, `anhedonia`, `appetite`,
`sleep`, `psychomotor`, `hedged`, `numbers`, `riskHedged`, `riskExplicit`, `denial`. `mock` must be
set explicitly, so a demo can never silently run on fixtures.

### Tests

```bash
npm test
```

---

## Repository map

| Path | What is in it |
|---|---|
| `lib/clinical/` | `score`, band tables, `route_referral`, coverage state, `decide`. **No model, no I/O.** |
| `lib/safety/` | The deterministic scan, the lexicon loaders, the FR-24a output denylist |
| `lib/extraction/` | The JSON schema (Contract 2), the prompt, the three validation layers |
| `lib/codeswitch/` | Token LID, chars-per-second, the deletion detector, fuzzy idiom matching |
| `lib/asr/` | Contract 1 — `ASRAdapter`, `SaharaAdapter`, the fixture adapter, the retry policy |
| `lib/llm/` | Contract 2b — `LLMAdapter` and the provider presets |
| `lib/agent/` | The orchestrator, probe generation, the two generated summaries |
| `lib/copy.ts` | **Every user-visible Kiswahili string**, in one file, for native-speaker review |
| `data/` | The lexicons and the fixed item-9 probe — CSV and txt, so a clinician can review them without reading TypeScript |
| `docs/contracts.md` | The two frozen interface contracts |
| `bench/` | The Python benchmark harness *(not yet built)* |

## Documents

- [LIMITATIONS.md](LIMITATIONS.md) — what this does not do, does not know, and has not verified
- [docs/contracts.md](docs/contracts.md) — the frozen interfaces
- [MAMA-SAUTI-Build-Spec.md](MAMA-SAUTI-Build-Spec.md) — the full product specification

## Licensing and attribution

- **PHQ-9 / PHQ-2 / GAD-7 / GAD-2** are free to use, verified at
  [phqscreeners.com/terms](https://www.phqscreeners.com/terms).
- **`data/idiom_lexicon.csv`** is our compilation from published literature with per-row citations,
  released **CC BY 4.0** as a contribution back to the field.
- **AfriSwitchCare / AfriSwitch** are CC BY-NC-SA 4.0 and gated. We evaluate on them and do not
  redistribute their audio.

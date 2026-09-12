# MAMA-SAUTI

**A Community Health Promoter's conversational screening assistant.** It listens to a Kenyan
mother describe how she has been feeling since giving birth, in her own natural mix of Kiswahili
and English, and turns that conversation into a completed, evidence-linked PHQ-9 / GAD-7 screening
record with a routed referral — without ever asking her to answer a translated questionnaire item.

Built for the **Intron Sahara CodeSwitch Africa Challenge**, Health track.

> **This is not a diagnosis.** It is an initial screening that supports a referral. See
> [LIMITATIONS.md](LIMITATIONS.md) for everything this product does not do, does not know, and has
> not verified — including the parts that are not finished.

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

# Getting it running

## 1. Prerequisites

| Need | Version | Check with |
|---|---|---|
| **Node.js** | 20 or newer (built on 22) | `node -v` |
| **npm** | 10 or newer | `npm -v` |
| **git** | any | `git --version` |

No database server is needed. It runs on a local SQLite file out of the box.

**Python 3.11+** is needed only for the benchmark harness (`bench/`), which is not built yet.

## 2. Clone and install

```bash
git clone https://github.com/bellahellam/Intron_Sahara_Codeswitch_Africa_Challenge.git
```

```bash
cd Intron_Sahara_Codeswitch_Africa_Challenge && npm install
```

## 3. Get the two API keys

| Key | Where from | Free? | Needed for |
|---|---|---|---|
| `SAHARA_API_KEY` | [intron.io](https://www.intron.io/) — Sahara v2.5 speech API | Competition allowance | Transcription. **Required.** |
| One LLM key | See the table below | Yes | Extraction, probes, summaries |

**For the LLM, any one of these works** — they all go through the same adapter, so switching is one
environment variable and no code change:

| Provider | `LLM_PROVIDER` | Key variable | Notes |
|---|---|---|---|
| **OpenRouter** | `openrouter` | `OPENROUTER_API_KEY` | What this build was developed against. Free tier reaches `:free` models. |
| **Google Gemini** | `gemini` | `GOOGLE_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Genuinely free, no card, server-enforced JSON schema. Recommended if OpenRouter's free models degrade. |
| Groq | `groq` | `GROQ_API_KEY` | Free, fast |
| Cerebras | `cerebras` | `CEREBRAS_API_KEY` | Free tier |
| Mistral | `mistral` | `MISTRAL_API_KEY` | Free tier |
| OpenAI | `openai` | `OPENAI_API_KEY` | Paid |

⚠️ **xAI (`xai`) authenticates but is not free** — a new team has no credits and every call returns
`403 permission-denied`.

## 4. Configure

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in `SAHARA_API_KEY` plus your chosen LLM key. The minimum working file:

```
SAHARA_API_KEY=<your intron key>
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=<your openrouter key>
```

**Two env files, on purpose:** `.env` holds `DATABASE_URL` because the Prisma CLI does not read
`.env.local`; `.env.local` holds every actual secret. Both are gitignored. `.env` is created for
you by the next step if it does not exist.

## 5. Create the database

```bash
npm run db:push
```

This writes `prisma/dev.db` (SQLite) and generates the Prisma client. **To use Postgres instead**
(Neon, Supabase): change `provider` to `postgresql` in `prisma/schema.prisma`, change every
`String` field whose name ends in `Json` to `Json`, point `DATABASE_URL` at your instance, and
re-run. No application code changes — all JSON marshalling goes through `lib/db.ts`.

## 6. Prove the external services before trusting them

Do this before reporting that "the app is broken" — it isolates a bad key from a bad build.

```bash
npm run smoke:llm
```

Expect: `schema: VALID`, then extracted items each marked `span is literal substring: yes`.

```bash
npm run smoke:sahara -- path/to/any-audio.wav
```

Any WAV, MP3, M4A, OGG, WebM or FLAC works — a phone voice note is fine. Expect a transcript and a
latency figure.

> The Sahara smoke test **throws with the observed response keys** rather than returning an empty
> string if the transcript field is missing. That is deliberate: an empty transcript would mean
> "she said nothing", and a failed call means "we do not know what she said". Conflating those two
> silently loses a turn from a screening record.

## 7. Run it

```bash
npm run dev
```

Open **http://localhost:3000**. Use your browser's device toolbar at **360×640** — the layout
target is a mid-range Android, and that is the width it is verified at.

**Walking the flow:** enter any CHP code (e.g. `KWG-014`) → `Anza uchunguzi` → type a name →
`Amekubali` on the consent screen → tap the record control and speak → evidence cards appear →
`Maliza` → confirm amber items → back-read → `Tuma rufaa`.

The browser will ask for microphone permission at the first record tap, in context — never at
launch.

## 8. Testing without spending Sahara credits

A fixture ASR adapter replays the reference utterances from the spec, so the acceptance scenarios
can be walked through the real UI for free:

```bash
ASR_PROVIDER=mock ASR_MOCK_FIXTURE=riskHedged npm run dev
```

Available fixtures: `rumination`, `somatic`, `anhedonia`, `appetite`, `sleep`, `psychomotor`,
`hedged`, `numbers`, `riskHedged`, `riskExplicit`, `denial`.

`riskHedged` is the one to try first — it triggers the full-screen escalation interrupt, which is
the most important behaviour in the product and needs no LLM key at all.

**`mock` must be set explicitly**, so a demo can never silently run on fixtures.

## 9. Tests

```bash
npm test
```

76 tests, no network, no API keys needed. They cover the deterministic core: band tables at every
boundary, referral routing, the item-9 gate, the safety scan, span validation and the backstops.

```bash
npm run typecheck
```

```bash
npm run build
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `XAI_API_KEY is not set` (or similar) when you have set it | You edited `.env.example` rather than `.env.local`, or the variable name does not match `LLM_PROVIDER`. |
| `Environment variable not found: DATABASE_URL` | `.env` is missing. Create it with `DATABASE_URL="file:./dev.db"`. |
| `403 permission-denied ... no credits` | The LLM account has no credits. xAI is not free; switch `LLM_PROVIDER` to `openrouter` or `gemini`. |
| `404 ... is deprecated` from OpenRouter | Free model ids churn. Run `npx tsx scripts/list-openrouter-free.ts`, then `npx tsx scripts/compare-llms.ts` to pick a replacement by measurement. Do not guess one. |
| `EPERM ... query_engine-windows.dll.node` on build | The dev server has the Prisma engine locked. Stop it, then build. |
| Recording does nothing | `MediaRecorder` needs a secure context. `localhost` is fine; a plain-http LAN address is not. |
| Extraction says it failed | Expected occasionally on free models. The turn is marked `extraction_failed` and the CHP gets a manual path — the screening is not lost. Frequent failures mean it is time for a better model. |

## Useful scripts

| Command | What it does |
|---|---|
| `npx tsx scripts/list-openrouter-free.ts` | Lists currently-free OpenRouter models and which support strict JSON schema |
| `npx tsx scripts/compare-llms.ts` | Scores candidate models on the real extraction task — schema validity, literal spans, somatic and risk calls |
| `npx tsx scripts/check-openrouter-credits.ts` | Shows key tier and usage |
| `npm run derive:floor` | Derives the deletion-detector threshold from AfriSwitchCare gold transcripts *(not yet implemented)* |

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
                                             suppression · somatic backstop ·
                                             span-overlap backstop
                                                    │
                                          6. coverage → decide()
                                                    │
                                          7. score() · route_referral()
                                             PURE, DETERMINISTIC
                                                    │
                                              SQLite / Postgres
                                              (audio never written)
```

**The ordering guarantee**: the safety path completes before extraction is dispatched, never after
it and never in parallel. `lib/agent/orchestrator.ts` returns early on a hit; that early return is
the point of the function.

### Six design decisions worth defending

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

6. **Backstops run in code, because a model policing its own output is not enforcement.** The
   somatic-only rule, known-prompt suppression and the span-overlap limiter all run after
   extraction, deterministically. Each was added because the model got it wrong in a live run.

## Repository map

| Path | What is in it |
|---|---|
| `lib/clinical/` | `score`, band tables, `route_referral`, coverage state, `decide`. **No model, no I/O.** |
| `lib/safety/` | The deterministic scan, the lexicon loaders, the FR-24a output denylist |
| `lib/extraction/` | The JSON schema (Contract 2), the prompt, the validation backstops |
| `lib/codeswitch/` | Token LID, chars-per-second, the deletion detector, fuzzy idiom matching |
| `lib/asr/` | Contract 1 — `ASRAdapter`, `SaharaAdapter`, the fixture adapter, the retry policy |
| `lib/llm/` | Contract 2b — `LLMAdapter` and the provider presets |
| `lib/agent/` | The orchestrator, probe generation, the two generated summaries |
| `lib/copy.ts` | **Every user-visible Kiswahili string**, in one file, for native-speaker review |
| `data/` | The lexicons and the fixed item-9 probe — CSV and txt, so a clinician can review them without reading TypeScript |
| `docs/contracts.md` | The two frozen interface contracts |
| `docs/llm-selection.md` | How the extraction model was chosen, and what it still gets wrong |
| `bench/` | The Python benchmark harness *(not yet built)* |

## Documents

- [LIMITATIONS.md](LIMITATIONS.md) — what this does not do, does not know, and has not verified
- [docs/contracts.md](docs/contracts.md) — the frozen interfaces
- [docs/llm-selection.md](docs/llm-selection.md) — model choice by measurement
- [MAMA-SAUTI-Build-Spec.md](MAMA-SAUTI-Build-Spec.md) — the full product specification

## Licensing and attribution

- **PHQ-9 / PHQ-2 / GAD-7 / GAD-2** are free to use, verified at
  [phqscreeners.com/terms](https://www.phqscreeners.com/terms).
- **`data/idiom_lexicon.csv`** is our compilation from published literature with per-row citations,
  released **CC BY 4.0** as a contribution back to the field.
- **AfriSwitchCare / AfriSwitch** are CC BY-NC-SA 4.0 and gated. We evaluate on them and do not
  redistribute their audio.

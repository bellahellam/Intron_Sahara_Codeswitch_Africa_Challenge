# MAMA-SAUTI

**A Community Health Promoter's conversational screening assistant.** It listens to a Kenyan
mother describe how she has been feeling since giving birth, in her own natural mix of Kiswahili
and English, and turns that conversation into a completed, evidence-linked PHQ-9 / GAD-7 screening
record with a routed referral, without ever asking her to answer a translated questionnaire item.

Built for the **Intron Sahara CodeSwitch Africa Challenge**, Health track.

> **This is not a diagnosis.** It is an initial screening that supports a referral. See
> [LIMITATIONS.md](LIMITATIONS.md) for everything this product does not do, does not know, and has
> not verified, including the parts that are not finished.

---

## The problem, in one paragraph

Patients in the Global South rarely say "I am depressed." They use somatic idioms (*kichwa inauma*,
*kuchoka moyo*, *mawazo mengi*), and standard medical models read those as purely physical
complaints, producing painkillers instead of a referral. Meanwhile the speech interface itself
loses the evidence: on code-switched Swahili, ASR systematically **deletes the embedded English**,
and in this setting the English is where the affective vocabulary lives (*"niko na stress"*, *"I
can't cope"*). So the two failures compound. The idiom is misread, and the words that would have
corrected the misreading are gone before anything gets to read them.

MAMA-SAUTI's contribution is that it **asks the second question**. When a mother reports a physical
symptom with no psychological content, the system is structurally prevented from scoring a
psychological construct. It probes instead, in her own words.

## What makes it agentic rather than a transcription demo

It maintains **coverage state** across turns, tracking which of the 16 PHQ-9/GAD-7 constructs are
evidenced, which were denied, and which were asked about and not answered, and on every turn it
chooses one of three actions: `PROBE`, `ESCALATE`, or `COMPLETE`. When it probes, it generates one
question targeting the highest-value uncovered construct, phrased in the mother's own register,
using her own vocabulary.

The *choice* of action is made in code, deterministically. A model is used only to phrase a
question once that choice is made, and to write two summaries. **Scoring and referral routing
contain no model at all.** A clinical score produced by an LLM is not defensible.

---

# Getting it running

## 1. Prerequisites

| Need | Version | Check with |
|---|---|---|
| **Node.js** | 20 or newer (built on 22) | `node -v` |
| **npm** | 10 or newer | `npm -v` |
| **git** | any | `git --version` |

No database server is needed. It runs on a local SQLite file out of the box.

**Python 3.11+** is needed for the benchmark harness (`bench/`). A CUDA GPU makes the local
model rows practical but is not required, see the benchmark section.

## 2. Clone and install

```bash
git clone https://github.com/bellahellam/Intron_Sahara_Codeswitch_Africa_Challenge.git
```

```bash
cd Intron_Sahara_Codeswitch_Africa_Challenge && npm install
```

## 3. Get the API keys

| Key | Where from | Free? | Needed for |
|---|---|---|---|
| `SAHARA_API_KEY` | [intron.io](https://www.intron.io/), Sahara v2.5 speech API | Competition allowance | Transcription. **Required.** |
| One LLM key | See the table below | Yes | Extraction, probes, summaries |

**For the LLM, any one of these works.** They all go through the same adapter, so switching is one
environment variable and no code change:

| Provider | `LLM_PROVIDER` | Key variable | Notes |
|---|---|---|---|
| **OpenRouter** | `openrouter` | `OPENROUTER_API_KEY` | What this build was developed against. Free tier reaches `:free` models. |
| **Google Gemini** | `gemini` | `GOOGLE_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Genuinely free, no card, server-enforced JSON schema. Recommended if OpenRouter's free models degrade. |
| Groq | `groq` | `GROQ_API_KEY` | Free, fast |
| Cerebras | `cerebras` | `CEREBRAS_API_KEY` | Free tier |
| Mistral | `mistral` | `MISTRAL_API_KEY` | Free tier |
| OpenAI | `openai` | `OPENAI_API_KEY` | Paid |

⚠️ **xAI (`xai`) authenticates but is not free.** A new team has no credits and every call returns
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
HF_TOKEN=<your hugging face token>        # benchmark only
ADMIN_TOKEN=<any passphrase you choose>   # unlocks /admin
```

**Two env files, on purpose:** `.env` holds `DATABASE_URL` because the Prisma CLI does not read
`.env.local`; `.env.local` holds every actual secret. Both are gitignored. `.env` is created for
you by the next step if it does not exist.

`HF_TOKEN` needs approved access to the two gated Intron datasets, request it on Hugging Face at
[intronhealth/AfriSwitchCare](https://huggingface.co/datasets/intronhealth/AfriSwitchCare) and
[intronhealth/AfriSwitch](https://huggingface.co/datasets/intronhealth/AfriSwitch). Approval is not
instant, so ask early.

## 5. Create the database

```bash
npm run db:push
```

This writes `prisma/dev.db` (SQLite) and generates the Prisma client. **To use Postgres instead**
(Neon, Supabase): change `provider` to `postgresql` in `prisma/schema.prisma`, change every
`String` field whose name ends in `Json` to `Json`, point `DATABASE_URL` at your instance, and
re-run. No application code changes; all JSON marshalling goes through `lib/db.ts`.

## 6. Prove the external services before trusting them

Do this before reporting that "the app is broken." It isolates a bad key from a bad build.

```bash
npm run smoke:llm
```

Expect: `schema: VALID`, then extracted items each marked `span is literal substring: yes`.

```bash
npm run smoke:sahara -- path/to/any-audio.wav
```

Any WAV, MP3, M4A, OGG, WebM or FLAC works, a phone voice note is fine. Expect a transcript and a
latency figure.

> The Sahara smoke test **throws with the observed response keys** rather than returning an empty
> string if the transcript field is missing. That is deliberate: an empty transcript would mean
> "she said nothing", and a failed call means "we do not know what she said". Conflating those two
> silently loses a turn from a screening record.

## 7. Run it

```bash
npm run dev
```

Open **http://localhost:3000**. Use your browser's device toolbar at **360×640**. The layout
target is a mid-range Android, and that's the width it's verified at.

### The two views

| | |
|---|---|
| **`/`**: the CHP view | What a community health worker sees. No confidence numbers, no latencies, no model names. She taps **once** to start listening and **once** when the visit ends |
| **`/admin`**: the technical view | Pipeline telemetry, audit trail, live model config, and the canaries. Unlocked with `ADMIN_TOKEN` |

**Walking a screening:** enter any CHP code (e.g. `KWG-014`) → `Anza uchunguzi` → type a name →
`Amekubali` on the consent screen → tap **Anza kusikiliza** → talk normally → evidence cards appear
as segments close on silence → `Maliza` → confirm amber items → back-read → `Tuma rufaa`.

Capture is hands-free by design. She does not press anything between turns; segments close
automatically after about two seconds of silence. Asking a health worker to reach for a phone
mid-conversation, possibly mid-disclosure, costs more in care than it buys in tidy audio.

The browser asks for microphone permission at the first tap, in context, never at launch.

> `/admin` is gated by a shared passphrase, **not authentication**. It keeps the technical surface
> off a CHP's phone and gates a demo view. A CHP code is an identifier, not a secret (§14.5). Real
> auth is pilot work.

## 8. Testing without spending Sahara credits

A fixture ASR adapter replays the reference utterances from the spec, so the acceptance scenarios
can be walked through the real UI for free:

```bash
ASR_PROVIDER=mock ASR_MOCK_FIXTURE=riskHedged npm run dev
```

Available fixtures: `rumination`, `somatic`, `anhedonia`, `appetite`, `sleep`, `psychomotor`,
`hedged`, `numbers`, `riskHedged`, `riskExplicit`, `denial`.

`riskHedged` is the one to try first. It triggers the full-screen escalation interrupt, which is
the most important behaviour in the product and needs no LLM key at all.

**`mock` must be set explicitly**, so a demo can never silently run on fixtures. The admin view
shows a loud red warning whenever it is active.

## 9. Tests

```bash
npm test
```

123 tests, no network, no API keys needed. The deterministic core: band tables at every boundary,
referral routing, the item-9 gate, the safety scan, span validation, the backstops, and the §26
acceptance scenarios.

```bash
npx tsx scripts/acceptance-live.ts
```

13 more that need a running server: the consent gate, the consent-bypass attempt, withdrawal.
Start `npm run dev` in another terminal first.

```bash
npm run typecheck
```

```bash
npm run build
```

---

# Running the benchmark

It answers one question: **does ASR quality on code-switched Swahili change the clinical decision
this product makes?** Not "which model has the lowest WER".

## Setup

```bash
pip install datasets jiwer pandas httpx soundfile numpy huggingface_hub faster-whisper
```

`faster-whisper` is what makes Whisper large-v3 fit a small GPU: int8 quantisation brings it from
roughly 10 GB to roughly 3 GB. Without it the harness falls back to `transformers`, which needs
more VRAM. Your `HF_TOKEN` must have approved access to the gated datasets (step 4).

## The models

| Key | What it is | Needs |
|---|---|---|
| `sahara-off` | Sahara v2.5, LLM corrections **off** | Intron credits |
| `sahara-on` | Sahara v2.5, corrections **on** (API default) | Intron credits |
| `whisper-sw` | Whisper large-v3, `language="sw"` forced | GPU, no API |
| `whisper-auto` | Whisper large-v3, auto-detect | GPU, no API |
| `jacaranda` | Jacaranda-Health/ASR-STT, the regional incumbent | GPU, no API |

`sahara-off` is the primary column **and** the configuration the product ships. `sahara-on` is
reported separately to quantify what the undisclosed post-processor contributes. Most teams will
benchmark the API default and not notice they are measuring an ASR model plus a hidden LLM.

Whisper runs in **both** conditions deliberately. Forcing `sw` versus letting it auto-detect is
what exposes whether the most widely used ASR model collapses code-switched audio into a single
language. That is the thesis, tested on the model everyone reaches for.

Jacaranda matters most of the three local rows: it is whisper-medium fine-tuned Swahili+English by
the organisation running maternal-health messaging for roughly 3M Kenyan mothers. If Sahara does
not beat the regional incumbent on our task, that is a finding worth publishing.

## Run it

Start with one conversation to check the plumbing:

```bash
python -m bench.run --models sahara-off --limit 1
```

Then the full run:

```bash
python -m bench.run --models sahara-off,sahara-on,whisper-sw,whisper-auto,jacaranda
```

```bash
python -m bench.report
```

**Budget the time.** Sahara is rate-limited to 30 requests/minute and the harness paces itself:
roughly 30 minutes per Sahara configuration. Whisper large-v3 on a small GPU runs about 1.7×
realtime, so roughly 2.5 hours per condition for the 1.54 hours of audio. Jacaranda is faster.

The runner **writes incrementally and aborts immediately if the Sahara balance runs out**, so a
long run that dies partway keeps every conversation it already transcribed.

## What it produces

| Path | What |
|---|---|
| `results/afriswitchcare_sw/<model>.csv` | Every hypothesis transcript. Every number is auditable back to one of these |
| `results/afriswitchcare_sw/metrics_per_sample.csv` | Every metric, every conversation |
| `results/afriswitchcare_sw/metrics_summary.csv` | Per-model aggregates |
| `report/BENCHMARK.md` | The written report |
| `data/benchmark_results.json` | What the in-product "Kwa nini Sahara?" page renders |

## The metrics, and why Tier 2 exists

**Tier 1**: WER, CER, latency. Standard, for comparability with Intron's published numbers.

**Tier 2 is the contribution.** Intron's own benchmarking repo is *not* a code-switching harness.
Its README says intra-utterance code-switching is "inconsistently annotated," and it computes no
CMI, no switch-point metric, and no per-word LID. These are net-new:

- **EESR**: Embedded-English Span Recall. For each gold `[[EN]]` span, did its tokens survive?
  Directly measures switch-boundary deletion, which aggregate WER structurally cannot see.
- **EESR-clinical**: the same, restricted to spans containing an affective term (`stress`,
  `depressed`, `worry`…). The general number can look healthy while this subset collapses, and the
  subset is what determines whether the product works.
- **CIR**: Clinical Idiom Recall, the Kiswahili half of the same question.
- **SPR**: Safety-Phrase Recall, reported **seen** and **held-out** separately, never merged.
- **CMI-Δ**: does the model preserve the structure of switching, or flatten it?

**Tier 3**: construct F1, |ΔPHQ-9|, **band-flip**, tier-flip. **Deliberately not computed on
AfriSwitchCare**, where it is degenerate by construction: 12 conversations across 12 conditions,
one of them depression, so eleven gold PHQ-9 totals sit near zero and no transcription error can
move a band. Tier 3 needs field set C; see below.

## Deriving the deletion threshold

```bash
python -m bench.derive_floor
```

Computes the 5th percentile of chars-per-second across the 12 gold transcripts, subtracts a safety
margin, and writes `data/deletion_floor.json`. **This is the one number that crosses from the
benchmark into the live product.** Do not hardcode a guess. The product reports `calibrated: false`
and says so on screen until this has actually run.

---

# Tasks that need a human

Three things no amount of code closes, all running on someone else's clock:

1. **Clinician review** of the safety lexicon (49 rows, currently all unreviewed)
2. **Native Kenyan Kiswahili review** of every user-visible string (70 of them)
3. **Recording field set C** (28 clips), which blocks band-flip, the headline metric

```bash
npx tsx scripts/export-reviews.ts
```

produces both review packets as CSV, ready to send to people who will never open this repository.
**[docs/HUMAN-TASKS.md](docs/HUMAN-TASKS.md) has the exact wording to ask them for**, and
`scripts/apply-reviews.ts` folds the answers back in.

Start these first. They are free to request and they block submission.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `XAI_API_KEY is not set` (or similar) when you have set it | You edited `.env.example` rather than `.env.local`, or the variable name does not match `LLM_PROVIDER`. |
| `Environment variable not found: DATABASE_URL` | `.env` is missing. Create it with `DATABASE_URL="file:./dev.db"`. |
| `403 permission-denied ... no credits` | The LLM account has no credits. xAI is not free; switch `LLM_PROVIDER` to `openrouter` or `gemini`. |
| `404 ... is deprecated` from OpenRouter | Free model ids churn. Run `npx tsx scripts/list-openrouter-free.ts`, then `npx tsx scripts/compare-llms.ts` to pick a replacement by measurement. Do not guess one. |
| `EPERM ... query_engine-windows.dll.node` on build | The dev server has the Prisma engine locked. Stop it, then build. |
| Recording does nothing | `MediaRecorder` needs a secure context. `localhost` is fine; a plain-http LAN address is not. |
| Extraction says it failed | Expected occasionally on free models. The turn is marked `extraction_failed` and the CHP gets a manual path; the screening is not lost. Frequent failures mean it is time for a better model. |

## Useful scripts

| Command | What it does |
|---|---|
| `npx tsx scripts/list-openrouter-free.ts` | Lists currently-free OpenRouter models and which support strict JSON schema |
| `npx tsx scripts/compare-llms.ts` | Scores candidate models on the real extraction task: schema validity, literal spans, somatic and risk calls |
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
   is read back to the mother, and a quote from a smoothed rewrite is not her words. Also, a
   correcting LLM upstream of the safety scan would mean the scan is no longer deterministic.

2. **The safety scan contains no model.** Bilingual lexicon, token-level fuzzy match on the raw
   transcript, before extraction, always. It **fails closed**: a scan that throws or times out is
   treated as a hit, not as a pass.

3. **Every `evidence_span` must be a literal substring of the transcript.** Violations drop the
   item and log. Not repaired, not fuzzy-matched. Dropped. One explicit exception: a failed span on
   the top-level risk flag suppresses the *quote*, never the *flag*.

4. **The item-9 gate.** No path through `decide()` can return `COMPLETE` while PHQ-9 #9 is
   uncovered, not even the negative short path. Suicidal ideation is not conditional on a positive
   depression screen, and a low-scoring screen is the population where an unasked question is most
   dangerous. There is an exhaustive unit test for this.

5. **Escalation is latched.** Referral routing reads the escalation *event*, not the current item
   list. The CHP can remove a disputed item and the score recomputes; the tier does not fall.

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
| `lib/asr/` | Contract 1: `ASRAdapter`, `SaharaAdapter`, the fixture adapter, the retry policy |
| `lib/llm/` | Contract 2b: `LLMAdapter` and the provider presets |
| `lib/agent/` | The orchestrator, probe generation, the two generated summaries |
| `lib/copy.ts` | **Every user-visible Kiswahili string**, in one file, for native-speaker review |
| `data/` | The lexicons and the fixed item-9 probe (CSV and txt), so a clinician can review them without reading TypeScript |
| `docs/contracts.md` | The two frozen interface contracts |
| `docs/llm-selection.md` | How the extraction model was chosen, and what it still gets wrong |
| `bench/` | The Python benchmark harness: adapters, metrics, runner, report |
| `scripts/` | Smoke tests, model comparison, review-packet export |
| `review/` | Generated review packets for the clinician and Kiswahili reviewer |

## Documents

- [LIMITATIONS.md](LIMITATIONS.md): what this does not do, does not know, and has not verified
- [docs/contracts.md](docs/contracts.md): the frozen interfaces
- [docs/llm-selection.md](docs/llm-selection.md): model choice by measurement
- [docs/HUMAN-TASKS.md](docs/HUMAN-TASKS.md): the three tasks that need a person, with the wording to ask for
- [RESPONSIBLE-AI.md](RESPONSIBLE-AI.md): consent, risk and privacy, and where each is enforced in code
- [MAMA-SAUTI-Build-Spec.md](MAMA-SAUTI-Build-Spec.md): the full product specification

## Licensing and attribution

- **PHQ-9 / PHQ-2 / GAD-7 / GAD-2** are free to use, verified at
  [phqscreeners.com/terms](https://www.phqscreeners.com/terms).
- **`data/idiom_lexicon.csv`** is our compilation from published literature with per-row citations,
  released **CC BY 4.0** as a contribution back to the field.
- **AfriSwitchCare / AfriSwitch** are CC BY-NC-SA 4.0 and gated. We evaluate on them and do not
  redistribute their audio.

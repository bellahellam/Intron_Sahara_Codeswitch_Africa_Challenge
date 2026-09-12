# Choosing the extraction model by measurement

**Date:** 12 September 2026 · **Reproduce with:** `npx tsx scripts/compare-llms.ts`

The build spec (§17.1) recommends Claude Sonnet because structured-output reliability is the
binding requirement. This build runs on a free tier, so the model had to be chosen from what is
actually available — and chosen by testing it on the real task, not by reputation.

## What was tested, and why those things

The hardest constraint in the whole schema is **FR-11: `evidence_span` must be a literal substring
of the transcript.** A model that paraphrases her words fails this product even when its clinical
reasoning is good, because every score is justified by a quote that gets read back to her. So the
ranking is:

1. **Schema-valid JSON at all** — 3 cases
2. **Literal evidence spans** — the eliminator
3. **`somatic_only` on a bodily complaint** — the product's central behavioural claim (§12.4)
4. **`risk_flag` on a *hedged* disclosure** — the cost-asymmetric one
5. Latency

The three cases are the §5.3 reference utterances: rumination, somatic-only, and hedged risk.

## Results

### First run — and why it was mostly measuring my own bugs

| Model | Schema | Literal spans | somatic | risk |
|---|---|---|---|---|
| nvidia/nemotron-3-super-120b-a12b:free | 2/3 | 5/5 | ✗ | ✓ |
| nex-agi/nex-n2.5-pro:free | 1/3 | 2/2 | — | ✓ |
| openrouter/free | 1/3 | 0/0 | — | ✓ |
| dots-studio/dots-3-note-preview:free | 0/3 | — | — | — |
| google/gemma-4-31b-it:free | 0/3 | — | — | — |

Two causes, both mine:

- **No worked example in the prompt.** Nemotron returned the JSON *schema* rather than an
  instance — `"n_index": int` — which is a classic weak-model failure when shown a schema and
  asked for an object.
- **Reasoning models burned the whole token budget before emitting content.** Three models
  returned `content: ""`. The adapter reported "no message content", which was true about the
  response and useless about the cause.

Fixed both: a worked example instance was added to the extraction prompt, and the adapter now
sends `reasoning: { enabled: false }` and distinguishes "spent its budget reasoning" from "said
nothing" in the error message.

### Second run

| Model | Schema | Literal spans | somatic | risk | Latency (3 calls) |
|---|---|---|---|---|---|
| **nex-agi/nex-n2.5-pro:free** | **3/3** | **9/9** | ✓ | ✓ | 21.8 s |
| dots-studio/dots-3-note-preview:free | 3/3 | 8/8 | ✓ | ✓ | 23.2 s |
| nvidia/nemotron-3-super-120b-a12b:free | 3/3 | 9/9 | ✗ | ✓ | 19.6 s |
| google/gemma-4-31b-it:free | 1/3 | 3/3 | ✓ | — | rate-limited (429) |
| openrouter/free | 1/3 | 4/5 | — | — | reasoning cannot be disabled |

**Chosen: `nex-agi/nex-n2.5-pro:free`.** `dots-3-note-preview` is an equally defensible second
choice and is the first thing to try if the primary degrades.

Nemotron is otherwise strong but said `somatic_only: false` on a purely somatic complaint. The
deterministic backstop (§11.4b) caught it — which is exactly what that backstop exists for — but a
model that needs rescuing on the product's central claim is not the one to pick when an equal
alternative gets it right unaided.

## The finding that mattered more than the ranking

**The winning model over-extracts, badly, and no amount of prompting fixed it.**

Given the rumination utterance, it returned **five GAD-7 items — 1, 2, 3, 4 and 5** — four of them
quoting the same clause, every one at severity 2 and confidence ≥0.98. That is GAD-7 = 10, a
"moderate" band, manufactured from one sentence about lying awake worrying. And a band routes a
real referral.

The prompt was given explicit anti-over-extraction instructions and a calibration rubric. The
model produced *six* items on the retry. This is a capability limit, not a prompting problem.

§11.4b had already established the principle for exactly this situation — a rule the model
enforces about its own output is not enforcement — so the fix runs in code: the **span-overlap
backstop** in `lib/extraction/validate.ts`. Items whose evidence spans overlap by ≥60% are
competing readings of the same words; one survives (the most complete quote, which is also the
best thing to read back to her) and the rest are demoted below the population threshold, becoming
probe targets rather than scores.

It deliberately does not collapse genuinely distinct evidence: one utterance can legitimately
evidence sleep disturbance *and* rumination, because those are different clauses. Counting the
same clause five times is the error.

## Known residual weakness

**Confidence calibration is not usable from this model.** Nearly every item comes back at
0.97–0.99 regardless of how ambiguous the utterance is. The rubric in the prompt did not move it.

The consequence is specific and it matters: §10.5's amber band (0.60–0.84) is what triggers the
**per-item CHP confirmation** that is verification layer 2 of three (§11.9). With everything
landing green, that layer rarely engages on its own, and human verification falls back to the
CHP's own reading of the cards plus the back-read to the mother.

This is recorded in `LIMITATIONS.md` and is the single strongest argument for moving to a stronger
model before submission.

## If the model id 404s

Model ids on OpenRouter churn — `x-ai/grok-4-fast:free` was deprecated between writing the default
and first running it. **Re-run `npx tsx scripts/compare-llms.ts` rather than guessing a
replacement.** `npx tsx scripts/list-openrouter-free.ts` prints what is currently free and which
models support `json_schema`.

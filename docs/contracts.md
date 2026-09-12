# MAMA-SAUTI — Interface contracts

**Status:** agreed at T+0 per §24.1b. **Frozen at T+6.** After that, a change requires both sides updated in the same sitting.

There are two contracts, plus one agreement on data file column headers. They exist so the product track and the intelligence/benchmark track can build against each other without blocking.

---

## Contract 1 — `ASRAdapter`

The boundary between the product and any speech model (§17.5). Source of truth: [`lib/asr/types.ts`](../lib/asr/types.ts).

```ts
interface ASRAdapter {
  name: string;                       // "sahara-v2.5-corr-off", "whisper-large-v3-sw", ...
  transcribe(audio: Blob | Buffer, opts: { lang: string }): Promise<{
    text: string;                     // verbatim, no post-processing by us
    latencyMs: number;                // measured at this boundary
    meta: Record<string, unknown>;    // model-specific extras; never read by product logic
  }>;
}
```

Rules that are part of the contract, not implementation detail:

1. **Errors throw typed errors. They never return an empty string.** An empty `text` means "she said nothing"; a failed call means "we do not know what she said". Conflating the two silently loses a turn from a screening record. See `ASRError` and its `kind` discriminant.
2. **The adapter never retries.** Retry policy, backoff and `Retry-After` handling live in the caller, so the benchmark measures raw latency and the product retries on its own terms.
3. **`text` is returned unmodified.** No trimming, no normalisation, no casing changes. Normalisation belongs to the benchmark (§18.7); the safety scan must see raw text (§11.4a rule 2).
4. **Model identifiers use hyphens, never underscores.** Intron's reference harness parses filenames as `file.split("_")` with `model = parts[0]`, so an underscore in a model name silently breaks evaluation (§18.7).
5. Product code imports the interface and the registry, **never a concrete adapter**.

## Contract 2 — the `extraction` JSON object

The boundary between a transcript and the clinical record. **Authoritative shape: §11.3 of the build spec.** Runtime source of truth: [`lib/extraction/schema.ts`](../lib/extraction/schema.ts) (Zod).

Rules that are part of the contract:

1. **Every field is required. There are no optional clinical fields.** A missing field is a schema violation, not a default.
2. **`evidence_span` must be a literal substring of the turn transcript.** The validator (FR-11) runs before any UI sees the object. Violations **drop the item and log**; they are never repaired or fuzzy-matched.
3. **Enumerations are fixed:** `severity_estimate` is an integer 0–3; `confidence` is a float 0–1; `span_language` is one of `sw | en | sheng | unknown`; `construct` is drawn from the fixed list in `lib/clinical/constructs.ts`.
4. **`risk_flag` is top-level, not an item.** Escalation logic reads only that field and the deterministic scan's output — never an item's contents.
5. **Denial and absence are different states.** A construct the mother explicitly denied goes in `constructs_addressed_but_negative`; a construct never reached is simply absent. The coverage strip renders these differently, so the distinction must survive the boundary.
6. **Two fixtures ship with the contract** — one valid, one deliberately invalid — so UI can be built before the model works: [`tests/fixtures/extraction.valid.json`](../tests/fixtures/extraction.valid.json), [`tests/fixtures/extraction.invalid.json`](../tests/fixtures/extraction.invalid.json).

## Contract 2b — `LLMAdapter` (added to this build)

Not in the original spec, which assumed a single provider. The provider is unsettled here (free tiers, revisited before submission), so the same treatment as ASR applies. Source of truth: [`lib/llm/types.ts`](../lib/llm/types.ts).

```ts
interface LLMAdapter {
  name: string;
  complete(req: {
    system: string;
    user: string;
    schema?: JsonSchema;   // provider enforces where supported
    maxTokens?: number;
  }): Promise<{ text: string; latencyMs: number; meta: Record<string, unknown> }>;
}
```

`temperature = 0` is set by the adapter and is not a caller-tunable parameter. **Schema adherence is never trusted from the model** — every response is re-validated in code (§17.1). Switching provider is `LLM_PROVIDER` in the environment; no call site changes.

---

## Data file column headers — agreed at T+0

These are contracts with clinicians and native speakers, not with each other. They are CSV specifically so a reviewer can read them without reading TypeScript (§14.8). **Renaming a column late breaks both tracks at once.**

| File | Columns |
|---|---|
| `data/idiom_lexicon.csv` | `id, phrase, register, gloss, phq9_gad7_mapping, source, doi_or_pmcid, confidence` (§5.4) |
| `data/safety_lexicon.csv` | `id, phrase, language, register, form, severity, source, clinician_reviewed, added_at` (§11.4a) |
| `data/somatic_terms.csv` | `term, language` (§11.4b) |
| `data/psych_markers.csv` | `term, language` (§11.4b) |
| `data/fieldset_metadata.csv` | as §18.6 |
| `data/probes/phq9_item9.sw.txt` | free text, one probe, **never in a prompt** (§11.6a) |

`safety_lexicon.csv`: `form` ∈ `explicit | idiomatic | hedged | passive | third_person`; `severity` ∈ `active_intent | ideation | passive_ideation | hopelessness`. **All four severities escalate.** Severity is recorded for the clinician and is never used as a threshold.

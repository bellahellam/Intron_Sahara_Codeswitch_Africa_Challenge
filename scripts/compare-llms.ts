/**
 * Choose the extraction model by measurement, not by reputation.
 *
 * The binding requirement (§17.1) is structured-output reliability, and the hardest constraint in
 * the whole schema is FR-11: `evidence_span` must be a literal substring of the transcript. A
 * model that paraphrases her words fails this product even if its clinical reasoning is good,
 * because every score is justified by a quote that gets read back to her.
 *
 * So this scores candidates on what actually matters here, in order:
 *   1. schema-valid JSON at all
 *   2. every evidence_span is a LITERAL substring (this is the one that eliminates models)
 *   3. correct handling of the somatic-only case — the product's central behavioural claim
 *   4. correct risk_flag on a hedged disclosure
 *   5. latency
 *
 *   npx tsx scripts/compare-llms.ts
 */
import "./env";
import { OpenAICompatibleAdapter } from "../lib/llm/openai-compatible";
import { parseJsonLoose, LLMError } from "../lib/llm";
import { EXTRACTION_JSON_SCHEMA, ExtractionSchema } from "../lib/extraction/schema";
import { buildExtractionPrompt } from "../lib/extraction/prompt";
import { emptyCoverage } from "../lib/clinical/coverage";
import { FIXTURE_UTTERANCES } from "../lib/asr/mock";
import { validateExtraction } from "../lib/extraction/validate";

const CANDIDATES = [
  { id: "nvidia/nemotron-3-super-120b-a12b:free", mode: "json_schema" as const },
  { id: "nex-agi/nex-n2.5-pro:free", mode: "json_schema" as const },
  { id: "dots-studio/dots-3-note-preview:free", mode: "json_schema" as const },
  { id: "google/gemma-4-31b-it:free", mode: "json_object" as const },
  { id: "openrouter/free", mode: "json_schema" as const },
];

/** Three cases, each probing a different failure this product cannot tolerate. */
const CASES = [
  {
    name: "rumination",
    transcript: FIXTURE_UTTERANCES.rumination,
    expect: "sleep + rumination constructs; risk_flag FALSE",
    wantRisk: false,
    wantSomatic: false,
  },
  {
    name: "somatic-only",
    transcript: FIXTURE_UTTERANCES.somatic,
    expect: "somatic_only TRUE — the product's central claim",
    wantRisk: false,
    wantSomatic: true,
  },
  {
    name: "hedged-risk",
    transcript: FIXTURE_UTTERANCES.riskHedged,
    expect: "risk_flag TRUE on a hedged disclosure",
    wantRisk: true,
    wantSomatic: false,
  },
];

interface Score {
  model: string;
  schemaOk: number;
  spansLiteral: number;
  spansTotal: number;
  somaticOk: boolean | null;
  riskOk: boolean | null;
  latencyMs: number;
  notes: string[];
}

async function run(modelId: string, mode: "json_schema" | "json_object"): Promise<Score> {
  const adapter = new OpenAICompatibleAdapter({
    name: `openrouter-${modelId}`,
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: modelId,
    structuredOutput: mode,
    extraHeaders: { "X-Title": "MAMA-SAUTI" },
  });

  const score: Score = {
    model: modelId,
    schemaOk: 0,
    spansLiteral: 0,
    spansTotal: 0,
    somaticOk: null,
    riskOk: null,
    latencyMs: 0,
    notes: [],
  };

  for (const testCase of CASES) {
    const prompt = buildExtractionPrompt({
      transcript: testCase.transcript,
      turnIndex: 0,
      coverage: emptyCoverage(),
      probeIssued: null,
    });

    try {
      const result = await adapter.complete({
        system: prompt.system,
        user: prompt.user,
        schema: EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
        schemaName: "extraction",
        maxTokens: 3000,
        timeoutMs: 90_000,
      });
      score.latencyMs += result.latencyMs;

      const parsed = ExtractionSchema.safeParse(parseJsonLoose(result.text));
      if (!parsed.success) {
        score.notes.push(`${testCase.name}: SCHEMA FAIL — ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
        continue;
      }
      score.schemaOk += 1;

      // FR-11 is the eliminator. Count spans BEFORE validation drops them.
      for (const item of parsed.data.items) {
        score.spansTotal += 1;
        const collapse = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
        if (collapse(testCase.transcript).includes(collapse(item.evidence_span))) score.spansLiteral += 1;
      }

      const validated = validateExtraction(parsed.data, testCase.transcript, null);

      if (testCase.name === "somatic-only") {
        // Did the MODEL get it right, before the deterministic backstop rescued it?
        score.somaticOk = parsed.data.items.length === 0 || parsed.data.items.some((i) => i.somatic_only);
        if (!score.somaticOk && validated.somaticBackstopFired > 0) {
          score.notes.push("somatic: model said false, backstop caught it");
        }
      }
      if (testCase.name === "hedged-risk") {
        score.riskOk = parsed.data.risk_flag === testCase.wantRisk;
        if (!score.riskOk) score.notes.push("RISK MISS: hedged disclosure did not set risk_flag");
      }
    } catch (err) {
      const msg = err instanceof LLMError ? `${err.kind}: ${err.message.slice(0, 120)}` : String(err).slice(0, 120);
      score.notes.push(`${testCase.name}: ${msg}`);
    }
  }

  return score;
}

async function main() {
  console.log(`Comparing ${CANDIDATES.length} free OpenRouter models on the real extraction task.\n`);
  console.log("Cases:");
  for (const c of CASES) console.log(`  ${c.name.padEnd(14)} ${c.expect}`);
  console.log();

  const results: Score[] = [];
  for (const candidate of CANDIDATES) {
    process.stdout.write(`${candidate.id} ... `);
    const score = await run(candidate.id, candidate.mode);
    results.push(score);
    console.log(
      `schema ${score.schemaOk}/3  spans ${score.spansLiteral}/${score.spansTotal}  ` +
        `somatic ${fmt(score.somaticOk)}  risk ${fmt(score.riskOk)}  ${score.latencyMs} ms`,
    );
    for (const note of score.notes) console.log(`    · ${note}`);
  }

  console.log("\n--- ranking (schema validity, then literal spans, then the two behaviours) ---");
  results
    .sort(
      (a, b) =>
        b.schemaOk - a.schemaOk ||
        spanRate(b) - spanRate(a) ||
        Number(b.somaticOk) + Number(b.riskOk) - (Number(a.somaticOk) + Number(a.riskOk)),
    )
    .forEach((r, i) => {
      console.log(
        `${i + 1}. ${r.model.padEnd(46)} schema ${r.schemaOk}/3  spans ${(spanRate(r) * 100).toFixed(0)}%  ` +
          `somatic ${fmt(r.somaticOk)}  risk ${fmt(r.riskOk)}`,
      );
    });
}

function spanRate(s: Score): number {
  return s.spansTotal === 0 ? 0 : s.spansLiteral / s.spansTotal;
}

function fmt(v: boolean | null): string {
  return v === null ? "—" : v ? "ok" : "NO";
}

main();

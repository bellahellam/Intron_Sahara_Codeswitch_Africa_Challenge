/**
 * Proves the extraction LLM is reachable and returns schema-valid JSON, on one of the §5.3
 * reference utterances. Run this before Milestone 2.
 *
 *   npm run smoke:llm
 */
import { getLLMAdapter, parseJsonLoose, LLMError } from "../lib/llm";
import { EXTRACTION_JSON_SCHEMA, ExtractionSchema } from "../lib/extraction/schema";
import { buildExtractionPrompt } from "../lib/extraction/prompt";
import { emptyCoverage } from "../lib/clinical/coverage";
import { FIXTURE_UTTERANCES } from "../lib/asr/mock";

async function main() {
  const adapter = getLLMAdapter();
  console.log(`adapter: ${adapter.name}\n`);

  const transcript = FIXTURE_UTTERANCES.rumination;
  console.log(`transcript: ${transcript}\n`);

  const prompt = buildExtractionPrompt({
    transcript,
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
    });
    console.log(`latency: ${result.latencyMs} ms\n`);

    const parsed = ExtractionSchema.safeParse(parseJsonLoose(result.text));
    if (!parsed.success) {
      console.error("SCHEMA VIOLATION. This is the failure mode the free tier is most likely to hit.");
      console.error(parsed.error.issues.slice(0, 10));
      console.error("\nRaw output:\n", result.text.slice(0, 2000));
      process.exit(2);
    }

    console.log("schema: VALID");
    console.log(`risk_flag: ${parsed.data.risk_flag}`);
    for (const item of parsed.data.items) {
      console.log(`  ${item.construct} sev=${item.severity_estimate} conf=${item.confidence} somatic=${item.somatic_only}`);
      console.log(`    "${item.evidence_span}"`);
      const literal = transcript.includes(item.evidence_span);
      console.log(`    span is literal substring: ${literal ? "yes" : "NO — would be dropped by FR-11"}`);
    }
  } catch (err) {
    if (err instanceof LLMError) {
      console.error(`FAILED [${err.kind}]: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
}

main();

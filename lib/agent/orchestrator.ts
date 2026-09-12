/**
 * The turn orchestrator — §11.1's loop, made explicit.
 *
 *   [1] voice input      (the route handler; audio arrives here)
 *   [2] ASR              Sahara v2.5, use_language_asr_input="sw"
 *   [3] code-switch      token LID, cps, deletion-signature check
 *   [4] SAFETY SCAN      deterministic lexicon, NO MODEL  ──→ ESCALATE (short-circuits)
 *   [5] extraction       PHQ-9/GAD-7 evidence + verbatim spans
 *   [6] validation       span-is-substring; known-prompt suppression; somatic backstop
 *   [7] state update     coverage map, confidence, language profile
 *   [8] decision         PROBE | ESCALATE | COMPLETE
 *
 * THE ORDERING GUARANTEE (§14.1): the safety path completes before extraction is dispatched,
 * never after it, and never in parallel. Step 4 returns early. That early return is the whole
 * point of this function and it must not become a `Promise.all`.
 */

import { decide, type Decision } from "@/lib/clinical/decide";
import { updateCoverage, type CoverageMap } from "@/lib/clinical/coverage";
import { GAD2_IDS, PHQ2_IDS, isConstructId, type ConstructId } from "@/lib/clinical/constructs";
import { checkDeletion } from "@/lib/codeswitch/deletion";
import { matchIdioms, IDIOM_CONFIDENCE_BONUS } from "@/lib/codeswitch/idiom";
import { languageProfile, matrixLanguage, tagLanguageSpans, type LanguageSpan } from "@/lib/codeswitch/lid";
import { ExtractionSchema, EXTRACTION_JSON_SCHEMA, type Extraction } from "@/lib/extraction/schema";
import { buildExtractionPrompt } from "@/lib/extraction/prompt";
import { validateExtraction, type DroppedItem } from "@/lib/extraction/validate";
import { getLLMAdapter, parseJsonLoose, LLMError } from "@/lib/llm";
import { safetyScan, type SafetyHit } from "@/lib/safety/scan";
import { generateProbe, type GeneratedProbe } from "./probe";

export interface TurnContext {
  transcript: string;
  durationSeconds: number;
  turnIndex: number;
  coverage: CoverageMap;
  /** The probe read aloud before this turn, for known-prompt suppression (FR-11a). */
  probeIssued: string | null;
  /** Which construct that probe was aimed at. Stored with the probe, never inferred: an
   *  unanswered probe must record PROBED_NO_ANSWER against the construct actually asked. */
  probeTarget: ConstructId | null;
  /** Her transcripts so far, for the session language profile. */
  priorTranscripts: string[];
  /** Already-scored severities, so PHQ-2 / GAD-2 can gate completion. */
  priorSeverities: Record<string, number>;
  /** Latched. Once true it never goes back to false (§11.8 rule 1). */
  sessionEscalated: boolean;
}

export interface TurnOutcome {
  languageSpans: LanguageSpan[];
  languageProfile: ReturnType<typeof languageProfile>;
  deletion: ReturnType<typeof checkDeletion>;
  safety: { hit: boolean; hits: SafetyHit[]; failedClosed: boolean; scanMs: number };
  /** Null when the turn short-circuited on a safety hit — extraction never ran. */
  extraction: Extraction | null;
  dropped: DroppedItem[];
  somaticBackstopFired: number;
  idiomMatches: ReturnType<typeof matchIdioms>;
  coverage: CoverageMap;
  decision: Decision;
  probe: GeneratedProbe | null;
  extractionFailed: boolean;
  extractionError?: string;
  timings: { safetyMs: number; extractionMs: number; probeMs: number; totalMs: number };
}

export async function processTurn(ctx: TurnContext): Promise<TurnOutcome> {
  const startedAt = Date.now();

  // [3] Code-switch handling. Cheap, local, and informs the UI regardless of what follows.
  const spans = tagLanguageSpans(ctx.transcript);
  const profile = languageProfile([...ctx.priorTranscripts, ctx.transcript]);
  const deletion = checkDeletion(ctx.transcript, ctx.durationSeconds);
  const idiomMatches = matchIdioms(ctx.transcript);

  // [4] SAFETY SCAN. Deterministic, on the RAW transcript, before extraction, always.
  const safety = safetyScan(ctx.transcript);

  if (safety.hit) {
    // Short-circuit. Extraction is never dispatched on an escalating turn: the CHP's attention
    // belongs on the person in front of her, and nothing downstream changes the outcome.
    const decision = decide({
      coverage: ctx.coverage,
      turnIndex: ctx.turnIndex,
      safetyHit: true,
      riskFlag: false,
      phq2Score: sumOver(ctx.priorSeverities, PHQ2_IDS),
      gad2Score: sumOver(ctx.priorSeverities, GAD2_IDS),
      somaticOnlyConstructs: [],
    });
    return {
      languageSpans: spans,
      languageProfile: profile,
      deletion,
      safety,
      extraction: null,
      dropped: [],
      somaticBackstopFired: 0,
      idiomMatches,
      coverage: ctx.coverage,
      decision,
      probe: null,
      extractionFailed: false,
      timings: { safetyMs: safety.scanMs, extractionMs: 0, probeMs: 0, totalMs: Date.now() - startedAt },
    };
  }

  // [5] Extraction.
  const extractionStartedAt = Date.now();
  let extraction: Extraction | null = null;
  let extractionError: string | undefined;

  const prompt = buildExtractionPrompt({
    transcript: ctx.transcript,
    turnIndex: ctx.turnIndex,
    coverage: ctx.coverage,
    probeIssued: ctx.probeIssued,
  });

  const adapter = getLLMAdapter();

  // §24.4: "Schema instability. Mitigation: temperature 0, enforce in code, one retry, then
  // manual path." Two attempts, then the turn is marked extraction-failed — never filled with
  // a plausible guess (§12.6 rule 3).
  for (let attempt = 1; attempt <= 2 && !extraction; attempt++) {
    try {
      const result = await adapter.complete({
        system: prompt.system,
        user: prompt.user,
        schema: EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
        schemaName: "extraction",
        maxTokens: 3000,
      });
      const parsed = ExtractionSchema.safeParse(parseJsonLoose(result.text));
      if (parsed.success) extraction = parsed.data;
      else extractionError = `schema: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`;
    } catch (err) {
      extractionError = err instanceof LLMError ? `${err.kind}: ${err.message}` : String(err);
    }
  }

  const extractionMs = Date.now() - extractionStartedAt;

  if (!extraction) {
    // The screening is not lost. The construct is marked unevidenced and the CHP gets a manual
    // path, which is what §14.2 requires and what §12.6 rule 3 forbids papering over.
    const decision = decide({
      coverage: ctx.coverage,
      turnIndex: ctx.turnIndex,
      safetyHit: false,
      riskFlag: false,
      phq2Score: sumOver(ctx.priorSeverities, PHQ2_IDS),
      gad2Score: sumOver(ctx.priorSeverities, GAD2_IDS),
      somaticOnlyConstructs: [],
    });
    return {
      languageSpans: spans,
      languageProfile: profile,
      deletion,
      safety,
      extraction: null,
      dropped: [],
      somaticBackstopFired: 0,
      idiomMatches,
      coverage: ctx.coverage,
      decision,
      probe: null,
      extractionFailed: true,
      extractionError,
      timings: { safetyMs: safety.scanMs, extractionMs, probeMs: 0, totalMs: Date.now() - startedAt },
    };
  }

  // [6] Validation. Three layers, none of which calls a model.
  const validated = validateExtraction(extraction, ctx.transcript, ctx.probeIssued);
  let items = validated.extraction.items;

  // An idiom match raises confidence by at most +0.10 and NEVER sets severity on its own.
  const matchedIds = new Set(idiomMatches.map((m) => m.idiomId));
  items = items.map((item) =>
    item.idiom_id && matchedIds.has(item.idiom_id) && !item.somatic_only
      ? { ...item, confidence: Math.min(1, item.confidence + IDIOM_CONFIDENCE_BONUS) }
      : item,
  );

  // [7] State update.
  const denied = validated.extraction.constructs_addressed_but_negative.filter(isConstructId);
  const probedConstruct = ctx.probeTarget;
  const coverage = updateCoverage(ctx.coverage, {
    items: items
      .filter((i) => isConstructId(i.construct))
      .map((i) => ({
        construct: i.construct as ConstructId,
        confidence: i.confidence,
        somaticOnly: i.somatic_only,
      })),
    denied,
    probedConstruct: probedConstruct ?? undefined,
  });

  const severities = { ...ctx.priorSeverities };
  for (const item of items) {
    if (item.somatic_only) continue;
    if (item.confidence < 0.6) continue;
    severities[item.construct] = Math.max(severities[item.construct] ?? 0, item.severity_estimate);
  }

  const somaticOnlyConstructs = items
    .filter((i) => i.somatic_only && isConstructId(i.construct))
    .map((i) => i.construct as ConstructId);

  // [8] Decision.
  const decision = decide({
    coverage,
    turnIndex: ctx.turnIndex + 1,
    safetyHit: false,
    riskFlag: validated.extraction.risk_flag,
    phq2Score: sumOver(severities, PHQ2_IDS),
    gad2Score: sumOver(severities, GAD2_IDS),
    somaticOnlyConstructs,
  });

  let probe: GeneratedProbe | null = null;
  let probeMs = 0;
  if (decision.action === "PROBE" && decision.targetConstruct) {
    const probeStartedAt = Date.now();
    probe = await generateProbe({
      targetConstruct: decision.targetConstruct,
      matrixLanguage: matrixLanguage(profile),
      herQuotes: items.map((i) => i.evidence_span).slice(0, 4),
      somaticOnly: somaticOnlyConstructs.includes(decision.targetConstruct),
      useFixed: decision.useFixedItem9Probe,
    });
    probeMs = Date.now() - probeStartedAt;
  }

  return {
    languageSpans: spans,
    languageProfile: profile,
    deletion,
    safety,
    extraction: { ...validated.extraction, items },
    dropped: validated.dropped,
    somaticBackstopFired: validated.somaticBackstopFired,
    idiomMatches,
    coverage,
    decision,
    probe,
    extractionFailed: false,
    timings: { safetyMs: safety.scanMs, extractionMs, probeMs, totalMs: Date.now() - startedAt },
  };
}

function sumOver(severities: Record<string, number>, ids: readonly ConstructId[]): number {
  let total = 0;
  for (const id of ids) total += severities[id] ?? 0;
  return total;
}

import { NextResponse } from "next/server";
import { prisma, audit, toJsonColumn, fromJsonColumn } from "@/lib/db";
import { getASRAdapter, transcribeWithRetry, ASRError } from "@/lib/asr";
import { processTurn } from "@/lib/agent/orchestrator";
import { emptyCoverage, type CoverageMap } from "@/lib/clinical/coverage";
import type { ConstructId } from "@/lib/clinical/constructs";
import { canAccessChp } from "@/lib/auth/session";
import { accessDenied, authenticationRequired, getRequestAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ProbeRecord {
  text: string;
  target: ConstructId | null;
}

/**
 * The turn endpoint. Audio in, evidence + decision out.
 *
 * AUDIO IS NEVER WRITTEN TO DISK OR TO THE DATABASE. It exists as a buffer for the duration of
 * this request and is dropped when the request ends (M18, FR-23). There is no code path here
 * that persists it, which is a stronger guarantee than deleting it afterwards.
 */
export async function POST(req: Request) {
  const auth = getRequestAuth(req);
  if (!auth) return authenticationRequired();
  const form = await req.formData().catch(() => null);
  const sessionId = form?.get("sessionId");
  const audio = form?.get("audio");
  const durationMs = Number(form?.get("durationMs") ?? 0);
  // Set by the continuous recorder when the CHP tapped "Uliza" during this segment, i.e. she read
  // a probe aloud into the stream. Continuous capture removed the turn boundary that used to
  // separate the speakers (§11.3a), so this flag is part of what replaces it.
  const chpSpokeDuring = form?.get("chpSpokeDuring") === "true";

  if (typeof sessionId !== "string" || !(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "bad_request", messageSw: "Ombi halijakamilika.", messageEn: "The request was incomplete." },
      { status: 400 },
    );
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { turns: { orderBy: { idx: "asc" } } },
  });

  if (!session) {
    return NextResponse.json(
      { error: "not_found", messageSw: "Kikao hakipatikani.", messageEn: "Session not found." },
      { status: 404 },
    );
  }
  if (!canAccessChp(auth, session.chpCode)) return accessDenied();

  // ===================================================================================
  // FR-03 CONSENT GATE. Server-side, not only in the UI.
  //
  // "No audio can be captured before granted == true. Enforced server-side, not only in the UI."
  // This is the brace; the disabled control on S3 is the belt. A client that skips the UI, a
  // replayed request, or a bug in navigation all hit this and stop here.
  // ===================================================================================
  if (!session.consentGranted) {
    await audit(sessionId, "consent_gate_rejected_upload", {});
    return NextResponse.json(
      {
        error: "consent_required",
        messageSw: "Ruhusa haijatolewa. Huwezi kurekodi kabla ya ruhusa.",
        messageEn: "Consent has not been granted. Recording is not possible before consent.",
      },
      { status: 403 },
    );
  }

  if (session.status === "withdrawn") {
    return NextResponse.json(
      {
        error: "consent_withdrawn",
        messageSw: "Ruhusa imeondolewa kwa kikao hiki.",
        messageEn: "Consent has been withdrawn for this session.",
      },
      { status: 403 },
    );
  }

  const turnIndex = session.turns.length;
  const probes = fromJsonColumn<Record<string, ProbeRecord>>(session.probeIssuedJson, {});
  const issued = probes[String(turnIndex)] ?? null;

  // ---- [2] ASR ----------------------------------------------------------------------
  const adapter = getASRAdapter();
  const buffer = Buffer.from(await audio.arrayBuffer());
  let transcript: string;
  let asrLatencyMs: number;
  // Sahara reports the audio duration it actually processed. Prefer it over the browser's
  // wall-clock timer for chars-per-second: the deletion detector compares text volume against
  // AUDIO duration, and the client timer includes UI lag at both ends.
  let measuredDurationSeconds: number | null = null;

  try {
    // This route shares one 60s `maxDuration` (Hobby plan — fixed, not ours to raise) with the
    // extraction and probe generation that run after ASR in the same request. Sahara's own
    // default timeout (130s) assumes it owns the whole budget, which is true for a standalone
    // caller like scripts/smoke-sahara.ts but not here. 2 attempts x 20s leaves headroom above
    // the slowest successful call seen in production telemetry (14.8s) while still failing a
    // truly hung call fast enough for extraction/probe to have a chance to run at all.
    const result = await transcribeWithRetry(adapter, new Blob([new Uint8Array(buffer)], { type: audio.type }), {
      lang: "sw",
      maxAttempts: 2,
      timeoutMs: 20_000,
    });
    transcript = result.text;
    asrLatencyMs = result.latencyMs;
    const reported = result.meta?.audioDurationSeconds;
    if (typeof reported === "number" && reported > 0) measuredDurationSeconds = reported;
  } catch (err) {
    if (err instanceof ASRError) {
      await audit(sessionId, "asr_failed", { kind: err.kind, adapter: err.adapter, turnIndex });
      return NextResponse.json(
        { error: `asr_${err.kind}`, messageSw: err.chpMessageSw, messageEn: err.chpMessageEn, retryable: err.kind !== "quota" },
        { status: 502 },
      );
    }
    throw err;
  }

  // ---- [3]–[8] the loop -------------------------------------------------------------
  const coverage = fromJsonColumn<CoverageMap>(session.coverageJson, emptyCoverage());
  const priorTranscripts = session.turns.map((t) => t.transcript ?? "").filter(Boolean);
  const priorSeverities = severitiesFromTurns(session.turns.map((t) => t.extractionJson));

  const outcome = await processTurn({
    transcript,
    durationSeconds: measuredDurationSeconds ?? durationMs / 1000,
    turnIndex,
    coverage,
    probeIssued: issued?.text ?? null,
    probeTarget: issued?.target ?? null,
    priorTranscripts,
    priorSeverities,
    sessionEscalated: session.escalated,
  });

  // ---- persistence ------------------------------------------------------------------
  await prisma.turn.create({
    data: {
      sessionId,
      idx: turnIndex,
      durationMs,
      transcript, // purged at session completion (§17.8)
      cps: outcome.deletion.cps,
      deletionSuspected: outcome.deletion.deletionSuspected,
      asrModel: adapter.name,
      asrLatencyMs,
      languageSpansJson: toJsonColumn(outcome.languageSpans),
      extractionJson: outcome.extraction ? toJsonColumn(outcome.extraction) : null,
      droppedItemsJson: toJsonColumn(outcome.dropped),
    },
  });

  const escalating = outcome.decision.action === "ESCALATE";

  const nextProbes = { ...probes };
  if (outcome.probe) {
    nextProbes[String(turnIndex + 1)] = {
      text: outcome.probe.text,
      target: outcome.probe.targetConstruct,
    };
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      coverageJson: toJsonColumn(outcome.coverage),
      languageProfileJson: toJsonColumn(outcome.languageProfile),
      probeIssuedJson: toJsonColumn(nextProbes),
      // Latched: once true, never false again (§11.8 rule 1).
      escalated: session.escalated || escalating,
      escalatedAt: session.escalatedAt ?? (escalating ? new Date() : null),
      status: escalating ? "escalated" : session.status,
      // Complete and back-read read this column to distinguish a deliberate short path from a
      // truncated full screen. decide() sets it; without this write it is always null.
      ...(outcome.decision.termination ? { termination: outcome.decision.termination } : {}),
    },
  });

  // ---- structured event logging (FR-40). What happened, never what she said. ----------
  await audit(sessionId, "turn_processed", {
    turnIndex,
    asrLatencyMs,
    asrModel: adapter.name,
    cps: outcome.deletion.cps,
    deletionSuspected: outcome.deletion.deletionSuspected,
    deletionDetectorCalibrated: outcome.deletion.calibrated,
    durationSource: measuredDurationSeconds !== null ? "asr_reported" : "client_timer",
    extractionMs: outcome.timings.extractionMs,
    safetyMs: outcome.timings.safetyMs,
    itemsProduced: outcome.extraction?.items.length ?? 0,
    // The hallucination canary. Watch this during the demo.
    itemsDropped: outcome.dropped.length,
    dropReasons: outcome.dropped.map((d) => d.reason),
    somaticBackstopFired: outcome.somaticBackstopFired,
    chpSpokeDuring,
    idiomsMatched: outcome.idiomMatches.map((m) => m.idiomId),
    action: outcome.decision.action,
    extractionFailed: outcome.extractionFailed,
    probeWasFixed: outcome.probe?.fixed ?? null,
    probeFellBackToTemplate: outcome.probe?.fellBackToTemplate ?? null,
  });

  for (const drop of outcome.dropped) {
    await audit(sessionId, drop.reason, { construct: drop.construct, turnIndex });
  }
  if (outcome.somaticBackstopFired > 0) {
    await audit(sessionId, "somatic_backstop_fired", { count: outcome.somaticBackstopFired, turnIndex });
  }
  if (outcome.extractionFailed) {
    await audit(sessionId, "extraction_failed", { turnIndex, reason: outcome.extractionError?.slice(0, 120) });
  }
  if (escalating) {
    await audit(sessionId, "safety_hit", {
      turnIndex,
      // The lexicon id and form, never the matched text — that is her words.
      lexiconIds: outcome.safety.hits.map((h) => h.lexiconId),
      forms: outcome.safety.hits.map((h) => h.form),
      severities: outcome.safety.hits.map((h) => h.severity),
      failedClosed: outcome.safety.failedClosed,
      source: outcome.safety.hit ? "deterministic_lexicon" : "llm_risk_flag",
    });
  }

  return NextResponse.json({
    turnIndex,
    transcript,
    languageSpans: outcome.languageSpans,
    languageProfile: outcome.languageProfile,
    deletion: outcome.deletion,
    safety: {
      hit: outcome.safety.hit,
      failedClosed: outcome.safety.failedClosed,
      // The matched quote IS shown to the CHP on S5 so she knows what triggered it — it goes in
      // the response, never in a log line.
      hits: outcome.safety.hits.map((h) => ({
        lexiconId: h.lexiconId,
        matchedText: h.matchedText,
        form: h.form,
        severity: h.severity,
      })),
    },
    items: outcome.extraction?.items ?? [],
    riskFlag: outcome.extraction?.risk_flag ?? false,
    riskEvidence: outcome.extraction?.risk_evidence ?? null,
    deniedConstructs: outcome.extraction?.constructs_addressed_but_negative ?? [],
    unrecognisedLanguageSpans: outcome.extraction?.unrecognised_language_spans ?? [],
    idiomMatches: outcome.idiomMatches,
    droppedCount: outcome.dropped.length,
    coverage: outcome.coverage,
    decision: outcome.decision,
    probe: outcome.probe,
    extractionFailed: outcome.extractionFailed,
    timings: outcome.timings,
  });
}

function severitiesFromTurns(extractionJsons: Array<string | null>): Record<string, number> {
  const severities: Record<string, number> = {};
  for (const json of extractionJsons) {
    const extraction = fromJsonColumn<{ items?: Array<{ construct: string; severity_estimate: number; confidence: number; somatic_only: boolean }> }>(
      json,
      {},
    );
    for (const item of extraction.items ?? []) {
      if (item.somatic_only || item.confidence < 0.6) continue;
      severities[item.construct] = Math.max(severities[item.construct] ?? 0, item.severity_estimate);
    }
  }
  return severities;
}

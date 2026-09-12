import { NextResponse } from "next/server";
import { prisma, fromJsonColumn } from "@/lib/db";
import { isAdminToken } from "@/lib/roles";
import { safetyLexiconReviewStatus } from "@/lib/safety/lexicon";
import { getDeletionFloor } from "@/lib/codeswitch/deletion";

export const runtime = "nodejs";

/**
 * The admin surface. Everything the CHP's screen deliberately hides.
 *
 * ⚠️ ON TRANSCRIPTS. Completed sessions have NO transcripts — they are destroyed at completion
 * (app/api/complete/route.ts) because §17.8 says so and because the consent script promises it.
 * This endpoint therefore returns transcripts ONLY for sessions still in progress, and says so in
 * the payload rather than returning an empty field that looks like a bug.
 *
 * Widening this to retained transcript history would require changing BOTH the retention policy
 * and the consent script the mother was read. That is a product decision with an ethics
 * consequence, not a feature flag, so it is not done quietly here.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = req.headers.get("x-admin-token") ?? url.searchParams.get("token");

  if (!isAdminToken(token)) {
    return NextResponse.json(
      {
        error: "unauthorized",
        messageEn: process.env.ADMIN_TOKEN
          ? "Admin token is incorrect."
          : "ADMIN_TOKEN is not set on the server. Add it to .env.local to enable the admin view.",
      },
      { status: 401 },
    );
  }

  const [sessions, records, events, counters] = await Promise.all([
    prisma.session.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
      include: {
        mother: { select: { displayName: true, anonymous: true } },
        turns: { orderBy: { idx: "asc" } },
      },
    }),
    prisma.screeningRecord.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.anonymousCounter.findMany(),
  ]);

  // Per-turn telemetry. This is the evaluation surface (FR-40): what happened, never what she said.
  const turns = sessions.flatMap((s) =>
    s.turns.map((t) => {
      const extraction = fromJsonColumn<{ items?: unknown[] }>(t.extractionJson, {});
      const dropped = fromJsonColumn<Array<{ reason: string }>>(t.droppedItemsJson, []);
      return {
        sessionId: s.id,
        idx: t.idx,
        durationMs: t.durationMs,
        asrModel: t.asrModel,
        asrLatencyMs: t.asrLatencyMs,
        cps: t.cps,
        deletionSuspected: t.deletionSuspected,
        itemsProduced: (extraction.items ?? []).length,
        itemsDropped: dropped.length,
        dropReasons: dropped.map((d) => d.reason),
        // A transcript survives for one of two reasons, and they are not the same fact:
        // the session is still running, or she opted in to research retention.
        transcript: t.transcript,
        transcriptPurged: t.transcript === null,
        retainedByConsent: s.transcriptRetained,
        sessionStatus: s.status,
      };
    }),
  );

  const byKind: Record<string, number> = {};
  for (const e of events) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

  return NextResponse.json({
    config: {
      asrProvider: process.env.ASR_PROVIDER ?? "sahara",
      saharaCorrections: process.env.SAHARA_DISABLE_LLM_CORRECTIONS === "false" ? "ON" : "OFF",
      llmProvider: process.env.LLM_PROVIDER ?? "xai",
      llmModel: process.env.LLM_MODEL ?? "(provider default)",
      deletionFloor: getDeletionFloor(),
      safetyLexicon: safetyLexiconReviewStatus(),
    },
    // The hallucination canary (§17.8): items dropped because the model quoted something she did
    // not say. Watch this during the demo.
    canaries: {
      spanValidationFailures: byKind.span_validation_failure ?? 0,
      knownPromptSuppressed: byKind.known_prompt_suppressed ?? 0,
      somaticBackstopFired: byKind.somatic_backstop_fired ?? 0,
      extractionFailed: byKind.extraction_failed ?? 0,
      safetyHits: byKind.safety_hit ?? 0,
      consentGateRejections: byKind.consent_gate_rejected_upload ?? 0,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      mother: s.mother.anonymous ? "(anonymous)" : s.mother.displayName,
      chpCode: s.chpCode,
      status: s.status,
      escalated: s.escalated,
      consentGranted: s.consentGranted,
      turnCount: s.turns.length,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      languageProfile: fromJsonColumn(s.languageProfileJson, null),
      coverage: fromJsonColumn(s.coverageJson, null),
    })),
    turns,
    records: records.map((r) => ({
      id: r.id,
      chpCode: r.chpCode,
      createdAt: r.createdAt,
      scores: fromJsonColumn(r.scoresJson, {}),
      referral: fromJsonColumn(r.referralJson, {}),
      risk: fromJsonColumn(r.riskJson, {}),
      disclaimers: fromJsonColumn(r.disclaimersJson, []),
      asr: fromJsonColumn(r.asrJson, {}),
    })),
    auditByKind: byKind,
    recentEvents: events.slice(0, 60).map((e) => ({
      kind: e.kind,
      sessionId: e.sessionId,
      createdAt: e.createdAt,
      payload: fromJsonColumn(e.payloadJson, null),
    })),
    anonymousCounters: counters,
    transcriptPolicy:
      "Transcripts are destroyed at session completion (spec 17.8) UNLESS the mother opted in to " +
      "research retention — a separate consent point with its own read-aloud script, default off. " +
      "A transcript you can see here is either from a session still in progress, or from one where " +
      "she agreed. Withdrawal destroys everything either way.",
    retentionCounts: {
      retainedByConsent: sessions.filter((s) => s.transcriptRetained).length,
      totalSessions: sessions.length,
    },
  });
}

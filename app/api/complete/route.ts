import { NextResponse } from "next/server";
import { prisma, audit, toJsonColumn, fromJsonColumn } from "@/lib/db";
import { score, type ScoredItem } from "@/lib/clinical/score";
import { routeReferral } from "@/lib/clinical/route";
import { isConstructId, type ConstructId } from "@/lib/clinical/constructs";
import { bandForConfidence } from "@/lib/clinical/coverage";
import { generateBackRead, generateHandover, handoverHeader } from "@/lib/agent/summarise";
import { dedupeQuotes } from "@/lib/agent/quotes";
import { loadSomaticTerms } from "@/lib/safety/lexicon";
import { tokenize } from "@/lib/safety/scan";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ClientItemState {
  construct: string;
  evidence_span: string;
  confirmed: boolean;
  disputed: boolean;
}

interface StoredItem {
  construct: string;
  evidence_span: string;
  severity_estimate: number;
  confidence: number;
  somatic_only: boolean;
  idiom_id: string | null;
  span_language: string;
  reasoning: string;
  severity_basis: string;
}

/**
 * Completion: score, route, generate, persist, purge.
 *
 * Two guarantees this route exists to keep:
 *
 *   FR-17 — the write is BLOCKED until every amber item is resolved. Not warned about. Blocked.
 *   §12.6 — the success screen is never shown before the write is confirmed. This route returns
 *           the record id only after the row exists; the client shows nothing until it does.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    sessionId?: string;
    items?: ClientItemState[];
    /** §14.4a: set when the session ran in offline capture mode and could not be back-read. */
    notBackRead?: boolean;
  } | null;

  if (!body?.sessionId) {
    return NextResponse.json(
      { error: "bad_request", messageSw: "Ombi halijakamilika.", messageEn: "The request was incomplete." },
      { status: 400 },
    );
  }

  const session = await prisma.session.findUnique({
    where: { id: body.sessionId },
    include: { turns: { orderBy: { idx: "asc" } }, mother: true },
  });

  if (!session) {
    return NextResponse.json(
      { error: "not_found", messageSw: "Kikao hakipatikani.", messageEn: "Session not found." },
      { status: 404 },
    );
  }
  if (!session.consentGranted || session.status === "withdrawn") {
    return NextResponse.json(
      { error: "consent_required", messageSw: "Ruhusa haipo.", messageEn: "Consent is not in place." },
      { status: 403 },
    );
  }

  // ---- gather every item across turns ------------------------------------------------
  const stored: StoredItem[] = [];
  for (const turn of session.turns) {
    const extraction = fromJsonColumn<{ items?: StoredItem[] }>(turn.extractionJson, {});
    for (const item of extraction.items ?? []) stored.push(item);
  }

  const clientState = new Map<string, ClientItemState>();
  for (const s of body.items ?? []) clientState.set(`${s.construct}::${s.evidence_span}`, s);

  // ---- FR-17: block the write on any unresolved amber item ----------------------------
  const unresolved = stored.filter((item) => {
    if (item.somatic_only) return false;
    if (bandForConfidence(item.confidence) !== "medium") return false;
    const state = clientState.get(`${item.construct}::${item.evidence_span}`);
    return !(state?.confirmed || state?.disputed);
  });

  if (unresolved.length > 0) {
    return NextResponse.json(
      {
        error: "amber_unresolved",
        unresolvedCount: unresolved.length,
        messageSw: "Thibitisha vipengele vya njano kwanza.",
        messageEn: "Confirm the amber items first.",
      },
      { status: 409 },
    );
  }

  // ---- score, deterministically -------------------------------------------------------
  const scored: ScoredItem[] = [];
  for (const item of stored) {
    if (!isConstructId(item.construct)) continue;
    if (item.somatic_only) continue; // never populates a construct (FR-12)
    const band = bandForConfidence(item.confidence);
    if (band === "low") continue; // was never populated; silence beats a guess
    const state = clientState.get(`${item.construct}::${item.evidence_span}`);
    scored.push({
      construct: item.construct as ConstructId,
      severity: item.severity_estimate,
      // Green items need no action; amber items required an explicit per-item tap.
      confirmedByChp: band === "high" ? true : state?.confirmed === true,
      motherDisputed: state?.disputed === true,
    });
  }

  const scores = score(scored);

  const shortPathNegative = session.termination === "short_path_negative";
  const referral = routeReferral({
    scores,
    // Latched. Read from the session row, never re-derived from the item list (§11.8 rule 1).
    sessionEscalated: session.escalated,
    shortPathNegative,
    notBackRead: body.notBackRead === true,
  });

  // §12.4: flat denial alongside strong somatic content. Do not override her — flag it, and note
  // it in the handover, because Velloza 2020 documents under-endorsement as the expected failure
  // mode and the clinician should know we suspected it.
  const possibleUnderEndorsement = detectUnderEndorsement(stored, scores.phq9);

  // ---- generated surfaces, each denylisted (FR-24a) ------------------------------------
  const quotes = dedupeQuotes(
    stored
      .filter((i) => !i.somatic_only && bandForConfidence(i.confidence) !== "low")
      .filter((i) => !clientState.get(`${i.construct}::${i.evidence_span}`)?.disputed)
      .map((i) => ({ construct: i.construct, span: i.evidence_span })),
  );

  const summaryInput = {
    quotes,
    scores,
    referral,
    escalated: session.escalated,
    incomplete: referral.incomplete,
    chpCode: session.chpCode,
    screenedAt: new Date(),
    possibleUnderEndorsement,
  };

  const [backRead, handover] = await Promise.all([
    generateBackRead(summaryInput),
    generateHandover(summaryInput),
  ]);

  const handoverEn = `${handoverHeader(summaryInput)}\n\n${handover.text}`;

  // ---- persist. The success screen is not shown before this succeeds. -------------------
  const record = await prisma.screeningRecord.create({
    data: {
      sessionId: session.id,
      motherId: session.motherId,
      chpCode: session.chpCode,
      scoresJson: toJsonColumn(scores),
      itemsJson: toJsonColumn(
        stored.map((i) => {
          const state = clientState.get(`${i.construct}::${i.evidence_span}`);
          return {
            ...i,
            confirmed_by_chp: bandForConfidence(i.confidence) === "high" ? true : state?.confirmed === true,
            mother_disputed: state?.disputed === true,
          };
        }),
      ),
      riskJson: toJsonColumn({
        flagged: session.escalated,
        escalated_at: session.escalatedAt,
        // The matched phrase is deliberately NOT copied here from a log; it lives in the audit
        // event that recorded the escalation, and the handover carries her quotes.
        source: session.escalated ? "session_escalation_event" : null,
      }),
      referralJson: toJsonColumn(referral),
      asrJson: toJsonColumn({
        model: session.turns[0]?.asrModel ?? null,
        lang_code: "sw",
        turns: session.turns.length,
        deletion_suspected_turns: session.turns.filter((t) => t.deletionSuspected).map((t) => t.idx),
        mean_asr_latency_ms: mean(session.turns.map((t) => t.asrLatencyMs ?? 0)),
      }),
      disclaimersJson: toJsonColumn([
        "not_a_diagnosis",
        "instrument_not_criterion_validated_in_swahili",
        ...(referral.incomplete ? ["incomplete_screen"] : []),
        ...(possibleUnderEndorsement ? ["possible_under_endorsement"] : []),
        ...(backRead.fellBackToTemplate || handover.fellBackToTemplate ? ["generated_text_withheld_by_safety_check"] : []),
      ]),
      handoverEn,
      backReadSw: backRead.text,
    },
  });

  // ---- purge. Audio was never written; transcripts go now (§17.8). ----------------------
  await prisma.turn.updateMany({ where: { sessionId: session.id }, data: { transcript: null } });

  await prisma.session.update({
    where: { id: session.id },
    data: { status: "completed", endedAt: new Date() },
  });

  await audit(session.id, "transcript_purged", { turns: session.turns.length });
  await audit(session.id, "audio_purged", { note: "audio is never persisted; buffers are request-scoped" });
  await audit(session.id, "record_persisted", {
    recordId: record.id,
    phq9: scores.phq9,
    gad7: scores.gad7,
    band: scores.phq9Band,
    tier: referral.tier,
    ruleApplied: referral.ruleApplied,
    incomplete: referral.incomplete,
    backReadFellBack: backRead.fellBackToTemplate,
    handoverFellBack: handover.fellBackToTemplate,
  });

  return NextResponse.json({
    recordId: record.id,
    scores,
    referral,
    backRead: backRead.text,
    handoverEn,
    possibleUnderEndorsement,
    generatedTextWithheld: backRead.fellBackToTemplate || handover.fellBackToTemplate,
  });
}

function mean(xs: number[]): number {
  const valid = xs.filter((x) => x > 0);
  return valid.length === 0 ? 0 : Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/**
 * A flat screen alongside a lot of somatic content is the documented failure mode, not a clean
 * negative. We do not override her — we say we suspected it.
 */
function detectUnderEndorsement(items: StoredItem[], phq9Total: number): boolean {
  if (phq9Total > 4) return false;
  const somatic = loadSomaticTerms();
  const somaticSpans = items.filter((i) =>
    tokenize(i.evidence_span.toLowerCase()).some((t) => somatic.has(t.token)),
  );
  return somaticSpans.length >= 2;
}

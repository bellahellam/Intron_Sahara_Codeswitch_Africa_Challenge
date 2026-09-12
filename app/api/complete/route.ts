import { NextResponse } from "next/server";
import { prisma, audit, toJsonColumn, fromJsonColumn } from "@/lib/db";
import { score } from "@/lib/clinical/score";
import { routeReferral } from "@/lib/clinical/route";
import { bandForConfidence, emptyCoverage, type CoverageMap } from "@/lib/clinical/coverage";
import { prepareReviewScoring } from "@/lib/clinical/review";
import { isShortPathTermination } from "@/lib/clinical/decide";
import { generateBackRead, generateHandover, handoverHeader } from "@/lib/agent/summarise";
import { dedupeQuotes } from "@/lib/agent/quotes";
import { loadSomaticTerms } from "@/lib/safety/lexicon";
import { tokenize } from "@/lib/safety/scan";
import { canAccessChp } from "@/lib/auth/session";
import { accessDenied, authenticationRequired, getRequestAuth } from "@/lib/auth/guard";

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
  const auth = getRequestAuth(req);
  if (!auth) return authenticationRequired();
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
  if (!canAccessChp(auth, session.chpCode)) return accessDenied();
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

  const coverage = fromJsonColumn<CoverageMap>(session.coverageJson, emptyCoverage());

  // ---- FR-17: block the write on any unresolved amber item ----------------------------
  const unresolved = stored.filter((item) => {
    if (item.somatic_only) return false;
    if (coverage[item.construct as keyof CoverageMap] === "CONTESTED") return false;
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
  // §26.8: a construct she both affirmed and denied is CONTESTED until the CHP picks which
  // quote stands (or neither). That resolution is written into coverage before scoring, and
  // only the standing quote is counted — never the whole construct dropped, never a silent pick.
  const reviewed = prepareReviewScoring({
    coverage,
    stored,
    clientItems: body.items ?? [],
  });

  if (reviewed.stillContested.length > 0) {
    return NextResponse.json(
      {
        error: "contested_unresolved",
        unresolvedCount: reviewed.stillContested.length,
        messageSw: "Chagua nukuu inayosimama kwanza.",
        messageEn: "Pick which quote stands first.",
      },
      { status: 409 },
    );
  }

  const scores = score(reviewed.scored);

  const shortPathNegative = isShortPathTermination(session.termination);
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
  const quotes = dedupeQuotes(reviewed.quoteSpans);

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
        ...(reviewed.stillContested.length > 0 ? ["unresolved_contradiction_excluded_from_score"] : []),
        // On the record itself, so anyone reading it later knows the transcript still exists.
        ...(session.transcriptRetained ? ["transcript_retained_for_research_by_consent"] : []),
        ...(referral.incomplete ? ["incomplete_screen"] : []),
        ...(possibleUnderEndorsement ? ["possible_under_endorsement"] : []),
        ...(backRead.fellBackToTemplate || handover.fellBackToTemplate ? ["generated_text_withheld_by_safety_check"] : []),
      ]),
      handoverEn,
      backReadSw: backRead.text,
    },
  });

  // ---- purge. Audio was never written; transcripts go now (§17.8) unless she said otherwise.
  //
  // Retention is opt-in per session, asked as its own consent point with its own script, and
  // default off. Withdrawal still destroys everything regardless — the cascade does not consult
  // this flag, and it must never be made to.
  if (!session.transcriptRetained) {
    await prisma.turn.updateMany({ where: { sessionId: session.id }, data: { transcript: null } });
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      status: "completed",
      endedAt: new Date(),
      coverageJson: toJsonColumn(reviewed.coverage),
    },
  });

  await audit(
    session.id,
    session.transcriptRetained ? "transcript_retained_by_consent" : "transcript_purged",
    { turns: session.turns.length },
  );
  await audit(session.id, "audio_purged", { note: "audio is never persisted; buffers are request-scoped" });
  await audit(session.id, "record_persisted", {
    recordId: record.id,
    phq9: scores.phq9,
    gad7: scores.gad7,
    band: scores.phq9Band,
    tier: referral.tier,
    ruleApplied: referral.ruleApplied,
    incomplete: referral.incomplete,
    contestedCount: reviewed.stillContested.length,
    resolvedContestedCount: reviewed.resolutions.length,
    backReadFellBack: backRead.fellBackToTemplate,
    handoverFellBack: handover.fellBackToTemplate,
  });

  return NextResponse.json({
    recordId: record.id,
    scores,
    referral,
    contested: reviewed.stillContested,
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

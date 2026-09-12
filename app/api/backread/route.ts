import { NextResponse } from "next/server";
import { prisma, fromJsonColumn } from "@/lib/db";
import { score } from "@/lib/clinical/score";
import { routeReferral } from "@/lib/clinical/route";
import { emptyCoverage, type CoverageMap } from "@/lib/clinical/coverage";
import { prepareReviewScoring } from "@/lib/clinical/review";
import { isShortPathTermination } from "@/lib/clinical/decide";
import { generateBackRead } from "@/lib/agent/summarise";
import { dedupeQuotes } from "@/lib/agent/quotes";
import { canAccessChp } from "@/lib/auth/session";
import { accessDenied, authenticationRequired, getRequestAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * FR-22 — generate the back-read, and ONLY that.
 *
 * This endpoint deliberately persists nothing. §11.9 layer 3 puts the back-read BEFORE
 * submission: she is the source of truth for what she said, and a back-read that runs after the
 * record is written is a courtesy, not a verification. If she disagrees with a quote, that has to
 * be able to change what gets stored — which it cannot if the row already exists.
 */
export async function POST(req: Request) {
  const auth = getRequestAuth(req);
  if (!auth) return authenticationRequired();
  const body = (await req.json().catch(() => null)) as {
    sessionId?: string;
    items?: Array<{ construct: string; evidence_span: string; confirmed: boolean; disputed: boolean }>;
  } | null;

  if (!body?.sessionId) {
    return NextResponse.json(
      { error: "bad_request", messageSw: "Ombi halijakamilika.", messageEn: "The request was incomplete." },
      { status: 400 },
    );
  }

  const session = await prisma.session.findUnique({
    where: { id: body.sessionId },
    include: { turns: { orderBy: { idx: "asc" } } },
  });

  if (!session || !session.consentGranted) {
    return NextResponse.json(
      { error: "not_found", messageSw: "Kikao hakipatikani.", messageEn: "Session not found." },
      { status: 404 },
    );
  }
  if (!canAccessChp(auth, session.chpCode)) return accessDenied();

  const stored = session.turns.flatMap((t) => {
    const extraction = fromJsonColumn<{
      items?: Array<{
        construct: string;
        evidence_span: string;
        severity_estimate: number;
        confidence: number;
        somatic_only: boolean;
      }>;
    }>(t.extractionJson, {});
    return extraction.items ?? [];
  });

  const coverage = fromJsonColumn<CoverageMap>(session.coverageJson, emptyCoverage());
  const reviewed = prepareReviewScoring({
    coverage,
    stored,
    clientItems: body.items ?? [],
  });

  const scores = score(reviewed.scored);
  const referral = routeReferral({
    scores,
    sessionEscalated: session.escalated,
    shortPathNegative: isShortPathTermination(session.termination),
  });

  const backRead = await generateBackRead({
    quotes: dedupeQuotes(reviewed.quoteSpans),
    scores,
    referral,
    escalated: session.escalated,
    incomplete: referral.incomplete,
    chpCode: session.chpCode,
    screenedAt: new Date(),
  });

  return NextResponse.json({
    backRead: backRead.text,
    withheld: backRead.fellBackToTemplate,
  });
}

import { NextResponse } from "next/server";
import { prisma, fromJsonColumn } from "@/lib/db";
import { score, type ScoredItem } from "@/lib/clinical/score";
import { routeReferral } from "@/lib/clinical/route";
import { isConstructId, type ConstructId } from "@/lib/clinical/constructs";
import { bandForConfidence } from "@/lib/clinical/coverage";
import { generateBackRead } from "@/lib/agent/summarise";

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

  const state = new Map((body.items ?? []).map((s) => [`${s.construct}::${s.evidence_span}`, s]));

  const scored: ScoredItem[] = [];
  const quotes: Array<{ construct: string; span: string }> = [];

  for (const item of stored) {
    if (!isConstructId(item.construct) || item.somatic_only) continue;
    const band = bandForConfidence(item.confidence);
    if (band === "low") continue;
    const s = state.get(`${item.construct}::${item.evidence_span}`);
    if (s?.disputed) continue;
    scored.push({
      construct: item.construct as ConstructId,
      severity: item.severity_estimate,
      confirmedByChp: band === "high" ? true : s?.confirmed === true,
      motherDisputed: false,
    });
    quotes.push({ construct: item.construct, span: item.evidence_span });
  }

  const scores = score(scored);
  const referral = routeReferral({
    scores,
    sessionEscalated: session.escalated,
    shortPathNegative: session.termination === "short_path_negative",
  });

  const backRead = await generateBackRead({
    quotes: quotes.slice(0, 6),
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

import { NextResponse } from "next/server";
import { prisma, fromJsonColumn } from "@/lib/db";
import { emptyCoverage } from "@/lib/clinical/coverage";
import { canAccessChp } from "@/lib/auth/session";
import { accessDenied, authenticationRequired, getRequestAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";

/** Session state for S6, which must render every item accumulated across turns. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getRequestAuth(req);
  if (!auth) return authenticationRequired();
  // Next 16: route params arrive as a Promise and must be awaited before use.
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id: id },
    include: { turns: { orderBy: { idx: "asc" } }, mother: { select: { displayName: true } } },
  });

  if (!session) {
    return NextResponse.json(
      { error: "not_found", messageSw: "Kikao hakipatikani.", messageEn: "Session not found." },
      { status: 404 },
    );
  }
  if (!canAccessChp(auth, session.chpCode)) return accessDenied();

  const items = session.turns.flatMap((t) => {
    const extraction = fromJsonColumn<{ items?: unknown[] }>(t.extractionJson, {});
    return extraction.items ?? [];
  });

  // `extractionJson` is null for two different reasons that must not be conflated: a genuine
  // extraction failure (both LLM attempts failed — orchestrator.ts sets extractionFailed: true),
  // or the safety scan correctly short-circuiting extraction entirely on an escalating turn
  // (extractionFailed: false, by design — see processTurn's safety.hit branch). Neither is
  // persisted per turn, so this infers it: a safety short-circuit can only ever be the turn that
  // caused the session to escalate, which — because the client stops recording immediately on
  // ESCALATE — is always the session's last turn. A null turn anywhere else is a real failure.
  const lastIdx = session.turns.length - 1;
  const extractionFailedCount = session.turns.filter((t, i) => {
    if (t.extractionJson !== null) return false;
    const isLikelySafetySkip = session.escalated && i === lastIdx;
    return !isLikelySafetySkip;
  }).length;

  return NextResponse.json({
    id: session.id,
    motherName: session.mother.displayName,
    chpCode: session.chpCode,
    consentGranted: session.consentGranted,
    escalated: session.escalated,
    status: session.status,
    coverage: fromJsonColumn(session.coverageJson, emptyCoverage()),
    languageProfile: fromJsonColumn(session.languageProfileJson, null),
    turnCount: session.turns.length,
    extractionFailedCount,
    items,
  });
}

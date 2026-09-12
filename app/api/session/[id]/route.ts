import { NextResponse } from "next/server";
import { prisma, fromJsonColumn } from "@/lib/db";
import { emptyCoverage } from "@/lib/clinical/coverage";

export const runtime = "nodejs";

/** Session state for S6, which must render every item accumulated across turns. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: { turns: { orderBy: { idx: "asc" } }, mother: { select: { displayName: true } } },
  });

  if (!session) {
    return NextResponse.json(
      { error: "not_found", messageSw: "Kikao hakipatikani.", messageEn: "Session not found." },
      { status: 404 },
    );
  }

  const items = session.turns.flatMap((t) => {
    const extraction = fromJsonColumn<{ items?: unknown[] }>(t.extractionJson, {});
    return extraction.items ?? [];
  });

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
    items,
  });
}

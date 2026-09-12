import { NextResponse } from "next/server";
import { prisma, fromJsonColumn } from "@/lib/db";

export const runtime = "nodejs";

/** One persisted record, for S7 / S8 and for re-opening from the home list. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Next 16: route params arrive as a Promise and must be awaited before use.
  const { id } = await params;
  const record = await prisma.screeningRecord.findUnique({
    where: { id: id },
    include: { mother: { select: { displayName: true } } },
  });

  if (!record) {
    return NextResponse.json(
      { error: "not_found", messageSw: "Rekodi haipatikani.", messageEn: "Record not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: record.id,
    motherName: record.mother.displayName,
    chpCode: record.chpCode,
    createdAt: record.createdAt,
    scores: fromJsonColumn(record.scoresJson, {}),
    items: fromJsonColumn(record.itemsJson, []),
    risk: fromJsonColumn(record.riskJson, {}),
    referral: fromJsonColumn(record.referralJson, {}),
    asr: fromJsonColumn(record.asrJson, {}),
    disclaimers: fromJsonColumn(record.disclaimersJson, []),
    handoverEn: record.handoverEn,
    backReadSw: record.backReadSw,
  });
}

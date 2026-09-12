import { NextResponse } from "next/server";
import { prisma, fromJsonColumn } from "@/lib/db";
import { canAccessChp } from "@/lib/auth/session";
import { accessDenied, authenticationRequired, getRequestAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";

/** One persisted record, for S7 / S8 and for re-opening from the home list. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getRequestAuth(req);
  if (!auth) return authenticationRequired();
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
  if (!canAccessChp(auth, record.chpCode)) return accessDenied();

  const response = {
    id: record.id,
    motherName: record.mother.displayName,
    chpCode: record.chpCode,
    createdAt: record.createdAt,
    scores: fromJsonColumn(record.scoresJson, {}),
    risk: fromJsonColumn(record.riskJson, {}),
    referral: fromJsonColumn(record.referralJson, {}),
    disclaimers: fromJsonColumn(record.disclaimersJson, []),
    handoverEn: record.handoverEn,
    backReadSw: record.backReadSw,
    // Detailed extraction and ASR metadata are operational data. The field workflow does not
    // need them, so they are returned only to an authenticated administrator.
    ...(auth.role === "admin" ? {
      items: fromJsonColumn(record.itemsJson, []),
      asr: fromJsonColumn(record.asrJson, {}),
    } : {}),
  };

  return NextResponse.json(response);
}

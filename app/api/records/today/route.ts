import { NextResponse } from "next/server";
import { prisma, fromJsonColumn } from "@/lib/db";
import { PHQ9_BAND_LABELS_SW, type Phq9Band } from "@/lib/clinical/score";
import { TIER_LABELS_SW, type ReferralTier } from "@/lib/clinical/route";
import { canAccessChp } from "@/lib/auth/session";
import { authenticationRequired, getRequestAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";

/** S1's list of today's screenings: mother name, time, band chip, tier chip. */
export async function GET(req: Request) {
  const session = getRequestAuth(req);
  if (!session) return authenticationRequired();
  const chp = new URL(req.url).searchParams.get("chp");
  if (!chp) return NextResponse.json({ records: [] });
  const chpCode = chp.toUpperCase();
  if (!canAccessChp(session, chpCode)) return NextResponse.json({ records: [] });

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.screeningRecord.findMany({
    where: { chpCode, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    include: { mother: { select: { displayName: true } } },
  });

  const records = rows.map((r) => {
    const scores = fromJsonColumn<{ phq9?: number; phq9Band?: Phq9Band }>(r.scoresJson, {});
    const referral = fromJsonColumn<{ tier?: ReferralTier }>(r.referralJson, {});
    const band = scores.phq9Band ? PHQ9_BAND_LABELS_SW[scores.phq9Band] : "—";
    return {
      id: r.id,
      motherName: r.mother.displayName,
      time: r.createdAt.toTimeString().slice(0, 5),
      // §16.5 band chip: word first, number second.
      band: scores.phq9 === undefined ? band : `${band} (${scores.phq9})`,
      tier: referral.tier ? TIER_LABELS_SW[referral.tier] : "—",
    };
  });

  return NextResponse.json({ records });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** Recent mothers for one-tap reselection on S2. Screening is repeatable across the perinatal window. */
export async function GET(req: Request) {
  const chp = new URL(req.url).searchParams.get("chp");
  if (!chp) return NextResponse.json({ mothers: [] });

  const mothers = await prisma.mother.findMany({
    where: { chpCode: chp.toUpperCase() },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, displayName: true, age: true },
  });

  return NextResponse.json({ mothers });
}

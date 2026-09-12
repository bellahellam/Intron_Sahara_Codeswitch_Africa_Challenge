import { NextResponse } from "next/server";
import { prisma, audit } from "@/lib/db";
import { emptyCoverage } from "@/lib/clinical/coverage";
import { toJsonColumn } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Create a session. Consent is NOT granted here — it is a separate, explicit act on S3, and the
 * session carries `consentGranted: false` until then. FR-03's gate reads that column.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    chpCode?: string;
    motherId?: string;
    displayName?: string;
    age?: number | null;
    anonymous?: boolean;
  } | null;

  if (!body?.chpCode) {
    return NextResponse.json(
      { error: "missing_chp_code", messageSw: "Nambari ya CHP inahitajika.", messageEn: "A CHP code is required." },
      { status: 400 },
    );
  }

  const chpCode = body.chpCode.trim().toUpperCase();
  await prisma.chp.upsert({ where: { code: chpCode }, create: { code: chpCode }, update: {} });

  let motherId = body.motherId;
  if (!motherId) {
    const name = (body.displayName ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "missing_name", messageSw: "Andika jina, au chagua 'Bila jina'.", messageEn: "Enter a name, or choose Anonymous." },
        { status: 400 },
      );
    }
    const mother = await prisma.mother.create({
      data: {
        displayName: name,
        age: body.age ?? null,
        anonymous: body.anonymous ?? false,
        chpCode,
      },
    });
    motherId = mother.id;
  }

  const session = await prisma.session.create({
    data: {
      motherId,
      chpCode,
      coverageJson: toJsonColumn(emptyCoverage()),
      probeIssuedJson: toJsonColumn({}),
    },
  });

  // No PHI in the audit payload — the mother id is a random uuid, not an identifier of a person
  // outside this database, and no name or age is recorded here.
  await audit(session.id, "session_started", { chpCode });

  return NextResponse.json({ sessionId: session.id, motherId });
}

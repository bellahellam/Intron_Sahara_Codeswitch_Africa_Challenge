import { NextResponse } from "next/server";
import { prisma, audit, bumpAnonymousCounter } from "@/lib/db";
import { CONSENT_SCRIPT_VERSION } from "@/lib/consent";

export const runtime = "nodejs";

/**
 * FR-03. Consent is an explicit act with two terminal outcomes, and it is never inferred from
 * speech (§9.2 step 4: "Consent is never inferred from speech. [SR]").
 *
 * On decline, NOTHING is stored except an anonymous counter: no name, no age, no session detail.
 * The mother record created on S2 is deleted, which cascades the session away with it.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    sessionId?: string;
    granted?: boolean;
    audioRetentionOptIn?: boolean;
    /** A SEPARATE consent point with its own script (§19.8). Never inferred from the main grant. */
    transcriptRetentionOptIn?: boolean;
  } | null;

  if (!body?.sessionId || typeof body.granted !== "boolean") {
    return NextResponse.json(
      { error: "bad_request", messageSw: "Ombi halijakamilika.", messageEn: "The request was incomplete." },
      { status: 400 },
    );
  }

  const session = await prisma.session.findUnique({ where: { id: body.sessionId } });
  if (!session) {
    return NextResponse.json(
      { error: "not_found", messageSw: "Kikao hakipatikani.", messageEn: "Session not found." },
      { status: 404 },
    );
  }

  if (!body.granted) {
    // Write the counter BEFORE the delete, so a crash between the two loses the count rather
    // than leaving the data it was supposed to remove.
    await bumpAnonymousCounter("consent_declined");
    const motherId = session.motherId;
    await prisma.session.delete({ where: { id: session.id } });
    // Only remove the mother if this was her only session; a returning mother's prior records
    // are hers and are not collateral of one declined visit.
    const remaining = await prisma.session.count({ where: { motherId } });
    const records = await prisma.screeningRecord.count({ where: { motherId } });
    if (remaining === 0 && records === 0) {
      await prisma.mother.delete({ where: { id: motherId } }).catch(() => {});
    }
    return NextResponse.json({ ok: true, granted: false });
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      consentGranted: true,
      consentAt: new Date(),
      scriptVersion: CONSENT_SCRIPT_VERSION,
      audioRetained: body.audioRetentionOptIn === true,
      transcriptRetained: body.transcriptRetentionOptIn === true,
    },
  });

  await audit(session.id, "consent_granted", {
    scriptVersion: CONSENT_SCRIPT_VERSION,
    audioRetained: body.audioRetentionOptIn === true,
    transcriptRetained: body.transcriptRetentionOptIn === true,
  });

  // Logged separately so a reviewer can count research opt-ins without reading consent records,
  // and so an unusually high rate — which would suggest the ask is not landing as optional — is
  // visible on its own.
  if (body.transcriptRetentionOptIn === true) {
    await audit(session.id, "transcript_retention_opt_in", { scriptVersion: CONSENT_SCRIPT_VERSION });
  }

  return NextResponse.json({ ok: true, granted: true });
}

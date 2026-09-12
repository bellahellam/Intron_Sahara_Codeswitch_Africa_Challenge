import { NextResponse } from "next/server";
import { prisma, bumpAnonymousCounter } from "@/lib/db";
import { canAccessChp } from "@/lib/auth/session";
import { accessDenied, authenticationRequired, getRequestAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";

/**
 * FR-27 + §9.3 "Escalation versus withdrawal of consent, resolved".
 *
 * WITHDRAWAL WINS ON DATA. Everything from this session is deleted, INCLUDING the escalation
 * record and the matched quote. There is no clinical-override exception, and building one would
 * mean the consent promise on S3 was conditional in a way the mother was never told about.
 * A screening tool that keeps a suicide disclosure against the discloser's explicit wish is a
 * surveillance tool.
 *
 * What survives: one anonymous counter, incremented on withdrawal-after-escalation. No
 * identifier, no timestamp finer than the day, no content. It exists so a pilot can detect
 * whether the escalation UI is frightening people into withdrawing.
 *
 * What does NOT live here: the CHP's duty of care. That was never a database row. S5 states it
 * to her before the withdrawal option is offered.
 */
export async function POST(req: Request) {
  const auth = getRequestAuth(req);
  if (!auth) return authenticationRequired();
  const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
  if (!body?.sessionId) {
    return NextResponse.json(
      { error: "bad_request", messageSw: "Ombi halijakamilika.", messageEn: "The request was incomplete." },
      { status: 400 },
    );
  }

  const session = await prisma.session.findUnique({ where: { id: body.sessionId } });
  if (!session) return NextResponse.json({ ok: true, alreadyGone: true });
  if (!canAccessChp(auth, session.chpCode)) return accessDenied();

  if (session.escalated) await bumpAnonymousCounter("withdrawn_after_escalation");
  else await bumpAnonymousCounter("withdrawn");

  // Cascades turns, records and audit events — including the escalation event and its quote.
  await prisma.session.delete({ where: { id: session.id } });

  const motherId = session.motherId;
  const remaining = await prisma.session.count({ where: { motherId } });
  const records = await prisma.screeningRecord.count({ where: { motherId } });
  if (remaining === 0 && records === 0) {
    await prisma.mother.delete({ where: { id: motherId } }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

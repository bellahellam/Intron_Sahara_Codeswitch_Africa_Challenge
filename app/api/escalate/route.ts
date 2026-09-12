import { NextResponse } from "next/server";
import { prisma, audit } from "@/lib/db";
import { canAccessChp } from "@/lib/auth/session";
import { accessDenied, authenticationRequired, getRequestAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";

/**
 * FR-26: the CHP can raise a risk flag manually at any time, producing the same S5 interrupt as
 * an automatic hit.
 *
 * This is also the OFFLINE safety control (§14.4a). Grace does not need the model to tell her
 * what she just heard, which is why S5 renders entirely from bundled local state and why the
 * product's offline safety story rests on the trained human in the room.
 *
 * POST with `acknowledged: true` records `Nimeongea naye`. The escalation itself is never
 * un-done by that, and no later edit can lower the tier (§11.8 rule 1).
 */
export async function POST(req: Request) {
  const auth = getRequestAuth(req);
  if (!auth) return authenticationRequired();
  const body = (await req.json().catch(() => null)) as {
    sessionId?: string;
    source?: "manual" | "llm_risk_flag";
    acknowledged?: boolean;
    /** §15.4 S5 step 2: was the quote suppressed because someone else could see the screen? */
    quoteSuppressed?: boolean;
  } | null;

  if (!body?.sessionId) {
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
  if (!canAccessChp(auth, session.chpCode)) return accessDenied();

  if (body.acknowledged) {
    await audit(session.id, "escalation_ack", { quoteSuppressed: body.quoteSuppressed === true });
    return NextResponse.json({ ok: true, escalated: true });
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      escalated: true,
      escalatedAt: session.escalatedAt ?? new Date(),
      status: "escalated",
    },
  });

  await audit(session.id, body.source === "manual" ? "manual_risk_flag" : "safety_hit", {
    source: body.source ?? "manual",
  });

  return NextResponse.json({ ok: true, escalated: true });
}

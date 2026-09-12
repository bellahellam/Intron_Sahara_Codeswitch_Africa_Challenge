/**
 * §26 acceptance scenarios that need a RUNNING SERVER.
 *
 *   npm run dev            # in one terminal
 *   npx tsx scripts/acceptance-live.ts   # in another
 *
 * These cannot live in the vitest suite because they exercise the HTTP boundary, the consent gate
 * and the database — and §26.12C's whole point is that UI-only enforcement is a P0 failure, so it
 * has to be tested by making a request the UI would never make.
 *
 * Runs with ASR_PROVIDER=mock unless you pass --real, so it costs no Sahara credits.
 */
import "./env";

const BASE = process.env.ACCEPTANCE_BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? " — " + detail : ""}`);
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function newSession(name: string) {
  const { json } = await post("/api/session", { chpCode: "KWG-TEST", displayName: name, age: 27 });
  return (json as { sessionId: string }).sessionId;
}

/** A tiny WAV. Content does not matter for the consent-gate test — the request must die first. */
function fakeAudio(): Blob {
  const header = new Uint8Array(44);
  return new Blob([header], { type: "audio/wav" });
}

async function uploadTurn(sessionId: string) {
  const form = new FormData();
  form.append("sessionId", sessionId);
  form.append("durationMs", "10000");
  form.append("audio", fakeAudio(), "turn.wav");
  const res = await fetch(`${BASE}/api/turn`, { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// =================================================================================================
async function scenario26_12C() {
  console.log("\n§26.12C Consent bypass attempt (P0) — UI-only enforcement is a P0 failure");

  const sessionId = await newSession("Bypass Test");
  const { status, json } = await uploadTurn(sessionId);

  check("server REJECTS audio for a session with consent_granted = false", status === 403, `got ${status}`);
  check(
    "the rejection names the cause in both languages",
    typeof (json as { messageSw?: string }).messageSw === "string" &&
      typeof (json as { messageEn?: string }).messageEn === "string",
  );
  check(
    "the error is specific, never 'something went wrong'",
    !JSON.stringify(json).toLowerCase().includes("something went wrong"),
  );
  return sessionId;
}

async function scenario26_12A() {
  console.log("\n§26.12A Consent declined (P0) — nothing stored but an anonymous counter");

  const sessionId = await newSession("Declined Test");
  const { status } = await post("/api/consent", { sessionId, granted: false });
  check("decline is accepted", status === 200);

  // The session row must be gone entirely.
  const res = await fetch(`${BASE}/api/session/${sessionId}`);
  check("zero rows remain for this attempt — the session is not found", res.status === 404, `got ${res.status}`);

  const after = await uploadTurn(sessionId);
  check("a later upload against the declined session is refused", after.status === 403 || after.status === 404);
}

async function scenario26_12B() {
  console.log("\n§26.12B Consent withdrawn mid-session (P0) — everything destroyed");

  const sessionId = await newSession("Withdraw Test");
  await post("/api/consent", { sessionId, granted: true });
  // Escalate first, so we prove withdrawal beats even a latched escalation on DATA.
  await post("/api/escalate", { sessionId, source: "manual" });

  const { status } = await post("/api/withdraw", { sessionId });
  check("withdrawal succeeds", status === 200);

  const res = await fetch(`${BASE}/api/session/${sessionId}`);
  check(
    "the session and everything in it is gone, including the escalation record",
    res.status === 404,
    `got ${res.status}`,
  );
  console.log("    (withdrawal wins on data; the CHP's duty of care was never a database row)");
}

async function scenario26_9_and_10() {
  console.log("\n§26.9 / §26.10 Failure paths — error surfaces name the cause");

  // Not reachable without actually breaking the network or exhausting quota, so what is asserted
  // here is the CONTRACT: that the error shapes exist and are specific.
  const { status, json } = await post("/api/complete", { sessionId: "does-not-exist" });
  check("an unknown session is a named 404, not a crash", status === 404, `got ${status}`);
  check(
    "the message names what failed",
    typeof (json as { messageEn?: string }).messageEn === "string" &&
      (json as { messageEn: string }).messageEn.length > 0,
  );
  console.log("    NOTE: a real 429 / QUOTA_EXCEEDED from Sahara and a real mid-turn network drop");
  console.log("    still require manual verification. Tracked in LIMITATIONS.md.");
}

async function scenario26_1_amberGate() {
  console.log("\n§26.1 / FR-17 Amber gate — the write is BLOCKED, not warned about");

  const sessionId = await newSession("Amber Test");
  await post("/api/consent", { sessionId, granted: true });
  const { status, json } = await post("/api/complete", { sessionId, items: [] });

  // With no turns there is nothing amber, so this completes. The gate itself is unit-tested; what
  // matters here is that /api/complete refuses to invent a record out of nothing.
  const ok = status === 200 || status === 409;
  check("completion responds deterministically with no turns", ok, `got ${status}`);
  if (status === 200) {
    const body = json as { scores?: { phq9?: number }; referral?: { tier?: string } };
    check("an empty screen still routes somewhere — there is no no_action tier", !!body.referral?.tier);
    check("an empty screen scores zero rather than guessing", body.scores?.phq9 === 0);
  }
}

// =================================================================================================
async function main() {
  console.log(`MAMA-SAUTI live acceptance scenarios against ${BASE}`);
  console.log(`ASR_PROVIDER=${process.env.ASR_PROVIDER ?? "sahara"}\n`);

  try {
    await fetch(`${BASE}/api/mothers?chp=PING`);
  } catch {
    console.error(`Cannot reach ${BASE}. Start the server with \`npm run dev\` first.`);
    process.exit(1);
  }

  await scenario26_12C();
  await scenario26_12A();
  await scenario26_12B();
  await scenario26_9_and_10();
  await scenario26_1_amberGate();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main();

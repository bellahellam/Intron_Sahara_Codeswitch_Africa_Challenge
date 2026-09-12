/**
 * Two roles, and the split is a safety decision rather than a convenience one.
 *
 * CHP — the person in the room. She is conducting a clinical conversation in someone's home while
 * holding a phone, a baby sling and sometimes a register. Every element on her screen competes
 * with the mother in front of her. She sees the mother's words, the coverage shape, one suggested
 * question, and the controls she actually needs. She sees NO confidence numbers, no model names,
 * no latencies, no benchmark tables — those would be noise at best and, at the moment of a
 * disclosure, an active harm.
 *
 * ADMIN — the person evaluating whether the system works. Latencies, drop counts, backstop fires,
 * which model is live, audit trails. None of it belongs on a doorstep.
 *
 * ⚠️ THIS IS NOT SECURITY. A CHP code is an identifier, not a secret (§14.5 says so explicitly),
 * and the admin gate is a shared passphrase in an environment variable. It keeps the technical
 * surface off the CHP's screen and gates a demo view. It would not withstand anyone who wanted in.
 * Real authentication is pilot work and is listed in §17.10.
 */

export type Role = "chp" | "admin";

export const ROLE_STORAGE_KEY = "mama_sauti_role";
export const ADMIN_TOKEN_STORAGE_KEY = "mama_sauti_admin_token";

/** What each role is allowed to see. Read this as the product's information architecture. */
export const ROLE_CAPABILITIES = {
  chp: {
    /** Her own screenings only. */
    seeOwnRecords: true,
    seeAllRecords: false,
    /** Numbers and model internals never reach the conversation screen. */
    seeConfidenceNumbers: false,
    seeModelNames: false,
    seeLatencies: false,
    seeAuditTrail: false,
    seeBenchmarks: false,
    seeLiveTranscripts: false,
    /** She can always raise a risk flag and always end a session. Non-negotiable. */
    raiseRiskFlag: true,
    conductScreening: true,
  },
  admin: {
    seeOwnRecords: true,
    seeAllRecords: true,
    seeConfidenceNumbers: true,
    seeModelNames: true,
    seeLatencies: true,
    seeAuditTrail: true,
    seeBenchmarks: true,
    /** Live sessions only — completed transcripts are destroyed by design. See lib/retention.ts. */
    seeLiveTranscripts: true,
    raiseRiskFlag: true,
    conductScreening: true,
  },
} as const satisfies Record<Role, Record<string, boolean>>;

export function can(role: Role, capability: keyof (typeof ROLE_CAPABILITIES)["admin"]): boolean {
  return ROLE_CAPABILITIES[role][capability] === true;
}

/**
 * Server-side check. The admin token lives in the environment and is compared in constant-ish
 * time; it is never sent to a client that has not already presented it.
 */
export function isAdminToken(presented: string | null | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !presented) return false;
  if (presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

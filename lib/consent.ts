/**
 * The consent script version, recorded on every session (§9.2 step 4).
 *
 * It lives outside the route handler because a Next.js route module may only export HTTP
 * handlers — but it belongs in shared code anyway: the version stamped on a stored consent
 * record has to match the script that was actually read aloud, and a pilot auditing old records
 * needs to know which wording each mother heard.
 *
 * BUMP THIS whenever COPY.consentScript changes. A consent record whose script_version points at
 * wording the mother never heard is worse than no version field at all.
 */
export const CONSENT_SCRIPT_VERSION = "v1";

/**
 * Prisma client + the JSON column shim.
 *
 * SQLite's Prisma connector has no `Json` scalar, so jsonb columns from §17.8 are stored as
 * `String` and marshalled here. On Postgres these become identity functions and the schema
 * changes `String` → `Json`. No call site changes either way — that is the whole point of
 * routing every read and write through this file.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function toJsonColumn(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJsonColumn<T>(value: string | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

/**
 * §17.8 observability: log what happened, never what she said.
 *
 * The PHI denylist is enforced by construction — `audit` takes a payload, and the test in
 * tests/logging.test.ts asserts that no audit payload written by this codebase carries a field
 * from the forbidden set. Transcript content, evidence spans, names and ages never enter a log
 * line or an audit payload.
 */
export const FORBIDDEN_LOG_FIELDS = [
  "transcript",
  "evidence_span",
  "evidenceSpan",
  "displayName",
  "display_name",
  "name",
  "age",
  "matchedText",
  "matched_text",
  "quote",
  "backRead",
  "back_read",
  "handover",
] as const;

export async function audit(
  sessionId: string | null,
  kind: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  if (payload) {
    for (const field of FORBIDDEN_LOG_FIELDS) {
      if (field in payload) {
        throw new Error(
          `audit(${kind}) payload contains forbidden PHI field "${field}". Log what happened, never what she said (§17.8).`,
        );
      }
    }
  }
  await prisma.auditEvent.create({
    data: { sessionId, kind, payloadJson: payload ? toJsonColumn(payload) : null },
  });
}

/**
 * §9.3 item 3: a single anonymous counter survives a withdrawal-after-escalation. No identifier,
 * no timestamp finer than the day, no content. It exists so a pilot can detect whether the
 * escalation UI is frightening people into withdrawing.
 */
export async function bumpAnonymousCounter(kind: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const id = `${kind}:${day}`;
  await prisma.anonymousCounter.upsert({
    where: { id },
    create: { id, kind, day, count: 1 },
    update: { count: { increment: 1 } },
  });
}

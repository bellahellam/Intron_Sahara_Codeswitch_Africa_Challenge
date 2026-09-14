/**
 * Contract 2b — `LLMAdapter`.
 *
 * Not in the original build spec, which assumed a single provider (§17.1 recommends Claude
 * Sonnet). The provider here is unsettled — a free tier chosen to keep the build moving — so it
 * gets the same treatment as ASR: one interface, provider behind it, switching is an env var.
 *
 * `temperature = 0` is set by the adapter and is NOT a caller-tunable parameter, because every
 * clinical output in this product must be reproducible from the same transcript.
 *
 * Schema adherence is never trusted from the model. Every response is re-validated in code.
 */

/**
 * Every LLM-backed route (`/api/turn`, `/api/backread`, `/api/complete`) caps at
 * `maxDuration = 60` on Vercel, and each retries a failed completion once. `/api/turn` is the
 * tightest case: extraction and probe generation run sequentially in the same request, so a
 * single turn can attempt up to 4 completions. 4 x 10s leaves real room for the ASR call and DB
 * writes sharing that same 60s budget — a hung or degraded provider call is aborted and retried
 * quickly instead of eating the whole request on one attempt (as 45s previously did: two 45s
 * attempts alone was already 90s, longer than the function had to run at all).
 */
export const DEFAULT_LLM_TIMEOUT_MS = 10_000;

export interface CompletionRequest {
  system: string;
  user: string;
  /** JSON Schema. Providers that support structured output enforce it; the rest get it in the prompt. */
  schema?: Record<string, unknown>;
  schemaName?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface CompletionResult {
  text: string;
  latencyMs: number;
  meta: Record<string, unknown>;
}

export interface LLMAdapter {
  name: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export type LLMErrorKind = "auth" | "quota" | "rate_limit" | "timeout" | "network" | "server" | "schema" | "unknown";

export class LLMError extends Error {
  readonly kind: LLMErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly adapter: string;

  constructor(
    kind: LLMErrorKind,
    message: string,
    opts: { adapter: string; status?: number; retryAfterMs?: number; cause?: unknown },
  ) {
    super(message, { cause: opts.cause });
    this.name = "LLMError";
    this.kind = kind;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
    this.adapter = opts.adapter;
  }

  /** FR-31 again: name what failed and what to do next. Never "something went wrong". */
  get chpMessageSw(): string {
    switch (this.kind) {
      case "quota":
        return "Salio la huduma limeisha. Wasiliana na msimamizi.";
      case "rate_limit":
        return "Mfumo una shughuli nyingi. Subiri kidogo, kisha jaribu tena.";
      case "schema":
        return "Mfumo haukuelewa vizuri. Andika kipengele hiki mwenyewe.";
      case "timeout":
      case "network":
        return "Hakuna mtandao. Maandishi yamehifadhiwa, tutajaribu tena.";
      default:
        return "Uchambuzi haukufanikiwa. Unaweza kuandika kipengele hiki mwenyewe.";
    }
  }

  get chpMessageEn(): string {
    switch (this.kind) {
      case "quota":
        return "Service balance exhausted. Contact your supervisor.";
      case "rate_limit":
        return "The service is busy. Wait a moment, then try again.";
      case "schema":
        return "The analysis did not come back in a usable shape. Enter this item manually.";
      case "timeout":
      case "network":
        return "No network. The transcript is saved, we'll try again.";
      default:
        return "Extraction failed. You can enter this item manually.";
    }
  }
}

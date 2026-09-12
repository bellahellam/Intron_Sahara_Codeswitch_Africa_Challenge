/**
 * Contract 1 — `ASRAdapter` (§17.5, docs/contracts.md).
 *
 * Everything about which speech model is in use sits behind this one function signature.
 * Swapping the product's ASR is a config change; that is also what makes the benchmark honest
 * rather than decorative, because the thing being benchmarked is literally the thing the
 * product calls.
 */

export interface TranscribeOptions {
  /** In Sahara's API the code-switched PAIR *is* the language code. `sw` = Swahili-English. */
  lang: string;
  /** Wall-clock ceiling for one call. The caller owns retry; the adapter never retries. */
  timeoutMs?: number;
}

export interface TranscribeResult {
  /** The transcript, verbatim. No trimming, no normalisation, no casing changes. */
  text: string;
  /** Measured at this boundary, for §14.1 and the benchmark. */
  latencyMs: number;
  /** Model-specific extras. Never read by product logic. */
  meta: Record<string, unknown>;
}

export interface ASRAdapter {
  /** Hyphens only — Intron's reference harness splits model ids on "_" (§18.7). */
  name: string;
  transcribe(audio: Blob | Buffer, opts: TranscribeOptions): Promise<TranscribeResult>;
}

export type ASRErrorKind =
  | "auth" // bad or missing key
  | "quota" // QUOTA_EXCEEDED / insufficient credits — a named, specific message, not "something went wrong"
  | "rate_limit" // 429; honour Retry-After in the CALLER
  | "insufficient_audio" // INSUFFICIENT_AUDIO_ACTIVITY — she may not have been picked up
  | "timeout"
  | "network"
  | "server"
  | "unsupported_media"
  | "unknown";

/**
 * Errors THROW. They never return an empty string.
 *
 * An empty `text` means "she said nothing". A failed call means "we do not know what she said".
 * Conflating those two is how a screening record silently loses a turn, which is why this is in
 * the contract rather than in a style guide.
 */
export class ASRError extends Error {
  readonly kind: ASRErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly adapter: string;

  constructor(
    kind: ASRErrorKind,
    message: string,
    opts: { adapter: string; status?: number; retryAfterMs?: number; cause?: unknown } ,
  ) {
    super(message, { cause: opts.cause });
    this.name = "ASRError";
    this.kind = kind;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
    this.adapter = opts.adapter;
  }

  /**
   * FR-31: every error names what failed and what to do next. No string here is
   * "something went wrong" — a test asserts that.
   */
  get chpMessageSw(): string {
    switch (this.kind) {
      case "quota":
        return "Salio la huduma limeisha. Wasiliana na msimamizi.";
      case "rate_limit":
        return "Mfumo una shughuli nyingi. Subiri sekunde chache, kisha jaribu tena.";
      case "insufficient_audio":
        return "Sauti haikusikika vizuri. Sogeza simu karibu kidogo.";
      case "timeout":
      case "network":
        return "Hakuna mtandao. Rekodi imehifadhiwa, tutajaribu tena.";
      case "auth":
        return "Mfumo hauwezi kuunganishwa na huduma ya sauti. Wasiliana na msimamizi.";
      case "unsupported_media":
        return "Aina ya sauti haikubaliki. Wasiliana na msimamizi.";
      default:
        return "Huduma ya sauti haikujibu. Rekodi imehifadhiwa, jaribu tena.";
    }
  }

  get chpMessageEn(): string {
    switch (this.kind) {
      case "quota":
        return "Service balance exhausted. Contact your supervisor.";
      case "rate_limit":
        return "The service is busy. Wait a few seconds, then try again.";
      case "insufficient_audio":
        return "The voice wasn't clear. Move the phone a bit closer.";
      case "timeout":
      case "network":
        return "No network. The recording is saved, we'll try again.";
      case "auth":
        return "Cannot connect to the speech service. Contact your supervisor.";
      case "unsupported_media":
        return "That audio format was rejected. Contact your supervisor.";
      default:
        return "The speech service did not respond. The recording is saved; try again.";
    }
  }
}

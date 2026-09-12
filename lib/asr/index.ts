/**
 * ASR registry + the retry policy.
 *
 * Per the contract, adapters never retry. Backoff, `Retry-After` handling and the audio-retention
 * promise ("the mother never repeats herself", §14.2) all live here, in the caller.
 */

import { MockASRAdapter, FIXTURE_UTTERANCES as FIXTURES } from "./mock";
import { SaharaAdapter } from "./sahara";
import { ASRError, type ASRAdapter, type TranscribeOptions, type TranscribeResult } from "./types";

export * from "./types";
export { SaharaAdapter } from "./sahara";
export { MockASRAdapter, FIXTURE_UTTERANCES } from "./mock";

export function getASRAdapter(): ASRAdapter {
  const provider = (process.env.ASR_PROVIDER ?? "sahara").toLowerCase();
  switch (provider) {
    case "mock": {
      // ASR_MOCK_FIXTURE selects one of the §5.3 reference utterances, so the acceptance
      // scenarios in §26 can be walked through the real UI without spending Sahara credits.
      const key = process.env.ASR_MOCK_FIXTURE as keyof typeof FIXTURES | undefined;
      return new MockASRAdapter(key && FIXTURES[key] ? { transcripts: [FIXTURES[key]] } : {});
    }
    case "sahara":
    default:
      return new SaharaAdapter({
        disableLlmCorrections: process.env.SAHARA_DISABLE_LLM_CORRECTIONS !== "false",
      });
  }
}

/** Which error kinds are worth trying again. Quota and auth are not — retrying wastes the CHP's time. */
function isRetryable(err: unknown): err is ASRError {
  return (
    err instanceof ASRError &&
    (err.kind === "rate_limit" || err.kind === "network" || err.kind === "timeout" || err.kind === "server")
  );
}

export interface TranscribeWithRetryOptions extends TranscribeOptions {
  maxAttempts?: number;
  onAttemptFailed?: (attempt: number, err: ASRError) => void;
}

/**
 * §14.2: "Sahara down → the turn is retried with backoff; audio is retained so the mother never
 * repeats herself; after 3 failures, offer manual entry so the screening still completes."
 * The audio blob is held by the caller for exactly that reason.
 */
export async function transcribeWithRetry(
  adapter: ASRAdapter,
  audio: Blob | Buffer,
  opts: TranscribeWithRetryOptions,
): Promise<TranscribeResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastError: ASRError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await adapter.transcribe(audio, opts);
    } catch (err) {
      if (!isRetryable(err)) throw err;
      lastError = err;
      opts.onAttemptFailed?.(attempt, err);
      if (attempt === maxAttempts) break;
      // Honour Retry-After when the server told us; otherwise exponential backoff.
      const backoff = err.retryAfterMs ?? Math.min(8000, 500 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  throw lastError ?? new ASRError("unknown", "Transcription failed with no recorded error.", { adapter: adapter.name });
}

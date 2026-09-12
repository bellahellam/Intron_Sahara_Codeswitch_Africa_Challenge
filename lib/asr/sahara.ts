/**
 * SaharaAdapter — Intron Sahara v2.5 file-sync ASR (§17.5).
 *
 * Two configuration details that matter and are easy to get wrong:
 *
 * 1. **Sahara's default pipeline applies LLM corrections to the transcript.** The product sets
 *    `use_disable_llm_corrections = TRUE` — corrections OFF — and so does the benchmark's primary
 *    column. Three reasons, recorded because it is not the obvious choice:
 *      (a) Evidence integrity. Every score is justified by a verbatim quote read back to the
 *          mother. A quote drawn from an undisclosed LLM's smoothed rewrite is not her words,
 *          and the back-read would be asking her to confirm a sentence she did not say.
 *      (b) The safety layer would stop being deterministic. With corrections ON, a correcting
 *          LLM sits upstream of the scan and could normalise a hedged suicidal phrase.
 *      (c) The release gate would measure the wrong configuration. SPR = 1.00 is gated on the
 *          benchmark; if the benchmark measures corrections-OFF and the product runs ON, the
 *          gate gates nothing.
 *    Trade-off accepted: raw output is rougher. We take that in exchange for being able to say
 *    truthfully that what appears on screen is what she said.
 *
 * 2. **Sync returns 503 *with* the `file_id`** after 120 s. Fall back to polling
 *    GET /file/v1/status/{file_id}: FILE_QUEUED → FILE_PENDING → FILE_PROCESSING →
 *    FILE_TRANSCRIBED | FILE_PROCESSING_FAILED.
 *
 * Rate limits (from the docs): sync 30/min, async 60/min, status 100/min. `Retry-After` on 429.
 * This adapter never retries — that is the caller's job, per the contract.
 */

import { ASRError, type ASRAdapter, type TranscribeOptions, type TranscribeResult } from "./types";

const BASE = process.env.SAHARA_BASE_URL ?? "https://infer.voice.intron.io";
const SYNC_PATH = "/file/v1/upload/sync";
const STATUS_PATH = "/file/v1/status";

export interface SaharaOptions {
  /** FALSE re-enables Sahara's undisclosed LLM post-processor. The product always runs TRUE. */
  disableLlmCorrections?: boolean;
  /** SH7, gated on the T+24 milestone and on the compatibility test in §11.3a. Off by default. */
  useDiarization?: boolean;
  apiKey?: string;
}

/**
 * The docs do not pin down the transcript field name, and guessing silently is how a product
 * ships an empty string that looks like silence. We look through the plausible keys, and if none
 * is present we THROW with the response shape in the message so it is fixed in one edit.
 */
function extractText(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;

  const directKeys = ["transcript", "transcription", "text", "hypothesis", "result", "output"];
  for (const key of directKeys) {
    const v = obj[key];
    if (typeof v === "string") return v;
  }
  // One level of nesting: { data: {...} }, { result: {...} }
  for (const key of ["data", "result", "response", "payload"]) {
    const v = obj[key];
    if (v && typeof v === "object") {
      const nested = extractText(v);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function statusOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  for (const key of ["status", "file_status", "state"]) {
    const v = obj[key];
    if (typeof v === "string") return v;
  }
  return null;
}

function fileIdOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  for (const key of ["file_id", "fileId", "id"]) {
    const v = obj[key];
    if (typeof v === "string") return v;
  }
  return null;
}

function classify(status: number, bodyText: string): ASRError["kind"] {
  const upper = bodyText.toUpperCase();
  if (upper.includes("QUOTA_EXCEEDED") || upper.includes("INSUFFICIENT_CREDIT")) return "quota";
  if (upper.includes("INSUFFICIENT_AUDIO_ACTIVITY")) return "insufficient_audio";
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 415) return "unsupported_media";
  if (status >= 500) return "server";
  return "unknown";
}

function retryAfterMs(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

export class SaharaAdapter implements ASRAdapter {
  readonly name: string;
  private readonly apiKey: string;
  private readonly disableCorrections: boolean;
  private readonly useDiarization: boolean;

  constructor(opts: SaharaOptions = {}) {
    const key = opts.apiKey ?? process.env.SAHARA_API_KEY ?? "";
    if (!key) {
      throw new ASRError("auth", "SAHARA_API_KEY is not set. Put it in .env.local — it is never sent to the client.", {
        adapter: "sahara-v2.5",
      });
    }
    this.apiKey = key;
    this.disableCorrections = opts.disableLlmCorrections ?? true;
    this.useDiarization = opts.useDiarization ?? false;
    // Hyphens only. An underscore in a model id silently breaks Intron's evaluation harness.
    this.name = `sahara-v2.5-corr-${this.disableCorrections ? "off" : "on"}`;
  }

  async transcribe(audio: Blob | Buffer, opts: TranscribeOptions): Promise<TranscribeResult> {
    const startedAt = Date.now();
    const blob =
      audio instanceof Blob ? audio : new Blob([new Uint8Array(audio)], { type: "audio/wav" });

    const form = new FormData();
    form.append("audio_file_name", filenameFor(blob));
    form.append("audio_file_blob", blob, filenameFor(blob));
    form.append("use_language_asr_input", opts.lang);
    form.append("use_disable_llm_corrections", this.disableCorrections ? "TRUE" : "FALSE");
    if (this.useDiarization) form.append("use_diarization", "TRUE");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 130_000);

    let res: Response;
    try {
      res = await fetch(`${BASE}${SYNC_PATH}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timeout);
      const aborted = controller.signal.aborted;
      throw new ASRError(
        aborted ? "timeout" : "network",
        aborted ? "Sahara did not respond within the timeout." : "Could not reach Sahara.",
        { adapter: this.name, cause },
      );
    } finally {
      clearTimeout(timeout);
    }

    const bodyText = await res.text();
    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      payload = bodyText;
    }

    // The documented 503-with-file_id path: the job outlived the sync window but is still running.
    if (res.status === 503) {
      const fileId = fileIdOf(payload);
      if (fileId) {
        const text = await this.pollStatus(fileId, opts.timeoutMs ?? 130_000);
        return { text, latencyMs: Date.now() - startedAt, meta: { fileId, path: "status-poll", model: this.name } };
      }
    }

    if (!res.ok) {
      throw new ASRError(classify(res.status, bodyText), `Sahara ${res.status}: ${bodyText.slice(0, 400)}`, {
        adapter: this.name,
        status: res.status,
        retryAfterMs: retryAfterMs(res),
      });
    }

    const text = extractText(payload);
    if (text === null) {
      throw new ASRError(
        "unknown",
        `Sahara returned 200 but no recognisable transcript field. Keys: ${
          payload && typeof payload === "object" ? Object.keys(payload as object).join(", ") : typeof payload
        }. Add the correct key to extractText() in lib/asr/sahara.ts.`,
        { adapter: this.name, status: res.status },
      );
    }

    return {
      text, // returned unmodified, per the contract
      latencyMs: Date.now() - startedAt,
      meta: { path: "sync", model: this.name, raw: payload },
    };
  }

  private async pollStatus(fileId: string, budgetMs: number): Promise<string> {
    const deadline = Date.now() + budgetMs;
    // Status is rate-limited to 100/min; 2 s is comfortably inside that for one session.
    const intervalMs = 2000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, intervalMs));
      const res = await fetch(`${BASE}${STATUS_PATH}/${encodeURIComponent(fileId)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      const bodyText = await res.text();
      let payload: unknown;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        payload = bodyText;
      }

      if (!res.ok) {
        throw new ASRError(classify(res.status, bodyText), `Sahara status ${res.status}: ${bodyText.slice(0, 300)}`, {
          adapter: this.name,
          status: res.status,
          retryAfterMs: retryAfterMs(res),
        });
      }

      const status = statusOf(payload);
      if (status === "FILE_TRANSCRIBED") {
        const text = extractText(payload);
        if (text === null) {
          throw new ASRError("unknown", "Sahara reported FILE_TRANSCRIBED with no transcript field.", {
            adapter: this.name,
          });
        }
        return text;
      }
      if (status === "FILE_PROCESSING_FAILED") {
        throw new ASRError("server", "Sahara reported FILE_PROCESSING_FAILED.", { adapter: this.name });
      }
      // FILE_QUEUED | FILE_PENDING | FILE_PROCESSING → keep waiting
    }

    throw new ASRError("timeout", "Sahara transcription did not finish within the budget.", { adapter: this.name });
  }
}

function filenameFor(blob: Blob): string {
  const type = blob.type || "audio/webm";
  if (type.includes("wav")) return "turn.wav";
  if (type.includes("ogg")) return "turn.ogg";
  if (type.includes("mp4") || type.includes("m4a")) return "turn.m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "turn.mp3";
  if (type.includes("flac")) return "turn.flac";
  return "turn.webm";
}

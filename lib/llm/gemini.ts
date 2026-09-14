/**
 * GeminiAdapter — Google AI Studio.
 *
 * Kept alongside the OpenAI-compatible adapter because it is the strongest genuinely-free option
 * for this job: `responseSchema` is enforced server-side, which matters more here than raw model
 * quality. If free-tier schema violations become frequent during testing, this is the switch.
 */

import { DEFAULT_LLM_TIMEOUT_MS, LLMError, type CompletionRequest, type CompletionResult, type LLMAdapter } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Gemini's responseSchema is a subset of JSON Schema: it rejects `additionalProperties`,
 * `minimum`/`maximum`, and union types like `["string","null"]`. Strip them rather than letting
 * the request 400 — the Zod validator downstream re-imposes every constraint removed here.
 */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;

  const src = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(src)) {
    // `enum` IS supported and is deliberately kept — it is what stops the model inventing a construct.
    if (key === "additionalProperties" || key === "minimum" || key === "maximum") continue;
    if (key === "type" && Array.isArray(value)) {
      // ["string","null"] → "string", with nullability expressed by omission from `required`.
      out.type = value.find((t) => t !== "null") ?? "string";
      out.nullable = value.includes("null");
      continue;
    }
    out[key] = toGeminiSchema(value);
  }
  return out;
}

export class GeminiAdapter implements LLMAdapter {
  readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts: { apiKey?: string; model?: string } = {}) {
    const key = opts.apiKey ?? process.env.GOOGLE_API_KEY ?? "";
    if (!key) throw new LLMError("auth", "GOOGLE_API_KEY is not set.", { adapter: "gemini" });
    this.apiKey = key;
    this.model = opts.model ?? process.env.LLM_MODEL ?? "gemini-2.5-flash";
    this.name = `gemini-${this.model}`;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const startedAt = Date.now();

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: req.maxTokens ?? 2048,
        ...(req.schema
          ? { responseMimeType: "application/json", responseSchema: toGeminiSchema(req.schema) }
          : {}),
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${BASE}/models/${this.model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timeout);
      const aborted = controller.signal.aborted;
      throw new LLMError(aborted ? "timeout" : "network", aborted ? "Gemini timed out." : "Could not reach Gemini.", {
        adapter: this.name,
        cause,
      });
    } finally {
      clearTimeout(timeout);
    }

    const bodyText = await res.text();
    if (!res.ok) {
      const kind =
        res.status === 401 || res.status === 403
          ? "auth"
          : res.status === 429
            ? "rate_limit"
            : res.status >= 500
              ? "server"
              : "unknown";
      throw new LLMError(kind, `Gemini ${res.status}: ${bodyText.slice(0, 400)}`, {
        adapter: this.name,
        status: res.status,
      });
    }

    let payload: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: unknown };
    try {
      payload = JSON.parse(bodyText);
    } catch (cause) {
      throw new LLMError("schema", "Gemini returned a non-JSON envelope.", { adapter: this.name, cause });
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new LLMError("schema", "Gemini returned no content.", { adapter: this.name });

    return { text, latencyMs: Date.now() - startedAt, meta: { model: this.model, usage: payload.usageMetadata } };
  }
}

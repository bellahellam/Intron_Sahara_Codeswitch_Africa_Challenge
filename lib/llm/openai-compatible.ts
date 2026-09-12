/**
 * One adapter covering every provider that speaks the OpenAI chat-completions shape:
 * xAI (Grok), Groq, OpenRouter, Cerebras, Mistral, Together, and OpenAI itself.
 *
 * This is why the LLMAdapter contract exists. The provider on this build is a free-tier stopgap
 * and is expected to change before submission; changing it must not touch a call site.
 */

import { LLMError, type CompletionRequest, type CompletionResult, type LLMAdapter } from "./types";

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Providers differ on whether they enforce `json_schema` or only `json_object`. */
  structuredOutput: "json_schema" | "json_object" | "none";
  /** Sent as an extra header by OpenRouter for attribution. Harmless elsewhere. */
  extraHeaders?: Record<string, string>;
}

export class OpenAICompatibleAdapter implements LLMAdapter {
  readonly name: string;
  private readonly cfg: OpenAICompatibleConfig;

  constructor(cfg: OpenAICompatibleConfig) {
    this.cfg = cfg;
    this.name = cfg.name;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const startedAt = Date.now();

    const body: Record<string, unknown> = {
      model: this.cfg.model,
      // Every clinical output must be reproducible from the same transcript.
      temperature: 0,
      max_tokens: req.maxTokens ?? 2048,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    };

    if (req.schema && this.cfg.structuredOutput === "json_schema") {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: req.schemaName ?? "extraction", strict: true, schema: req.schema },
      };
    } else if (req.schema && this.cfg.structuredOutput === "json_object") {
      body.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? 45_000);

    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cfg.apiKey}`,
          "Content-Type": "application/json",
          ...this.cfg.extraHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timeout);
      const aborted = controller.signal.aborted;
      throw new LLMError(aborted ? "timeout" : "network", aborted ? "LLM timed out." : "Could not reach the LLM.", {
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
            : /quota|credit|billing/i.test(bodyText)
              ? "quota"
              : res.status >= 500
                ? "server"
                : "unknown";
      const retryAfter = Number(res.headers.get("retry-after"));
      throw new LLMError(kind, `${this.name} ${res.status}: ${bodyText.slice(0, 400)}`, {
        adapter: this.name,
        status: res.status,
        retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
      });
    }

    let payload: { choices?: Array<{ message?: { content?: string } }>; usage?: unknown };
    try {
      payload = JSON.parse(bodyText);
    } catch (cause) {
      throw new LLMError("schema", `${this.name} returned a non-JSON envelope.`, { adapter: this.name, cause });
    }

    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new LLMError("schema", `${this.name} returned no message content.`, { adapter: this.name });
    }

    return { text, latencyMs: Date.now() - startedAt, meta: { model: this.cfg.model, usage: payload.usage } };
  }
}

/**
 * LLM registry.
 *
 * ⚠️ PROVIDER IS PROVISIONAL. The build spec (§17.1) recommends Claude Sonnet with temperature 0
 * and a strict JSON schema, because structured-output reliability is the binding requirement.
 * This build runs a free tier as a cost stopgap. Revisit before submission, and immediately if
 * `extraction_failed` events become frequent in testing. Gemini 2.5 Flash is the strongest
 * genuinely-free fallback: its `responseSchema` is enforced server-side.
 *
 * Switching provider is `LLM_PROVIDER` in .env.local. No call site changes.
 */

import { GeminiAdapter } from "./gemini";
import { OpenAICompatibleAdapter } from "./openai-compatible";
import { LLMError, type LLMAdapter } from "./types";

export * from "./types";
export { OpenAICompatibleAdapter } from "./openai-compatible";
export { GeminiAdapter } from "./gemini";

interface ProviderPreset {
  baseUrl: string;
  envKey: string;
  defaultModel: string;
  structuredOutput: "json_schema" | "json_object" | "none";
  extraHeaders?: Record<string, string>;
}

const PRESETS: Record<string, ProviderPreset> = {
  xai: {
    baseUrl: "https://api.x.ai/v1",
    envKey: "XAI_API_KEY",
    defaultModel: "grok-4-fast",
    structuredOutput: "json_schema",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    structuredOutput: "json_object",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    // CHOSEN BY MEASUREMENT, not reputation — see docs/llm-selection.md.
    // Scored 3/3 schema-valid and 9/9 literal evidence spans on the three cases that matter
    // (rumination, somatic-only, hedged risk), and got both behavioural calls right.
    // Model ids churn; if this 404s, re-run `npx tsx scripts/compare-llms.ts` rather than
    // guessing a replacement.
    defaultModel: "nex-agi/nex-n2.5-pro:free",
    structuredOutput: "json_schema",
    extraHeaders: { "X-Title": "MAMA-SAUTI" },
  },
  cerebras: {
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
    defaultModel: "llama-3.3-70b",
    structuredOutput: "json_object",
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY",
    defaultModel: "mistral-large-latest",
    structuredOutput: "json_object",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4.1-mini",
    structuredOutput: "json_schema",
  },
  anthropic: {
    // Anthropic's own endpoint is not OpenAI-shaped; when the provider is settled, add a native
    // adapter here rather than routing Claude through a compatibility shim.
    baseUrl: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5",
    structuredOutput: "none",
  },
};

export function getLLMAdapter(): LLMAdapter {
  const provider = (process.env.LLM_PROVIDER ?? "xai").toLowerCase();

  if (provider === "gemini" || provider === "google") {
    return new GeminiAdapter();
  }

  if (provider === "anthropic") {
    throw new LLMError(
      "unknown",
      "A native Anthropic adapter is not implemented yet. Use LLM_PROVIDER=xai, gemini, groq, openrouter, cerebras, mistral or openai.",
      { adapter: "anthropic" },
    );
  }

  const preset = PRESETS[provider];
  if (!preset) {
    throw new LLMError("unknown", `Unknown LLM_PROVIDER "${provider}". Known: ${Object.keys(PRESETS).join(", ")}, gemini.`, {
      adapter: provider,
    });
  }

  const apiKey = process.env[preset.envKey];
  if (!apiKey) {
    throw new LLMError("auth", `${preset.envKey} is not set. Put it in .env.local — it is never sent to the client.`, {
      adapter: provider,
    });
  }

  return new OpenAICompatibleAdapter({
    name: `${provider}-${process.env.LLM_MODEL ?? preset.defaultModel}`,
    baseUrl: preset.baseUrl,
    apiKey,
    model: process.env.LLM_MODEL ?? preset.defaultModel,
    structuredOutput: preset.structuredOutput,
    extraHeaders: preset.extraHeaders,
  });
}

/**
 * Strip the markdown fences some models wrap JSON in despite being asked not to, then parse.
 * Deliberately tolerant about the envelope and completely intolerant about the contents — the
 * Zod schema downstream does the real work.
 */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Some models prepend a sentence. Take the outermost brace-balanced object.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new LLMError("schema", "Model output was not JSON.", { adapter: "parse" });
  }
}

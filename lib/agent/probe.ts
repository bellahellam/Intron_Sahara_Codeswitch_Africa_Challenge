/**
 * Probe generation (§11.6, FR-14).
 *
 * One question, ≤20 words, in her register, referencing her own words, never leading, never
 * containing a clinical label, and always presented to the CHP as a suggestion she may skip.
 *
 * The PHQ-9 item-9 probe never comes through here. It is read from a file (§11.6a), because it
 * is the single highest-stakes utterance the system produces and runtime variation buys nothing.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { getConstruct, ITEM_9, type ConstructId } from "@/lib/clinical/constructs";
import { buildProbePrompt } from "@/lib/extraction/prompt";
import { getLLMAdapter, LLMError } from "@/lib/llm";
import { checkDenylist, SAFE_FALLBACK } from "@/lib/safety/denylist";

export interface GeneratedProbe {
  text: string;
  /** True when this came from data/probes/, not from a model. Shown in the demo and the logs. */
  fixed: boolean;
  targetConstruct: ConstructId;
  /** Set when the denylist rejected a generation and we fell back (FR-24a). */
  fellBackToTemplate?: boolean;
  denylistHits?: number;
  latencyMs?: number;
}

let item9Cache: Record<string, string> = {};

/** §11.6a. Stored as a file, not in a prompt, and on the never-cut list. */
export function fixedItem9Probe(lang: "sw" | "en" = "sw"): string {
  if (!item9Cache[lang]) {
    item9Cache[lang] = readFileSync(
      path.join(process.cwd(), "data", "probes", `phq9_item9.${lang}.txt`),
      "utf8",
    ).trim();
  }
  return item9Cache[lang];
}

const MAX_PROBE_WORDS = 20;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** A generated probe must be exactly one question. A stacked pair is unusable in the room. */
function firstQuestionOnly(text: string): string {
  const cleaned = text.trim().replace(/^["'«»]+|["'«»]+$/g, "");
  const firstQ = cleaned.indexOf("?");
  return firstQ === -1 ? cleaned : cleaned.slice(0, firstQ + 1);
}

export async function generateProbe(input: {
  targetConstruct: ConstructId;
  matrixLanguage: "sw" | "en";
  herQuotes: string[];
  somaticOnly: boolean;
  useFixed?: boolean;
}): Promise<GeneratedProbe> {
  // The gate's own probe. Never generated, never varied.
  if (input.useFixed || input.targetConstruct === ITEM_9) {
    return { text: fixedItem9Probe(input.matrixLanguage), fixed: true, targetConstruct: ITEM_9 };
  }

  const def = getConstruct(input.targetConstruct);
  const prompt = buildProbePrompt({
    targetConstructId: input.targetConstruct,
    targetConstructLabel: def?.labelEn ?? input.targetConstruct,
    matrixLanguage: input.matrixLanguage,
    herQuotes: input.herQuotes,
    somaticOnly: input.somaticOnly,
  });

  const adapter = getLLMAdapter();
  let latencyMs = 0;

  // FR-24a: on a denylist hit the string is regenerated once; on a second hit the surface falls
  // back to a fixed safe template and the event is logged.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await adapter.complete({ ...prompt, maxTokens: 200 });
      latencyMs += result.latencyMs;
      const text = firstQuestionOnly(result.text);

      const hits = checkDenylist(text);
      const tooLong = wordCount(text) > MAX_PROBE_WORDS;

      if (hits.length === 0 && !tooLong && text.length > 0) {
        return { text, fixed: false, targetConstruct: input.targetConstruct, latencyMs };
      }

      if (attempt === 2) {
        return {
          text: input.matrixLanguage === "sw" ? SAFE_FALLBACK.probeSw : SAFE_FALLBACK.probeEn,
          fixed: false,
          targetConstruct: input.targetConstruct,
          fellBackToTemplate: true,
          denylistHits: hits.length,
          latencyMs,
        };
      }
    } catch (err) {
      if (err instanceof LLMError && attempt === 2) {
        // A failed probe is not a failed screening. The CHP still has the opening question and
        // her own judgement; §12.6 forbids pretending, not degrading.
        return {
          text: input.matrixLanguage === "sw" ? SAFE_FALLBACK.probeSw : SAFE_FALLBACK.probeEn,
          fixed: false,
          targetConstruct: input.targetConstruct,
          fellBackToTemplate: true,
          latencyMs,
        };
      }
      if (!(err instanceof LLMError)) throw err;
    }
  }

  return {
    text: input.matrixLanguage === "sw" ? SAFE_FALLBACK.probeSw : SAFE_FALLBACK.probeEn,
    fixed: false,
    targetConstruct: input.targetConstruct,
    fellBackToTemplate: true,
    latencyMs,
  };
}

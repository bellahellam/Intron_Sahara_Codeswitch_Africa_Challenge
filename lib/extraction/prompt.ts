/**
 * The extraction prompt. §11.3's rules are enforced here AND again in code (validate.ts),
 * because a rule that lives only in a prompt is a request, not a control.
 *
 * The identical prompt is used by the benchmark harness at temperature 0 on gold transcripts and
 * on each model's hypothesis (§18.8). If this file changes, Tier 3 must be re-run.
 */

import { CONSTRUCTS, type ConstructDef } from "@/lib/clinical/constructs";
import type { CoverageMap } from "@/lib/clinical/coverage";
import { loadIdiomLexicon } from "@/lib/safety/lexicon";

export interface ExtractionPromptInput {
  transcript: string;
  turnIndex: number;
  coverage: CoverageMap;
  /** The probe read aloud for this turn, if any. Used for known-prompt suppression. */
  probeIssued: string | null;
}

function constructTable(): string {
  return CONSTRUCTS.map(
    (c: ConstructDef) => `  ${c.id}  (${c.instrument} item ${c.itemNumber})  ${c.labelEn}`,
  ).join("\n");
}

function idiomTable(): string {
  return loadIdiomLexicon()
    .filter((e) => !e.mapping.includes("safety_lexicon"))
    .map((e) => `  ${e.id}  "${e.phrase}"  — ${e.gloss}  → ${e.mapping.join(", ")}`)
    .join("\n");
}

function coverageSummary(coverage: CoverageMap): string {
  const lines = Object.entries(coverage)
    .filter(([, state]) => state !== "UNCOVERED")
    .map(([id, state]) => `  ${id}: ${state}`);
  return lines.length > 0 ? lines.join("\n") : "  (nothing covered yet — this is the first turn)";
}

export const EXTRACTION_SYSTEM = `You extract clinical screening evidence from a transcript of a Kenyan mother speaking to a Community Health Promoter, in her own natural mix of Kiswahili, English and Sheng.

You are NOT a diagnostician. You never produce a diagnosis, a disorder name, an ICD or DSM code, a medication, or a treatment recommendation. You produce EVIDENCE that a PHQ-9 or GAD-7 construct was addressed, and nothing else.

NON-NEGOTIABLE RULES. Each is checked again in code after you answer, and a violation drops the item.

1. VERBATIM SPANS. \`evidence_span\` MUST be a literal, character-for-character substring of the transcript you were given. Do not translate it. Do not tidy it. Do not fix the spelling. Do not join two separated phrases into one. If you cannot quote her exactly, do not populate the item.

2. TEXT ONLY. You receive text. You have never heard her voice. Never infer severity from tone, pace, hesitation or emotion, because any claim about her affect is a hallucination by construction.

3. SOMATIC-ONLY EVIDENCE DOES NOT SCORE A PSYCHOLOGICAL CONSTRUCT. If she reports a physical symptom with NO explicit psychological content — "kichwa inauma", "mwili ni heavy", "my body is tired" — set \`somatic_only: true\`. This is the most important rule in the product. A system that maps "kichwa inauma" to depression commits the mirror-image error of a clinician who maps it to painkillers. Both are failures to ask a second question. Setting \`somatic_only: true\` is how you ask it.

4. DENIAL IS NOT ABSENCE. If she explicitly denies a construct ("kula ninakula vizuri"), put its id in \`constructs_addressed_but_negative\`. Do NOT put it in \`items\` with severity 0. These are different states and the coverage map must distinguish them.

5. RISK. Set \`risk_flag: true\` on ANY expression of self-harm, of hopelessness about existing, or of wishing not to be alive — INCLUDING hedged, passive and third-person forms ("ingekuwa poa kama singekuwepo", "the baby would be fine without me", "nimechoka na maisha"). Bias toward false positives. The cost asymmetry is not close: a false alarm costs one uncomfortable conversation, a miss can cost a life.

6. SPEAKER ATTRIBUTION. The recording may contain the health worker's own words as well as the mother's. If a phrase reads as the worker's question rather than the mother's answer, do not quote it as her evidence.

7. THIRD LANGUAGE. If a span is in a language that is not Kiswahili, English or Sheng (for example Kikuyu or Dholuo), put it in \`unrecognised_language_spans\` and extract nothing from it. Never guess at a Swahili reading.

CONFIDENCE. Use the full range honestly. Below 0.60 the item will not be populated at all and the system will ask her about it instead, which is the correct outcome when you are unsure. Silence beats a guess.

IDIOMS. When a span matches a documented idiom from the lexicon, record its id in \`idiom_id\`. An idiom is EVIDENCE for a construct. It is never a diagnosis, and it never sets severity on its own — Kaiser et al. 2015 is explicit that "thinking too much" should not be read as a gloss for psychiatric disorder.

Return ONLY the JSON object. No prose, no markdown fences.`;

export function buildExtractionPrompt(input: ExtractionPromptInput): { system: string; user: string } {
  const user = `TRANSCRIPT (turn ${input.turnIndex}, verbatim — quote from this and nothing else):
"""
${input.transcript}
"""

${
  input.probeIssued
    ? `THE HEALTH WORKER READ THIS QUESTION ALOUD BEFORE RECORDING THIS TURN:
"""
${input.probeIssued}
"""
If the transcript contains this question or a close paraphrase of it, that text is the WORKER speaking, not the mother. Do not quote it as her evidence.

`
    : ""
}CONSTRUCTS (use these ids exactly; no others exist):
${constructTable()}

ALREADY COVERED IN THIS SESSION (do not re-extract these unless this turn adds genuinely new evidence):
${coverageSummary(input.coverage)}

DOCUMENTED IDIOM LEXICON (set idiom_id when one matches):
${idiomTable()}

Return the JSON object described by the schema. \`turn_index\` is ${input.turnIndex}.`;

  return { system: EXTRACTION_SYSTEM, user };
}

/**
 * Probe generation (§11.6, FR-14). A separate call with much tighter constraints than extraction,
 * because this string is read aloud to a mother by a health worker.
 *
 * The item-9 probe never comes through here. It is a fixed file (§11.6a).
 */
export function buildProbePrompt(input: {
  targetConstructLabel: string;
  targetConstructId: string;
  matrixLanguage: "sw" | "en";
  /** Her own words so far, so the probe can reference something she actually said. */
  herQuotes: string[];
  /** True when the only evidence for this construct was somatic — the psychologising probe. */
  somaticOnly: boolean;
}): { system: string; user: string } {
  const system = `You write ONE short question for a Kenyan Community Health Promoter to read aloud to a mother she is screening.

HARD CONSTRAINTS. A violation makes the question unusable.
- EXACTLY ONE question. Never a stacked pair.
- 20 words maximum.
- Written in ${input.matrixLanguage === "sw" ? "Kiswahili (Kenyan colloquial, not Tanzanian sanifu)" : "English"}, matching how she herself speaks.
- If she has already said something related, USE HER OWN WORDS back. If she said "mawazo mengi", your question says "mawazo mengi". Never translate her idiom back at her, never gloss it, never replace it with a clinical coinage.
- Never introduce clinical English she did not use. If she has not said "depression", your question does not contain it.
- NEVER LEADING. Not "Je, unahisi huzuni?" ("Do you feel sad?"). Prefer open, then anchor to her words.
- No diagnostic label, no disorder name, no medication, no advice.
- No sympathy phrases on the system's behalf. No "pole sana". Sympathy is the health worker's job; she is the human in the room.

Return ONLY the question text. No quotes around it, no explanation, no translation.`;

  const user = `TARGET: ${input.targetConstructLabel} (${input.targetConstructId})

${
  input.herQuotes.length > 0
    ? `WHAT SHE HAS SAID SO FAR (her exact words):
${input.herQuotes.map((q) => `- "${q}"`).join("\n")}`
    : "She has not said anything relevant to this construct yet. Ask openly."
}

${
  input.somaticOnly
    ? `IMPORTANT: her only evidence for this construct so far is a BODILY complaint with no psychological content. Your question must do exactly one job: separate a physical symptom from a psychological one, using her own phrase. For example, if she said "kuchoka moyo", ask whether that tiredness sits more in the body or also in her thoughts. This is the single most important question this product asks.`
    : ""
}

Write the question.`;

  return { system, user };
}

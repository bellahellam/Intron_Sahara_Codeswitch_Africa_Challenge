/**
 * The three validation layers that run in code after extraction. Together they are what make
 * the pipeline defensible (§11.9 layer 1, §11.4b, FR-11, FR-11a, FR-12).
 *
 *   1. SPAN VALIDATION      — evidence_span must be a literal substring of the transcript.
 *                             Violations DROP the item and log. Not repaired. Not fuzzy-matched.
 *   2. KNOWN-PROMPT SUPPRESSION — a span matching the probe issued for that turn is dropped.
 *                             This is what replaces diarization for the dominant failure.
 *   3. SOMATIC BACKSTOP     — the model may set somatic_only = true; it may NOT set it to false
 *                             against the backstop. One-directional override, deliberately.
 *
 * None of these calls a model. All three are pure functions.
 */

import { loadPsychMarkers, loadSomaticTerms } from "@/lib/safety/lexicon";
import { tokenize } from "@/lib/safety/scan";
import type { Extraction, ExtractionItem } from "./schema";

export type DropReason =
  | "span_validation_failure"
  | "known_prompt_suppressed"
  | "unknown_construct";

export interface DroppedItem {
  construct: string;
  reason: DropReason;
  /** Kept for the log only. Never rendered, never persisted into the record. */
  detail: string;
}

export interface ValidationResult {
  extraction: Extraction;
  dropped: DroppedItem[];
  /** Fired counter for the backstop. Watch it during testing: if it never fires, either the
   *  lexicon is too narrow or the model is already conservative, and it matters which. */
  somaticBackstopFired: number;
}

/** FR-11a threshold: token overlap against the normalised probe text. */
export const KNOWN_PROMPT_OVERLAP = 0.6;

function normalise(text: string): string {
  return text.normalize("NFC").toLowerCase();
}

/**
 * Layer 1. §9.2 step 9: "any evidence_span that is not a literal substring of the transcript
 * causes that item to be dropped and logged. Not repaired, not fuzzy-matched. Dropped."
 *
 * Whitespace is the single tolerated normalisation, because ASR output and JSON round-tripping
 * both introduce whitespace differences that are not the model asserting something she did not
 * say. Every other character must match exactly.
 */
export function isLiteralSubstring(span: string, transcript: string): boolean {
  const collapse = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
  return collapse(transcript).includes(collapse(span));
}

/**
 * Layer 2. The system GENERATED the probe, so it knows exactly what the CHP was about to say.
 * This catches the precise failure where the CHP reads a probe aloud, the recording catches it,
 * and extraction quotes the product's own question back as the mother's evidence — a false
 * positive manufactured by the system's own question, on the exact construct it exists to measure.
 */
export function tokenOverlap(a: string, b: string): number {
  const ta = tokenize(normalise(a)).map((t) => t.token);
  const tb = new Set(tokenize(normalise(b)).map((t) => t.token));
  if (ta.length === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / ta.length;
}

export function isKnownPrompt(span: string, probeIssued: string | null | undefined): boolean {
  if (!probeIssued) return false;
  return tokenOverlap(span, probeIssued) >= KNOWN_PROMPT_OVERLAP;
}

/**
 * Layer 3. §11.4b — the deterministic backstop on the somatic-only rule.
 *
 * As originally specified the rule was enforced by `somatic_only`, a boolean the extraction
 * model sets about its own output, which means the model polices itself. That is not enforcement.
 *
 * Honest limit: this is a lexicon, so it catches the clear cases and misses novel somatic
 * phrasing. It reduces the failure from "the model decides" to "the model decides, unless the
 * obvious case is present."
 */
export function applySomaticBackstop(item: ExtractionItem): { item: ExtractionItem; fired: boolean } {
  const somatic = loadSomaticTerms();
  const psych = loadPsychMarkers();
  const tokens = tokenize(normalise(item.evidence_span)).map((t) => t.token);
  const text = normalise(item.evidence_span);

  const hasSomatic = tokens.some((t) => somatic.has(t)) || [...somatic].some((t) => t.includes(" ") && text.includes(t));
  const hasPsych = tokens.some((t) => psych.has(t)) || [...psych].some((t) => t.includes(" ") && text.includes(t));

  if (hasSomatic && !hasPsych) {
    return {
      fired: true,
      item: {
        ...item,
        somatic_only: true, // forced, overriding the model
        severity_estimate: Math.min(item.severity_estimate, 1),
        confidence: Math.min(item.confidence, 0.59), // forced below the population threshold
      },
    };
  }

  // The model may set somatic_only = true. It may not set it to false against the backstop.
  // The override is one-directional, which is the correct asymmetry: over-caution costs a probe,
  // under-caution costs a false positive on the exact error the product exists to prevent.
  if (item.somatic_only) {
    return {
      fired: false,
      item: {
        ...item,
        severity_estimate: Math.min(item.severity_estimate, 1),
        confidence: Math.min(item.confidence, 0.59),
      },
    };
  }

  return { fired: false, item };
}

export function validateExtraction(
  extraction: Extraction,
  transcript: string,
  probeIssued: string | null | undefined,
): ValidationResult {
  const dropped: DroppedItem[] = [];
  const kept: ExtractionItem[] = [];
  let somaticBackstopFired = 0;

  for (const item of extraction.items) {
    if (!isLiteralSubstring(item.evidence_span, transcript)) {
      dropped.push({
        construct: item.construct,
        reason: "span_validation_failure",
        detail: "evidence_span is not a literal substring of the transcript",
      });
      continue;
    }

    if (isKnownPrompt(item.evidence_span, probeIssued)) {
      dropped.push({
        construct: item.construct,
        reason: "known_prompt_suppressed",
        detail: `token overlap >= ${KNOWN_PROMPT_OVERLAP} against the probe issued for this turn`,
      });
      continue;
    }

    const { item: adjusted, fired } = applySomaticBackstop(item);
    if (fired) somaticBackstopFired += 1;
    kept.push(adjusted);
  }

  // ONE EXPLICIT EXCEPTION (§11.9 layer 1): a failed span on the top-level risk_flag suppresses
  // the QUOTE, never the FLAG. Validation exists to stop the system asserting things she did not
  // say; it must never be a path by which a risk signal disappears.
  let riskEvidence = extraction.risk_evidence;
  if (extraction.risk_flag && riskEvidence && !isLiteralSubstring(riskEvidence, transcript)) {
    riskEvidence = null;
    dropped.push({
      construct: "risk_evidence",
      reason: "span_validation_failure",
      detail: "risk quote suppressed; the flag itself stands and the escalation proceeds",
    });
  }

  return {
    extraction: { ...extraction, items: kept, risk_evidence: riskEvidence },
    dropped,
    somaticBackstopFired,
  };
}

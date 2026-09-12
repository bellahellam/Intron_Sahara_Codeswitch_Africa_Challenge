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
  | "unknown_construct"
  | "span_overlap_demoted";

export interface DroppedItem {
  construct: string;
  reason: DropReason;
  /** Kept for the log only. Never rendered, never persisted into the record. */
  detail: string;
}

export interface ValidationResult {
  extraction: Extraction;
  dropped: DroppedItem[];
  /** How many items the span-overlap backstop demoted to probe targets. */
  overlapDemoted: number;
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
/**
 * Swahili is agglutinative, so a lexicon term appears inside inflected forms rather than as a
 * standalone token: `mwili` (body) shows up as `kimwili` (bodily, adverbial) and `mwilini` (in the
 * body). Exact token matching misses all of those.
 *
 * This was found by §26.7's own fixture. "Nimechoka sana kimwili" — a purely physical report —
 * populated a depression construct at confidence 0.88, because the backstop looked for `mwili` and
 * she had said `kimwili`. That is precisely the error the product exists to prevent, so the
 * matcher now matches a term that occurs INSIDE a token.
 *
 * Minimum length 4 keeps this from firing on short fragments; a 3-letter term inside a longer word
 * would match far too much.
 */
function lexiconMatches(terms: Set<string>, tokens: string[], text: string): boolean {
  for (const token of tokens) {
    if (terms.has(token)) return true;
    for (const term of terms) {
      if (term.length >= 4 && !term.includes(" ") && token.includes(term)) return true;
    }
  }
  // Multi-word entries are matched against the whole span.
  for (const term of terms) {
    if (term.includes(" ") && text.includes(term)) return true;
  }
  return false;
}

export function applySomaticBackstop(item: ExtractionItem): { item: ExtractionItem; fired: boolean } {
  const somatic = loadSomaticTerms();
  const psych = loadPsychMarkers();
  const tokens = tokenize(normalise(item.evidence_span)).map((t) => t.token);
  const text = normalise(item.evidence_span);

  const hasSomatic = lexiconMatches(somatic, tokens, text);
  const hasPsych = lexiconMatches(psych, tokens, text);

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

/** Character overlap between two spans, as a fraction of the shorter one. */
function spanOverlap(a: string, b: string): number {
  const x = normalise(a).replace(/\s+/g, " ").trim();
  const y = normalise(b).replace(/\s+/g, " ").trim();
  if (!x || !y) return 0;
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  if (longer.includes(shorter)) return 1;
  // Token-level Jaccard against the shorter span, for partial overlaps.
  const tx = new Set(tokenize(shorter).map((t) => t.token));
  const ty = new Set(tokenize(longer).map((t) => t.token));
  if (tx.size === 0) return 0;
  let shared = 0;
  for (const t of tx) if (ty.has(t)) shared += 1;
  return shared / tx.size;
}

export const SPAN_OVERLAP_THRESHOLD = 0.6;

/**
 * THE SPAN-OVERLAP BACKSTOP.
 *
 * Not in the original spec, added because the behaviour it prevents was observed live: asked to
 * extract from "Usiku sipati usingizi. Nakuwa na mawazo mengi sana, nafikiria kuhusu pesa,
 * nafikiria kuhusu mtoto, mpaka asubuhi", the extraction model returned FIVE GAD-7 items — 1, 2,
 * 3, 4 and 5 — four of them quoting the same rumination clause, every one at severity 2 and
 * confidence ≥0.98. That is GAD-7 = 10, a "moderate" band, manufactured from one sentence about
 * lying awake worrying.
 *
 * The prompt was told not to do this, twice, and did it anyway. §11.4b already established the
 * principle for exactly this situation: a rule the model enforces about its own output is not
 * enforcement. So this runs in code.
 *
 * The rule: items whose evidence spans overlap by ≥60% are competing readings of the SAME words.
 * Keep one — the most complete quote, tie-broken by instrument order — and demote the rest below
 * the population threshold so they become probe targets instead of scores.
 *
 * The asymmetry is deliberate and matches the somatic backstop: over-caution costs a probe,
 * under-caution inflates a score on constructs she never reported, and the score routes a real
 * referral.
 *
 * What this deliberately does NOT do: collapse items with genuinely different spans. One
 * utterance can legitimately evidence sleep disturbance AND rumination, because those are
 * different clauses. It is the same clause counted five times that is the error.
 */
export function applySpanOverlapBackstop(items: ExtractionItem[]): {
  items: ExtractionItem[];
  demoted: DroppedItem[];
} {
  const demoted: DroppedItem[] = [];
  const clusters: ExtractionItem[][] = [];

  for (const item of items) {
    const cluster = clusters.find((c) => c.some((other) => spanOverlap(item.evidence_span, other.evidence_span) >= SPAN_OVERLAP_THRESHOLD));
    if (cluster) cluster.push(item);
    else clusters.push([item]);
  }

  const out: ExtractionItem[] = [];
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      out.push(cluster[0]);
      continue;
    }
    // Keep the most complete quote. It is the one a CHP can most usefully read back.
    const winner = cluster.slice().sort(
      (a, b) =>
        b.evidence_span.length - a.evidence_span.length ||
        a.instrument.localeCompare(b.instrument) ||
        a.item_number - b.item_number,
    )[0];

    for (const item of cluster) {
      if (item === winner) {
        out.push(item);
        continue;
      }
      demoted.push({
        construct: item.construct,
        reason: "span_overlap_demoted",
        detail: `evidence overlaps ${winner.construct} by >=${SPAN_OVERLAP_THRESHOLD}; demoted to a probe target rather than scored`,
      });
      out.push({ ...item, confidence: Math.min(item.confidence, 0.59) });
    }
  }

  return { items: out, demoted };
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

  const overlap = applySpanOverlapBackstop(kept);
  dropped.push(...overlap.demoted);

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
    extraction: { ...extraction, items: overlap.items, risk_evidence: riskEvidence },
    dropped,
    somaticBackstopFired,
    overlapDemoted: overlap.demoted.length,
  };
}

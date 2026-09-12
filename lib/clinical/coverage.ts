/**
 * Coverage state — the agent's memory (§11.6). Without it there is no agent, only a
 * transcription demo.
 *
 * Pure state transition. `updateCoverage` never calls a model and never performs I/O.
 */

import { CONSTRUCT_IDS, type ConstructId } from "./constructs";

export type CoverageState =
  | "COVERED_HIGH" // confidence >= 0.85 — green, no confirmation needed
  | "COVERED_MEDIUM" // 0.60–0.85 — amber, requires a per-item tap
  | "DENIED" // she explicitly said no. Different from absence, and the map must say so.
  | "PROBED_NO_ANSWER" // we asked; nothing usable came back
  | "CONTESTED" // she both affirmed and denied it across turns — see below
  | "UNCOVERED"; // never reached

export const HIGH_CONFIDENCE = 0.85;
export const MEDIUM_CONFIDENCE = 0.6;

/** §10.5 confidence bands. Low-confidence items are never populated: silence beats a guess. */
export function bandForConfidence(confidence: number): "high" | "medium" | "low" {
  if (confidence >= HIGH_CONFIDENCE) return "high";
  if (confidence >= MEDIUM_CONFIDENCE) return "medium";
  return "low";
}

export type CoverageMap = Record<ConstructId, CoverageState>;

export function emptyCoverage(): CoverageMap {
  const map = {} as CoverageMap;
  for (const id of CONSTRUCT_IDS) map[id] = "UNCOVERED";
  return map;
}

export interface CoverageUpdate {
  /** Items that survived span validation and the somatic backstop. */
  items: Array<{ construct: ConstructId; confidence: number; somaticOnly: boolean }>;
  /** Constructs she explicitly denied (§11.3 rule 4). Denial and absence are different states. */
  denied: ConstructId[];
  /** The construct this turn was probing, if any — so an unanswered probe is recorded as such. */
  probedConstruct?: ConstructId | null;
}

/**
 * Rank used so a later weaker signal cannot silently downgrade an established one.
 *
 * CONTESTED sits at the top deliberately: once a construct is contested, nothing may quietly
 * un-contest it. Only the CHP resolving it with the mother can.
 */
const RANK: Record<CoverageState, number> = {
  UNCOVERED: 0,
  PROBED_NO_ANSWER: 1,
  DENIED: 2,
  COVERED_MEDIUM: 3,
  COVERED_HIGH: 4,
  CONTESTED: 5,
};

/**
 * §12.4 / §26.8: "Silali kabisa" in turn 2, "nalala vizuri" in turn 4.
 *
 * "Surface both quotes side by side, ask the CHP to clarify with her. NEVER SILENTLY PICK ONE."
 *
 * An earlier version of this file ranked DENIED below positive evidence, which meant a later
 * denial was simply outranked and discarded — silently picking one, which is the exact thing the
 * spec forbids. A contradiction is now its own state, and §26.8's pass criterion follows from it:
 * no score is written for a contested construct until the CHP resolves it.
 */
function isContradiction(previous: CoverageState, next: CoverageState): boolean {
  const affirmed = (s: CoverageState) => s === "COVERED_HIGH" || s === "COVERED_MEDIUM";
  return (affirmed(previous) && next === "DENIED") || (previous === "DENIED" && affirmed(next));
}

export function updateCoverage(current: CoverageMap, update: CoverageUpdate): CoverageMap {
  const next: CoverageMap = { ...current };

  const promote = (id: ConstructId, state: CoverageState) => {
    if (next[id] === "CONTESTED") return; // only a human clears this
    if (isContradiction(next[id], state)) {
      next[id] = "CONTESTED";
      return;
    }
    if (RANK[state] > RANK[next[id]]) next[id] = state;
  };

  for (const item of update.items) {
    // A somatic-only item is capped below the population threshold upstream (§11.4b), so it
    // arrives here with confidence <= 0.59 and correctly fails to cover anything. The explicit
    // guard is belt-and-braces: coverage must never be granted by a somatic-only span.
    if (item.somaticOnly) continue;
    const band = bandForConfidence(item.confidence);
    if (band === "high") promote(item.construct, "COVERED_HIGH");
    else if (band === "medium") promote(item.construct, "COVERED_MEDIUM");
    // band === "low": not populated. Stays a probe target.
  }

  for (const id of update.denied) promote(id, "DENIED");

  if (update.probedConstruct) {
    const id = update.probedConstruct;
    // Only if the probe produced nothing usable for its own target.
    if (next[id] === "UNCOVERED") next[id] = "PROBED_NO_ANSWER";
  }

  return next;
}

/** A construct is "settled" when the agent has no further reason to ask about it. */
export function isSettled(state: CoverageState): boolean {
  return state !== "UNCOVERED";
}

export function isCovered(state: CoverageState): boolean {
  return state === "COVERED_HIGH" || state === "COVERED_MEDIUM";
}

/** Contested constructs are excluded from scoring until a human resolves them (§26.8). */
export function isContested(state: CoverageState): boolean {
  return state === "CONTESTED";
}

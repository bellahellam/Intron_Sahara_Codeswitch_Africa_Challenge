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
 * DENIED is authoritative over PROBED_NO_ANSWER but not over positive evidence: if she denied
 * a construct on turn 2 and evidenced it on turn 4, that is a contradiction the CHP resolves
 * with her (§12.4), not something this function picks a winner for.
 */
const RANK: Record<CoverageState, number> = {
  UNCOVERED: 0,
  PROBED_NO_ANSWER: 1,
  DENIED: 2,
  COVERED_MEDIUM: 3,
  COVERED_HIGH: 4,
};

export function updateCoverage(current: CoverageMap, update: CoverageUpdate): CoverageMap {
  const next: CoverageMap = { ...current };

  const promote = (id: ConstructId, state: CoverageState) => {
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

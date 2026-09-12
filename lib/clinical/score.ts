/**
 * Deterministic scoring and banding. §11.7: "Note: `score` and `route_referral` contain no model."
 * Pure functions of the confirmed item set — no model, no I/O, no randomness.
 *
 * A clinical score produced by an LLM is not defensible and would not survive a judge's question.
 */

import {
  CONSTRUCT_IDS,
  GAD2_IDS,
  GAD7_IDS,
  PHQ2_IDS,
  PHQ9_IDS,
  type ConstructId,
} from "./constructs";

export type Phq9Band = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";
export type Gad7Band = "minimal" | "mild" | "moderate" | "severe";

/** One scored item. Only confirmed items reach here (FR-16). */
export interface ScoredItem {
  construct: ConstructId;
  /** 0–3, PHQ-9 / GAD-7 response scale. */
  severity: number;
  confirmedByChp: boolean;
  motherDisputed: boolean;
}

export interface Scores {
  phq2: number;
  phq9: number;
  gad2: number;
  gad7: number;
  phq9Band: Phq9Band;
  gad7Band: Gad7Band;
  coverage: {
    phq9ItemsEvidenced: number;
    gad7ItemsEvidenced: number;
  };
}

/** §11.8 band table. Pure lookup, unit-tested at every boundary. */
export function phq9Band(total: number): Phq9Band {
  if (total < 0 || total > 27) throw new RangeError(`PHQ-9 total out of range: ${total}`);
  if (total <= 4) return "minimal";
  if (total <= 9) return "mild";
  if (total <= 14) return "moderate";
  if (total <= 19) return "moderately_severe";
  return "severe";
}

export function gad7Band(total: number): Gad7Band {
  if (total < 0 || total > 21) throw new RangeError(`GAD-7 total out of range: ${total}`);
  if (total <= 4) return "minimal";
  if (total <= 9) return "mild";
  if (total <= 14) return "moderate";
  return "severe";
}

export const PHQ9_BAND_LABELS_SW: Record<Phq9Band, string> = {
  minimal: "Kidogo sana",
  mild: "Kidogo",
  moderate: "Wastani",
  moderately_severe: "Juu ya wastani",
  severe: "Kali",
};

export const GAD7_BAND_LABELS_SW: Record<Gad7Band, string> = {
  minimal: "Kidogo sana",
  mild: "Kidogo",
  moderate: "Wastani",
  severe: "Kali",
};

/**
 * A disputed item is removed from scoring. §10.6: her disagreement is itself data and survives
 * into the record as an audit event — but it does not contribute a number.
 *
 * Note what is deliberately absent: there is no path by which an unconfirmed amber item is
 * scored. FR-17 blocks the write upstream; this function additionally refuses to count it, so
 * the guarantee does not rest on UI sequencing alone.
 */
function countable(items: ScoredItem[]): Map<ConstructId, number> {
  const byConstruct = new Map<ConstructId, number>();
  for (const item of items) {
    if (item.motherDisputed) continue;
    if (!item.confirmedByChp) continue;
    if (!CONSTRUCT_IDS.includes(item.construct)) continue;
    const severity = clampSeverity(item.severity);
    // If a construct is evidenced more than once across turns, the highest severity wins.
    // Taking a mean would let a later mild mention dilute an earlier severe one.
    const prev = byConstruct.get(item.construct);
    byConstruct.set(item.construct, prev === undefined ? severity : Math.max(prev, severity));
  }
  return byConstruct;
}

function clampSeverity(severity: number): number {
  if (!Number.isFinite(severity)) return 0;
  return Math.min(3, Math.max(0, Math.round(severity)));
}

function sumOver(byConstruct: Map<ConstructId, number>, ids: readonly ConstructId[]): number {
  let total = 0;
  for (const id of ids) total += byConstruct.get(id) ?? 0;
  return total;
}

function countOver(byConstruct: Map<ConstructId, number>, ids: readonly ConstructId[]): number {
  let n = 0;
  for (const id of ids) if (byConstruct.has(id)) n += 1;
  return n;
}

export function score(items: ScoredItem[]): Scores {
  const byConstruct = countable(items);

  const phq9 = sumOver(byConstruct, PHQ9_IDS);
  const gad7 = sumOver(byConstruct, GAD7_IDS);

  return {
    phq2: sumOver(byConstruct, PHQ2_IDS),
    phq9,
    gad2: sumOver(byConstruct, GAD2_IDS),
    gad7,
    phq9Band: phq9Band(phq9),
    gad7Band: gad7Band(gad7),
    coverage: {
      phq9ItemsEvidenced: countOver(byConstruct, PHQ9_IDS),
      gad7ItemsEvidenced: countOver(byConstruct, GAD7_IDS),
    },
  };
}

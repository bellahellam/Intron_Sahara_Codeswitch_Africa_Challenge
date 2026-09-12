/**
 * The decision function (§11.6). This is the agent.
 *
 * Deterministic control flow: the *choice* of action is made here, in code, with no model.
 * A model is used only to phrase a probe once this function has decided to probe, and to
 * choose nothing else.
 */

import {
  GAD2_IDS,
  ITEM_9,
  PHQ2_IDS,
  PROBE_PRIORITY,
  type ConstructId,
} from "./constructs";
import { isCovered, type CoverageMap } from "./coverage";

export type AgentAction = "PROBE" | "ESCALATE" | "COMPLETE";

/**
 * §14.1: revised from 8. Eight turns at the 110 s cap is 14.7 minutes of recording alone.
 * Six turns averaging 60 s is 6 minutes of speech inside a 10-minute session, which also
 * satisfies the >=60% speaking-share target in §14.7.
 */
export const MAX_TURNS = 6;

export interface DecisionInput {
  coverage: CoverageMap;
  /** Number of completed turns so far. */
  turnIndex: number;
  /** Deterministic lexicon hit on the raw transcript. No model involved (§11.4a). */
  safetyHit: boolean;
  /** The extraction model's independent risk signal. Either source triggers escalation. */
  riskFlag: boolean;
  /** Running PHQ-2 / GAD-2 sub-scores from populated items. */
  phq2Score: number;
  gad2Score: number;
  /** Constructs whose only evidence so far was somatic-only — probe priority tier 3. */
  somaticOnlyConstructs: readonly ConstructId[];
}

export interface Decision {
  action: AgentAction;
  targetConstruct: ConstructId | null;
  /** Machine-readable reason, logged on every transition (§17.7). */
  rationale: string;
  /** Set when COMPLETE: how the session terminated, for the record. */
  termination?: "short_path_negative" | "coverage" | "turn_budget";
  /** True when completing without a full PHQ-9. The record says so plainly (§12.6 rule 4). */
  incompleteCoverage?: boolean;
  /** True when the target is the fixed item-9 probe, which is read from a file, never generated. */
  useFixedItem9Probe?: boolean;
}

function allCovered(coverage: CoverageMap, ids: readonly ConstructId[]): boolean {
  return ids.every((id) => isCovered(coverage[id]) || coverage[id] === "DENIED");
}

export function decide(input: DecisionInput): Decision {
  const { coverage, turnIndex, safetyHit, riskFlag, phq2Score, gad2Score } = input;

  if (safetyHit || riskFlag) {
    return {
      action: "ESCALATE",
      targetConstruct: null,
      rationale: safetyHit
        ? "Deterministic safety lexicon hit on the raw transcript."
        : "Extraction model set risk_flag.",
    };
  }

  if (turnIndex >= MAX_TURNS) {
    return {
      action: "COMPLETE",
      targetConstruct: null,
      rationale: `Turn budget reached (${MAX_TURNS}).`,
      termination: "turn_budget",
      incompleteCoverage: true,
    };
  }

  // ---- THE ITEM-9 GATE. Evaluated before every completion path. ----
  //
  // An earlier draft placed the negative short path first, which meant a mother who screened
  // negative on PHQ-2 and GAD-2 would complete the session without ever being asked about
  // self-harm. That is exactly backwards: suicidal ideation is not conditional on a positive
  // depression screen, and a low-scoring screen is the population where an unasked question is
  // most dangerous. This is a hard precondition on completion, not a priority-ranked preference.
  if (coverage[ITEM_9] === "UNCOVERED") {
    return {
      action: "PROBE",
      targetConstruct: ITEM_9,
      rationale: "Item-9 gate: PHQ-9 #9 is UNCOVERED and no path may complete while it is.",
      useFixedItem9Probe: true,
    };
  }
  // ------------------------------------------------------------------

  // Negative short path. Only reachable once the item-9 gate above has been satisfied.
  if (allCovered(coverage, PHQ2_IDS) && phq2Score < 3 && allCovered(coverage, GAD2_IDS) && gad2Score < 3) {
    return {
      action: "COMPLETE",
      targetConstruct: null,
      rationale: `Negative short path: PHQ-2 ${phq2Score} and GAD-2 ${gad2Score}, both below the IPMH threshold of 3.`,
      termination: "short_path_negative",
      incompleteCoverage: false,
    };
  }

  // Probe priority tier 3 sits between the stems and the remaining items: a construct whose
  // only evidence is somatic is where this product earns its thesis (§12.4). It is checked
  // before the generic uncovered sweep so the psychologising probe is preferred.
  const stemsPending = PROBE_PRIORITY.slice(0, 4).find((id) => coverage[id] === "UNCOVERED");
  if (stemsPending) {
    return {
      action: "PROBE",
      targetConstruct: stemsPending,
      rationale: "Highest-priority uncovered stem construct (PHQ-2 / GAD-2 gate everything).",
    };
  }

  const somaticTarget = input.somaticOnlyConstructs.find((id) => !isCovered(coverage[id]));
  if (somaticTarget) {
    return {
      action: "PROBE",
      targetConstruct: somaticTarget,
      rationale:
        "Somatic-only evidence present for this construct. Probing to separate a bodily complaint from a psychological one.",
    };
  }

  const uncovered = PROBE_PRIORITY.find((id) => coverage[id] === "UNCOVERED");
  if (uncovered) {
    return {
      action: "PROBE",
      targetConstruct: uncovered,
      rationale: "Highest-priority uncovered construct.",
    };
  }

  // §26.8: she affirmed and denied the same construct across turns. The system must not pick a
  // winner; it asks the CHP to clarify with her. Ranked above the medium-confidence sweep because
  // a contradiction is a stronger reason to ask than mere uncertainty.
  const contested = PROBE_PRIORITY.find((id) => coverage[id] === "CONTESTED");
  if (contested && turnIndex < MAX_TURNS) {
    return {
      action: "PROBE",
      targetConstruct: contested,
      rationale:
        "She both affirmed and denied this construct across turns. Surfacing both quotes for the CHP to clarify; no score is written until it is resolved.",
    };
  }

  const medium = PROBE_PRIORITY.find((id) => coverage[id] === "COVERED_MEDIUM");
  if (medium && turnIndex < MAX_TURNS) {
    return {
      action: "PROBE",
      targetConstruct: medium,
      rationale: "Disambiguating a medium-confidence construct.",
    };
  }

  return {
    action: "COMPLETE",
    targetConstruct: null,
    rationale: "All constructs settled.",
    termination: "coverage",
    incompleteCoverage: false,
  };
}

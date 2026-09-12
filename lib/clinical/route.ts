/**
 * Deterministic referral routing (§11.8). No model. Rules are evaluated top-down and the
 * first match wins; evaluation stops there.
 *
 * There is deliberately no `no_action` tier. Instrument choice moves measured prevalence
 * fourfold in the same Kenyan women (Larsen 2023, doi:10.1016/j.jad.2022.12.101), and even the
 * validated Kenyan EPDS has 44.1% PPV. A negative screen is not evidence of absence.
 * Everyone gets at least a routine re-screen.
 */

import type { Scores } from "./score";

export type ReferralTier = "facility_urgent" | "facility_routine" | "chp_followup";

export interface RoutingInput {
  scores: Scores;
  /**
   * §11.8 rule 1 is LATCHED, not derived: the condition is the existence of an escalation
   * audit event, NOT the current contents of the item list. FR-18 lets the CHP remove a
   * disputed item and §26.5 recomputes the score, so a rule reading "item 9 evidence is
   * present" could be un-triggered by removing the card that triggered it.
   *
   * Once a session escalates, facility_urgent cannot be lowered by any subsequent edit.
   * It can only be raised by a human.
   */
  sessionEscalated: boolean;
  /** True when the session ended via the negative short path (PHQ-2 <3 and GAD-2 <3). */
  shortPathNegative: boolean;
  /**
   * §14.4a: a Tier-2 offline record could not be back-read to the mother, which breaks the
   * third verification layer. Such a record cannot be routed above chp_followup without a
   * follow-up visit — except where the CHP raised a manual flag, which latches urgent as normal.
   */
  notBackRead?: boolean;
}

export interface Referral {
  tier: ReferralTier;
  /** Always present. FR-20: the reason string is never empty. */
  reason: string;
  reasonSw: string;
  /** §11.8: the record states plainly that the screen was not completed. */
  incomplete: boolean;
  ruleApplied: number;
}

export const TIER_LABELS_SW: Record<ReferralTier, string> = {
  facility_urgent: "Kituo cha afya — leo",
  facility_routine: "Kituo cha afya — rufaa ya kawaida",
  chp_followup: "Ufuatiliaji wa CHP",
};

export const TIER_LABELS_EN: Record<ReferralTier, string> = {
  facility_urgent: "Facility — same day",
  facility_routine: "Facility — routine referral",
  chp_followup: "CHP follow-up",
};

export function routeReferral(input: RoutingInput): Referral {
  const { scores, sessionEscalated, shortPathNegative } = input;

  const tierAndReason = ((): Omit<Referral, "incomplete"> => {
    // Rule 1 — latched escalation. Evaluated first and never skipped.
    if (sessionEscalated) {
      return {
        tier: "facility_urgent",
        reason: "An escalation event exists for this session. Same-day facility contact.",
        reasonSw: "Kuna alama ya hatari katika kikao hiki. Wasiliana na kituo cha afya leo.",
        ruleApplied: 1,
      };
    }

    // Rule 2 — severity on either instrument.
    if (scores.phq9 >= 15 || scores.gad7 >= 15) {
      return {
        tier: "facility_routine",
        reason: `PHQ-9 ${scores.phq9} / GAD-7 ${scores.gad7}. Referral to a clinical officer within 7 days.`,
        reasonSw: `PHQ-9 ${scores.phq9} / GAD-7 ${scores.gad7}. Rufaa kwa daktari ndani ya siku 7.`,
        ruleApplied: 2,
      };
    }

    // Rule 3 — the IPMH trial's own thresholds, so our output is directly consumable by the
    // stepped-care pathway that already exists in Western Kenya (§7.5, NCT06456307).
    if (scores.phq2 >= 3 || scores.gad2 >= 3) {
      return {
        tier: "facility_routine",
        reason: `PHQ-2 ${scores.phq2} / GAD-2 ${scores.gad2} at or above the IPMH threshold of 3. Referral within 14 days.`,
        reasonSw: `PHQ-2 ${scores.phq2} / GAD-2 ${scores.gad2}. Rufaa ndani ya siku 14.`,
        ruleApplied: 3,
      };
    }

    // Rule 4 — repeat screening, per §3.3.
    if (scores.phq9 >= 5) {
      return {
        tier: "chp_followup",
        reason: `PHQ-9 ${scores.phq9}. CHP re-screens in 2 weeks.`,
        reasonSw: `PHQ-9 ${scores.phq9}. CHP arudie uchunguzi baada ya wiki 2.`,
        ruleApplied: 4,
      };
    }

    // Rule 5 — otherwise.
    return {
      tier: "chp_followup",
      reason: "Routine re-screen at the next scheduled visit. A negative screen is not evidence of absence.",
      reasonSw: "Uchunguzi wa kawaida katika ziara ijayo.",
      ruleApplied: 5,
    };
  })();

  let { tier, reason, reasonSw, ruleApplied } = tierAndReason;

  // §14.4a rule 3 — a record that could not be back-read cannot be routed above chp_followup,
  // unless the escalation latch fired, which always wins.
  if (input.notBackRead && tier !== "facility_urgent" && !sessionEscalated) {
    tier = "chp_followup";
    reason = `${reason} Downgraded: the record was not back-read to the mother, so a follow-up visit is required first.`;
    reasonSw = `${reasonSw} Rekodi hii haikusomwa kwa mama; inahitaji ziara ya ufuatiliaji.`;
  }

  // A short-path completion evidences only PHQ-2 and GAD-2, so it will always have fewer than
  // 6 PHQ-9 items. It is a deliberately short screen, not an incomplete one (§11.8).
  const incomplete = !shortPathNegative && scores.coverage.phq9ItemsEvidenced < 6;

  return { tier, reason, reasonSw, incomplete, ruleApplied };
}

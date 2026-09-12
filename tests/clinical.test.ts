/**
 * §24.6 DoD: "Scoring and banding are unit-tested [against hand-computed vectors and] at every
 * band boundary" and "Unit test asserts no path through decide() returns COMPLETE while
 * PHQ-9 #9 is UNCOVERED."
 *
 * These are the tests that make the deterministic half of the product defensible. They call no
 * model and touch no network, by design.
 */

import { describe, expect, it } from "vitest";
import { gad7Band, phq9Band, score, type ScoredItem } from "@/lib/clinical/score";
import { routeReferral } from "@/lib/clinical/route";
import { decide, MAX_TURNS } from "@/lib/clinical/decide";
import { emptyCoverage, updateCoverage, type CoverageMap } from "@/lib/clinical/coverage";
import { CONSTRUCT_IDS, type ConstructId } from "@/lib/clinical/constructs";

function item(construct: ConstructId, severity: number, opts: Partial<ScoredItem> = {}): ScoredItem {
  return { construct, severity, confirmedByChp: true, motherDisputed: false, ...opts };
}

describe("band tables (§11.8)", () => {
  it("PHQ-9 bands at every boundary", () => {
    const cases: Array<[number, string]> = [
      [0, "minimal"], [4, "minimal"],
      [5, "mild"], [9, "mild"],
      [10, "moderate"], [14, "moderate"],
      [15, "moderately_severe"], [19, "moderately_severe"],
      [20, "severe"], [27, "severe"],
    ];
    for (const [total, band] of cases) expect(phq9Band(total), `PHQ-9 ${total}`).toBe(band);
  });

  it("14 is moderate, not moderately severe — the spec calls this out explicitly", () => {
    expect(phq9Band(14)).toBe("moderate");
  });

  it("GAD-7 bands at every boundary", () => {
    const cases: Array<[number, string]> = [
      [0, "minimal"], [4, "minimal"],
      [5, "mild"], [9, "mild"],
      [10, "moderate"], [14, "moderate"],
      [15, "severe"], [21, "severe"],
    ];
    for (const [total, band] of cases) expect(gad7Band(total), `GAD-7 ${total}`).toBe(band);
  });

  it("rejects out-of-range totals rather than banding them", () => {
    expect(() => phq9Band(28)).toThrow(RangeError);
    expect(() => phq9Band(-1)).toThrow(RangeError);
    expect(() => gad7Band(22)).toThrow(RangeError);
  });
});

describe("score() — hand-computed vectors", () => {
  it("sums PHQ-9 and its PHQ-2 sub-score", () => {
    const s = score([
      item("phq9_1", 2), item("phq9_2", 2), item("phq9_3", 3),
      item("phq9_4", 2), item("phq9_5", 1), item("phq9_6", 2),
      item("phq9_7", 1), item("phq9_8", 1), item("phq9_9", 0),
    ]);
    expect(s.phq9).toBe(14);
    expect(s.phq9Band).toBe("moderate");
    expect(s.phq2).toBe(4);
    expect(s.coverage.phq9ItemsEvidenced).toBe(9);
  });

  it("an unconfirmed amber item contributes nothing (FR-17 backstop)", () => {
    const s = score([item("phq9_1", 3, { confirmedByChp: false }), item("phq9_2", 2)]);
    expect(s.phq9).toBe(2);
    expect(s.coverage.phq9ItemsEvidenced).toBe(1);
  });

  it("a disputed item contributes nothing — her disagreement wins", () => {
    const s = score([item("phq9_1", 3, { motherDisputed: true }), item("phq9_2", 2)]);
    expect(s.phq9).toBe(2);
  });

  it("a construct evidenced twice takes the highest severity, never a mean", () => {
    const s = score([item("phq9_3", 1), item("phq9_3", 3)]);
    expect(s.phq9).toBe(3);
    expect(s.coverage.phq9ItemsEvidenced).toBe(1);
  });

  it("an empty item set scores zero and bands minimal", () => {
    const s = score([]);
    expect(s.phq9).toBe(0);
    expect(s.gad7).toBe(0);
    expect(s.phq9Band).toBe("minimal");
  });
});

describe("routeReferral() — §11.8, first match wins", () => {
  const base = score([item("phq9_1", 1), item("phq9_2", 1)]);

  it("rule 1: a latched escalation routes urgent regardless of score", () => {
    const r = routeReferral({ scores: score([]), sessionEscalated: true, shortPathNegative: false });
    expect(r.tier).toBe("facility_urgent");
    expect(r.ruleApplied).toBe(1);
  });

  it("rule 1 cannot be lowered by removing the item that triggered it", () => {
    // §26.5: the CHP removes a disputed item and the score recomputes to zero. The tier holds,
    // because routing reads the escalation EVENT, not the current item list.
    const r = routeReferral({ scores: score([]), sessionEscalated: true, shortPathNegative: false });
    expect(r.tier).toBe("facility_urgent");
  });

  it("rule 2: PHQ-9 >= 15 routes routine", () => {
    const s = score([item("phq9_1", 3), item("phq9_2", 3), item("phq9_3", 3), item("phq9_4", 3), item("phq9_5", 3)]);
    expect(s.phq9).toBe(15);
    const r = routeReferral({ scores: s, sessionEscalated: false, shortPathNegative: false });
    expect(r.tier).toBe("facility_routine");
    expect(r.ruleApplied).toBe(2);
  });

  it("rule 3: PHQ-2 >= 3 routes routine, matching the IPMH trial threshold", () => {
    const s = score([item("phq9_1", 2), item("phq9_2", 1)]);
    expect(s.phq2).toBe(3);
    const r = routeReferral({ scores: s, sessionEscalated: false, shortPathNegative: false });
    expect(r.tier).toBe("facility_routine");
    expect(r.ruleApplied).toBe(3);
  });

  it("rule 5: there is no no_action tier — everyone gets at least a re-screen", () => {
    const r = routeReferral({ scores: score([]), sessionEscalated: false, shortPathNegative: true });
    expect(r.tier).toBe("chp_followup");
    expect(r.reason).not.toBe("");
  });

  it("a reason string is always present (FR-20)", () => {
    for (const escalated of [true, false]) {
      const r = routeReferral({ scores: base, sessionEscalated: escalated, shortPathNegative: false });
      expect(r.reason.length).toBeGreaterThan(0);
      expect(r.reasonSw.length).toBeGreaterThan(0);
    }
  });

  it("the short path is not flagged incomplete; a truncated full screen is", () => {
    const short = routeReferral({ scores: base, sessionEscalated: false, shortPathNegative: true });
    expect(short.incomplete).toBe(false);
    const truncated = routeReferral({ scores: base, sessionEscalated: false, shortPathNegative: false });
    expect(truncated.incomplete).toBe(true);
  });
});

describe("decide() — the item-9 gate (§11.6)", () => {
  function covered(ids: ConstructId[], state: "COVERED_HIGH" | "DENIED" = "COVERED_HIGH"): CoverageMap {
    const map = emptyCoverage();
    for (const id of ids) map[id] = state;
    return map;
  }

  const baseInput = {
    turnIndex: 1,
    safetyHit: false,
    riskFlag: false,
    phq2Score: 0,
    gad2Score: 0,
    somaticOnlyConstructs: [] as ConstructId[],
  };

  it("NO PATH returns COMPLETE while PHQ-9 #9 is UNCOVERED", () => {
    // Exhaustive over every subset-shaped coverage map we can cheaply generate, plus the
    // specific states that tempted the original draft into completing early.
    const states = ["COVERED_HIGH", "COVERED_MEDIUM", "DENIED", "PROBED_NO_ANSWER"] as const;

    for (const state of states) {
      for (const turnIndex of [0, 1, 3, 5]) {
        for (const [phq2Score, gad2Score] of [[0, 0], [2, 2], [4, 4], [6, 6]]) {
          const map = emptyCoverage();
          // Everything covered EXCEPT item 9.
          for (const id of CONSTRUCT_IDS) if (id !== "phq9_9") map[id] = state;

          const d = decide({ ...baseInput, coverage: map, turnIndex, phq2Score, gad2Score });
          expect(d.action, `state=${state} turn=${turnIndex} phq2=${phq2Score}`).not.toBe("COMPLETE");
          expect(d.targetConstruct).toBe("phq9_9");
          expect(d.useFixedItem9Probe).toBe(true);
        }
      }
    }
  });

  it("the gate sits ABOVE the negative short path — the case that made it a gate", () => {
    // A mother who screens negative on PHQ-2 and GAD-2 must still be asked about self-harm.
    const map = covered(["phq9_1", "phq9_2", "gad7_1", "gad7_2"]);
    const d = decide({ ...baseInput, coverage: map, phq2Score: 0, gad2Score: 0 });
    expect(d.action).toBe("PROBE");
    expect(d.targetConstruct).toBe("phq9_9");
  });

  it("once item 9 is settled, the negative short path completes", () => {
    const map = covered(["phq9_1", "phq9_2", "gad7_1", "gad7_2"]);
    map.phq9_9 = "DENIED";
    const d = decide({ ...baseInput, coverage: map, phq2Score: 0, gad2Score: 0 });
    expect(d.action).toBe("COMPLETE");
    expect(d.termination).toBe("short_path_negative");
    expect(d.incompleteCoverage).toBe(false);
  });

  it("a skipped item-9 probe (PROBED_NO_ANSWER) satisfies the gate but is recorded", () => {
    const map = covered(["phq9_1", "phq9_2", "gad7_1", "gad7_2"]);
    map.phq9_9 = "PROBED_NO_ANSWER";
    const d = decide({ ...baseInput, coverage: map, phq2Score: 0, gad2Score: 0 });
    expect(d.action).toBe("COMPLETE");
  });

  it("escalation outranks everything, including the turn budget", () => {
    const map = emptyCoverage();
    for (const src of [{ safetyHit: true, riskFlag: false }, { safetyHit: false, riskFlag: true }]) {
      const d = decide({ ...baseInput, ...src, coverage: map, turnIndex: MAX_TURNS + 2 });
      expect(d.action).toBe("ESCALATE");
    }
  });

  it("the turn budget completes and flags incomplete coverage", () => {
    const d = decide({ ...baseInput, coverage: emptyCoverage(), turnIndex: MAX_TURNS });
    expect(d.action).toBe("COMPLETE");
    expect(d.termination).toBe("turn_budget");
    expect(d.incompleteCoverage).toBe(true);
  });

  it("somatic-only constructs are probed before the generic uncovered sweep", () => {
    const map = covered(["phq9_1", "phq9_2", "gad7_1", "gad7_2"]);
    map.phq9_9 = "DENIED";
    const d = decide({
      ...baseInput,
      coverage: map,
      phq2Score: 4,
      gad2Score: 4,
      somaticOnlyConstructs: ["phq9_4"],
    });
    expect(d.action).toBe("PROBE");
    expect(d.targetConstruct).toBe("phq9_4");
    expect(d.rationale).toMatch(/somatic/i);
  });
});

describe("updateCoverage() — denial and absence are different states", () => {
  it("a somatic-only item never grants coverage", () => {
    const next = updateCoverage(emptyCoverage(), {
      items: [{ construct: "phq9_4", confidence: 0.95, somaticOnly: true }],
      denied: [],
    });
    expect(next.phq9_4).toBe("UNCOVERED");
  });

  it("a low-confidence item never grants coverage — silence beats a guess", () => {
    const next = updateCoverage(emptyCoverage(), {
      items: [{ construct: "phq9_4", confidence: 0.55, somaticOnly: false }],
      denied: [],
    });
    expect(next.phq9_4).toBe("UNCOVERED");
  });

  it("0.85 is high, 0.84 is medium — the threshold is inclusive", () => {
    const high = updateCoverage(emptyCoverage(), {
      items: [{ construct: "phq9_1", confidence: 0.85, somaticOnly: false }],
      denied: [],
    });
    expect(high.phq9_1).toBe("COVERED_HIGH");
    const medium = updateCoverage(emptyCoverage(), {
      items: [{ construct: "phq9_1", confidence: 0.84, somaticOnly: false }],
      denied: [],
    });
    expect(medium.phq9_1).toBe("COVERED_MEDIUM");
  });

  it("DENIED is distinct from UNCOVERED", () => {
    const next = updateCoverage(emptyCoverage(), { items: [], denied: ["phq9_5"] });
    expect(next.phq9_5).toBe("DENIED");
    expect(next.phq9_6).toBe("UNCOVERED");
  });

  it("an unanswered probe records PROBED_NO_ANSWER, not silence", () => {
    const next = updateCoverage(emptyCoverage(), { items: [], denied: [], probedConstruct: "phq9_9" });
    expect(next.phq9_9).toBe("PROBED_NO_ANSWER");
  });

  it("a later weak signal never downgrades an established one", () => {
    let map = updateCoverage(emptyCoverage(), {
      items: [{ construct: "phq9_1", confidence: 0.95, somaticOnly: false }],
      denied: [],
    });
    map = updateCoverage(map, {
      items: [{ construct: "phq9_1", confidence: 0.65, somaticOnly: false }],
      denied: [],
    });
    expect(map.phq9_1).toBe("COVERED_HIGH");
  });
});

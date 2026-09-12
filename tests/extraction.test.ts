/**
 * The validation layers — FR-11, FR-11a, FR-12, and the span-overlap backstop.
 *
 * §24.4's DoD: "Adversarial fixture: a hallucinated span is dropped and logged."
 */

import { describe, expect, it } from "vitest";
import {
  applySomaticBackstop,
  applySpanOverlapBackstop,
  isKnownPrompt,
  isLiteralSubstring,
  tokenOverlap,
  validateExtraction,
} from "@/lib/extraction/validate";
import { ExtractionSchema, type Extraction, type ExtractionItem } from "@/lib/extraction/schema";
import { FIXTURE_UTTERANCES } from "@/lib/asr/mock";
import { dedupeQuotes } from "@/lib/agent/quotes";

function item(overrides: Partial<ExtractionItem> = {}): ExtractionItem {
  return {
    instrument: "PHQ9",
    item_number: 3,
    construct: "phq9_3",
    evidence_span: "Mtoto akilala mimi sikulali.",
    span_language: "sw",
    idiom_id: null,
    severity_estimate: 2,
    severity_basis: "reported as habitual",
    confidence: 0.9,
    somatic_only: false,
    reasoning: "test fixture",
    ...overrides,
  };
}

function extraction(items: ExtractionItem[], overrides: Partial<Extraction> = {}): Extraction {
  return {
    turn_index: 0,
    language_profile: { sw: 1, en: 0, sheng: 0, unknown: 0 },
    risk_flag: false,
    risk_evidence: null,
    items,
    constructs_addressed_but_negative: [],
    unrecognised_language_spans: [],
    ...overrides,
  };
}

describe("FR-11 — evidence spans must be literal substrings", () => {
  const transcript = FIXTURE_UTTERANCES.sleep;

  it("accepts an exact quote", () => {
    expect(isLiteralSubstring("Mtoto akilala mimi sikulali.", transcript)).toBe(true);
  });

  it("tolerates whitespace differences only", () => {
    expect(isLiteralSubstring("Mtoto  akilala\nmimi sikulali.", transcript)).toBe(true);
  });

  it("REJECTS a paraphrase, a translation and a tidied quote", () => {
    // Each of these is the model asserting something she did not say.
    expect(isLiteralSubstring("When the baby sleeps I do not sleep", transcript)).toBe(false);
    expect(isLiteralSubstring("Mtoto akilala mimi silali.", transcript)).toBe(false); // "fixed" spelling
    expect(isLiteralSubstring("Mtoto analala na mimi sikulali", transcript)).toBe(false);
  });

  it("drops a hallucinated span and logs it, rather than repairing it", () => {
    const result = validateExtraction(
      extraction([item({ evidence_span: "Nataka kujiumiza kila siku" })]),
      transcript,
      null,
    );
    expect(result.extraction.items).toHaveLength(0);
    expect(result.dropped[0].reason).toBe("span_validation_failure");
  });

  it("a failed span on risk_evidence suppresses the QUOTE, never the FLAG (§11.9 exception)", () => {
    const result = validateExtraction(
      extraction([], { risk_flag: true, risk_evidence: "words she never said" }),
      transcript,
      null,
    );
    // The flag stands. Validation must never be a path by which a risk signal disappears.
    expect(result.extraction.risk_flag).toBe(true);
    expect(result.extraction.risk_evidence).toBeNull();
    expect(result.dropped.some((d) => d.construct === "risk_evidence")).toBe(true);
  });
});

describe("FR-11a — known-prompt suppression replaces diarization", () => {
  const probe = "Umesema unaskia kuchoka moyo. Hiyo hisia ya kuchoka, iko zaidi kwa mwili ama pia kwa mawazo?";

  it("detects the probe quoted back as her evidence", () => {
    expect(isKnownPrompt("Hiyo hisia ya kuchoka, iko zaidi kwa mwili ama pia kwa mawazo?", probe)).toBe(true);
  });

  it("does not suppress her genuine answer to that probe", () => {
    expect(isKnownPrompt("Ni kwa mawazo zaidi, mwili uko sawa", probe)).toBe(false);
  });

  it("turn 1 has no probe, so nothing is suppressed", () => {
    expect(isKnownPrompt("anything at all", null)).toBe(false);
  });

  it("fixture: a turn whose transcript contains the probe verbatim yields zero items from it", () => {
    const transcript = `${probe} Ndio, ni kweli.`;
    const result = validateExtraction(
      extraction([item({ construct: "phq9_4", evidence_span: probe })]),
      transcript,
      probe,
    );
    expect(result.extraction.items).toHaveLength(0);
    expect(result.dropped[0].reason).toBe("known_prompt_suppressed");
  });

  it("tokenOverlap is a fraction of the SPAN, not of the probe", () => {
    expect(tokenOverlap("kuchoka moyo", "Umesema unaskia kuchoka moyo")).toBe(1);
  });
});

describe("FR-12 — the somatic-only backstop (§11.4b)", () => {
  it("forces somatic_only on a bodily complaint with no psychological content", () => {
    const { item: adjusted, fired } = applySomaticBackstop(
      item({ evidence_span: "Kichwa inauma kila siku", somatic_only: false, confidence: 0.95, severity_estimate: 3 }),
    );
    expect(fired).toBe(true);
    expect(adjusted.somatic_only).toBe(true);
    // Forced below the population threshold, so it cannot score. It becomes a probe.
    expect(adjusted.confidence).toBeLessThan(0.6);
    expect(adjusted.severity_estimate).toBeLessThanOrEqual(1);
  });

  it("does NOT fire when a psychological marker is present alongside the somatic one", () => {
    const { fired } = applySomaticBackstop(
      item({ evidence_span: "Kichwa inauma na niko na mawazo mengi", somatic_only: false }),
    );
    expect(fired).toBe(false);
  });

  it("the override is one-directional: the model may say true, never false against the backstop", () => {
    // Model says somatic_only: true on a span the lexicon would not have caught. Respected.
    const { item: adjusted } = applySomaticBackstop(
      item({ evidence_span: "Nahisi vibaya sana", somatic_only: true, confidence: 0.95, severity_estimate: 3 }),
    );
    expect(adjusted.confidence).toBeLessThan(0.6);
    expect(adjusted.severity_estimate).toBeLessThanOrEqual(1);
  });
});

describe("the span-overlap backstop", () => {
  /**
   * This is the EXACT live output that exposed the problem: nex-agi/nex-n2.5-pro returned five
   * GAD-7 items from one rumination sentence, four of them quoting the same clause, all at
   * severity 2 and confidence >=0.98. Unchecked that is GAD-7 = 10 — a "moderate" band
   * manufactured from a single sentence about lying awake worrying.
   */
  const clause = "Nakuwa na mawazo mengi sana, nafikiria kuhusu pesa, nafikiria kuhusu mtoto, mpaka asubuhi.";

  const observed: ExtractionItem[] = [
    item({ construct: "phq9_3", instrument: "PHQ9", item_number: 3, evidence_span: "Usiku sipati usingizi.", confidence: 0.98 }),
    item({ construct: "gad7_2", instrument: "GAD7", item_number: 2, evidence_span: clause, confidence: 0.98 }),
    item({ construct: "gad7_3", instrument: "GAD7", item_number: 3, evidence_span: "nafikiria kuhusu pesa, nafikiria kuhusu mtoto", confidence: 0.99 }),
    item({ construct: "gad7_4", instrument: "GAD7", item_number: 4, evidence_span: "mpaka asubuhi", confidence: 0.99 }),
    item({ construct: "gad7_5", instrument: "GAD7", item_number: 5, evidence_span: clause, confidence: 0.98 }),
    item({ construct: "gad7_1", instrument: "GAD7", item_number: 1, evidence_span: "Niko na stress lakini sijui ni ya nini.", confidence: 0.99 }),
  ];

  it("keeps one scoring item per overlapping cluster and demotes the rest", () => {
    const { items, demoted } = applySpanOverlapBackstop(observed);

    const scoring = items.filter((i) => i.confidence >= 0.6).map((i) => i.construct);
    // Three distinct pieces of evidence in that sentence: the sleep clause, the rumination
    // clause, and the stress clause. Not six.
    expect(scoring).toHaveLength(3);
    expect(scoring).toContain("phq9_3");
    expect(scoring).toContain("gad7_1");
    expect(demoted).toHaveLength(3);
    expect(demoted.every((d) => d.reason === "span_overlap_demoted")).toBe(true);
  });

  it("demoted items fall below the population threshold, so they become probes not scores", () => {
    const { items } = applySpanOverlapBackstop(observed);
    for (const i of items.filter((x) => x.confidence < 0.6)) {
      expect(i.confidence).toBeLessThanOrEqual(0.59);
    }
  });

  it("does NOT collapse genuinely distinct evidence in the same utterance", () => {
    // Sleep and rumination are different clauses. Both must survive — this is the case the
    // backstop must not break.
    const distinct = [
      item({ construct: "phq9_3", evidence_span: "Usiku sipati usingizi." }),
      item({ construct: "gad7_2", instrument: "GAD7", item_number: 2, evidence_span: clause }),
    ];
    const { items, demoted } = applySpanOverlapBackstop(distinct);
    expect(demoted).toHaveLength(0);
    expect(items.every((i) => i.confidence >= 0.6)).toBe(true);
  });

  it("keeps the most complete quote, because that is what gets read back to her", () => {
    const { items } = applySpanOverlapBackstop(observed);
    const survivor = items.find((i) => i.confidence >= 0.6 && i.instrument === "GAD7" && i.construct !== "gad7_1");
    expect(survivor?.evidence_span).toBe(clause);
  });

  it("a single item is never demoted", () => {
    const { items, demoted } = applySpanOverlapBackstop([item()]);
    expect(demoted).toHaveLength(0);
    expect(items[0].confidence).toBe(0.9);
  });
});

describe("the extraction schema is a contract, not a suggestion", () => {
  it("rejects a missing clinical field — there are no optional clinical fields", () => {
    const bad = extraction([item()]);
    const firstItem = bad.items[0] as Partial<ExtractionItem>;
    delete firstItem.severity_basis;
    expect(ExtractionSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invented construct", () => {
    const bad = extraction([item({ construct: "phq9_99" as never })]);
    expect(ExtractionSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects out-of-range severity and confidence", () => {
    expect(ExtractionSchema.safeParse(extraction([item({ severity_estimate: 4 })])).success).toBe(false);
    expect(ExtractionSchema.safeParse(extraction([item({ confidence: 1.5 })])).success).toBe(false);
  });

  it("accepts the valid shape", () => {
    expect(ExtractionSchema.safeParse(extraction([item()])).success).toBe(true);
  });
});

describe("quote dedupe for the generated surfaces", () => {
  it("drops a span contained in a longer one, keeping the fuller quote", () => {
    const kept = dedupeQuotes([
      { construct: "gad7_3", span: "na mawazo mengi sana" },
      { construct: "gad7_2", span: "na mawazo mengi sana, niko in a stress laking sijui nini." },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].span).toContain("niko in a stress");
  });

  it("keeps genuinely distinct quotes and preserves the order she said them in", () => {
    const kept = dedupeQuotes([
      { construct: "phq9_3", span: "Usiku sipati usingizi." },
      { construct: "gad7_2", span: "Niko na stress lakini sijui ni ya nini." },
    ]);
    expect(kept.map((q) => q.span)).toEqual([
      "Usiku sipati usingizi.",
      "Niko na stress lakini sijui ni ya nini.",
    ]);
  });

  it("ignores case and whitespace when comparing", () => {
    const kept = dedupeQuotes([
      { construct: "a", span: "Mawazo  Mengi" },
      { construct: "b", span: "mawazo mengi" },
    ]);
    expect(kept).toHaveLength(1);
  });
});

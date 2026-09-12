/**
 * Contract 2 — the extraction JSON object (§11.3, docs/contracts.md).
 *
 * Every field is required. There are no optional clinical fields: a missing field is a schema
 * violation, not a default. The schema is enforced here, in code, and never trusted from the
 * model (§17.1).
 */

import { z } from "zod";
import { CONSTRUCT_IDS } from "@/lib/clinical/constructs";

export const SpanLanguageSchema = z.enum(["sw", "en", "sheng", "unknown"]);

export const ExtractionItemSchema = z.object({
  instrument: z.enum(["PHQ9", "GAD7"]),
  item_number: z.number().int().min(1).max(9),
  /** Fixed enumeration. The model cannot invent a clinical target. */
  construct: z.enum(CONSTRUCT_IDS as unknown as [string, ...string[]]),
  /** MUST be a literal substring of the transcript. Enforced again in validate.ts (FR-11). */
  evidence_span: z.string().min(1),
  span_language: SpanLanguageSchema,
  idiom_id: z.string().nullable(),
  severity_estimate: z.number().int().min(0).max(3),
  severity_basis: z.string(),
  confidence: z.number().min(0).max(1),
  somatic_only: z.boolean(),
  reasoning: z.string(),
});

export const ExtractionSchema = z.object({
  turn_index: z.number().int().min(0),
  language_profile: z.object({
    sw: z.number().min(0).max(1),
    en: z.number().min(0).max(1),
    sheng: z.number().min(0).max(1),
    unknown: z.number().min(0).max(1),
  }),
  /**
   * Top-level, not an item. Escalation logic reads only this and the deterministic scan's
   * output — never an item's contents (contract rule 4).
   */
  risk_flag: z.boolean(),
  risk_evidence: z.string().nullable(),
  items: z.array(ExtractionItemSchema),
  /**
   * Denial and absence are different states. An item she explicitly denied goes here, NOT into
   * `items` with severity 0, because the coverage map must distinguish the two (§11.3 rule 4).
   */
  constructs_addressed_but_negative: z.array(z.string()),
  unrecognised_language_spans: z.array(z.string()),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractionItem = z.infer<typeof ExtractionItemSchema>;

/**
 * JSON Schema handed to providers that support structured output. Kept in sync with the Zod
 * schema above by the round-trip test in tests/extraction.test.ts — if they drift, that fails.
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "turn_index",
    "language_profile",
    "risk_flag",
    "risk_evidence",
    "items",
    "constructs_addressed_but_negative",
    "unrecognised_language_spans",
  ],
  properties: {
    turn_index: { type: "integer", minimum: 0 },
    language_profile: {
      type: "object",
      additionalProperties: false,
      required: ["sw", "en", "sheng", "unknown"],
      properties: {
        sw: { type: "number", minimum: 0, maximum: 1 },
        en: { type: "number", minimum: 0, maximum: 1 },
        sheng: { type: "number", minimum: 0, maximum: 1 },
        unknown: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    risk_flag: { type: "boolean" },
    risk_evidence: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "instrument",
          "item_number",
          "construct",
          "evidence_span",
          "span_language",
          "idiom_id",
          "severity_estimate",
          "severity_basis",
          "confidence",
          "somatic_only",
          "reasoning",
        ],
        properties: {
          instrument: { type: "string", enum: ["PHQ9", "GAD7"] },
          item_number: { type: "integer", minimum: 1, maximum: 9 },
          construct: { type: "string", enum: [...CONSTRUCT_IDS] },
          evidence_span: { type: "string" },
          span_language: { type: "string", enum: ["sw", "en", "sheng", "unknown"] },
          idiom_id: { type: ["string", "null"] },
          severity_estimate: { type: "integer", minimum: 0, maximum: 3 },
          severity_basis: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          somatic_only: { type: "boolean" },
          reasoning: { type: "string" },
        },
      },
    },
    constructs_addressed_but_negative: { type: "array", items: { type: "string" } },
    unrecognised_language_spans: { type: "array", items: { type: "string" } },
  },
} as const;

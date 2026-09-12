/**
 * The two generated summaries (FR-21, FR-22).
 *
 * Both are constrained to quoting only spans already in the record (§9.2 step 12), and both pass
 * the FR-24a denylist before they are rendered or persisted. Neither may introduce a clinical
 * conclusion the deterministic scorer did not reach.
 *
 * §24.11 cut, honoured here: FR-22's "at her measured proportions" is deliberately NOT
 * implemented. Hitting a target token ratio is an open generation-control problem and it is not
 * what the trust requirement in §4.2 asks for. Her own words back is. So the back-read reproduces
 * her verbatim quotes inside a Kiswahili frame.
 */

import { getConstruct } from "@/lib/clinical/constructs";
import type { Referral } from "@/lib/clinical/route";
import { PHQ9_BAND_LABELS_SW, type Scores } from "@/lib/clinical/score";
import { getLLMAdapter, LLMError } from "@/lib/llm";
import { checkDenylist, SAFE_FALLBACK } from "@/lib/safety/denylist";

export interface SummaryInput {
  quotes: Array<{ construct: string; span: string }>;
  scores: Scores;
  referral: Referral;
  escalated: boolean;
  incomplete: boolean;
  chpCode: string;
  screenedAt: Date;
  possibleUnderEndorsement?: boolean;
}

export interface SummaryResult {
  text: string;
  fellBackToTemplate: boolean;
  latencyMs: number;
}

/** Generate, denylist, regenerate once, then fall back to a fixed safe template (FR-24a). */
async function generateChecked(
  system: string,
  user: string,
  fallback: string,
  maxTokens: number,
): Promise<SummaryResult> {
  const adapter = getLLMAdapter();
  let latencyMs = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await adapter.complete({ system, user, maxTokens });
      latencyMs += result.latencyMs;
      const text = result.text.trim();
      if (text.length > 0 && checkDenylist(text).length === 0) {
        return { text, fellBackToTemplate: false, latencyMs };
      }
    } catch (err) {
      if (!(err instanceof LLMError)) throw err;
    }
  }

  return { text: fallback, fellBackToTemplate: true, latencyMs };
}

/**
 * FR-22 — the back-read, in her own language mix, for the CHP to read aloud BEFORE submission.
 *
 * This is verification layer 3 (§11.9): she is the ground truth for what she said, and she gets
 * the last word. Her disagreement is recorded, not silently discarded.
 */
export async function generateBackRead(input: SummaryInput): Promise<SummaryResult> {
  const system = `You write a short passage in Kiswahili for a Kenyan Community Health Promoter to read ALOUD to the mother she has just screened, so the mother can confirm or correct it before anything is sent.

HARD CONSTRAINTS:
- Reproduce her quotes EXACTLY as given. Do not translate them, do not tidy them, do not fix spelling. They are her words and she is about to hear them back.
- Kiswahili frame around those quotes, Kenyan colloquial. Warm-professional, the register a respected senior CHP uses.
- No score, no number, no band, no diagnosis, no disorder name, no medication, no advice.
- Say plainly what will be sent and to whom.
- End by asking whether anything is wrong.
- 90 words maximum. It is going to be spoken out loud in someone's home.
- No sympathy phrases on the system's behalf. No "pole sana".

Return ONLY the passage.`;

  const user = `HER WORDS, to reproduce verbatim inside your Kiswahili frame:
${input.quotes.map((q) => `- "${q.span}"`).join("\n")}

WHAT HAPPENS NEXT: the writing goes to ${
    input.referral.tier === "chp_followup" ? "the CHP for a follow-up visit" : "the clinic health worker"
  }.

Write the passage.`;

  return generateChecked(system, user, SAFE_FALLBACK.backReadSw, 400);
}

/**
 * FR-21 — the English facility handover. Peter Otieno's fifteen-second job.
 *
 * Quotes stay verbatim and UNTRANSLATED, each followed by a bracketed gloss — because the
 * untranslated original is the evidence and the gloss is the convenience, and collapsing the two
 * would throw away the thing this product exists to preserve.
 */
export async function generateHandover(input: SummaryInput): Promise<SummaryResult> {
  const system = `You write a short English clinical handover note for a clinical officer at a Kenyan health facility. They will read it in about fifteen seconds.

HARD CONSTRAINTS:
- 120 words maximum.
- NEVER write the words "safety escalation", "escalation", "risk flag" or "no risk" anywhere in the note. Whether a safety escalation occurred is stated deterministically in a header above your text, which you do not write and cannot see. A generated sentence beginning "Safety escalation:" on a screening where none occurred reads to a clinician as though one did, and this note is skimmed in fifteen seconds.
- Report the band in words. Do NOT invent or restate cut-offs: the scores and thresholds are given to you below and are already correct. Copy them, do not reason about them. In particular the threshold of 3 belongs to PHQ-2 and GAD-2 ONLY — PHQ-9 and GAD-7 do not have a cut-off of 3 and saying they do is a clinical error.
- Include the mother's own quotes VERBATIM AND UNTRANSLATED, each followed by a bracketed English gloss. THE GLOSS IS A PLAIN ENGLISH TRANSLATION OF HER WORDS — what she said — and never the name of a questionnaire item. For example: "mawazo mengi" [many thoughts], not "mawazo mengi" [Worrying about many things]. Never replace her words with the gloss.
- NO diagnosis, no disorder name, no ICD or DSM code, no medication, no treatment recommendation, no prognosis. This is a screening handover and the referral decision has already been made deterministically — do not re-reason it.
- State plainly if the screen was incomplete.
- Plain prose that survives being pasted into WhatsApp. No markdown, no headings, no bullet characters.

Return ONLY the note.`;

  // Deliberately NOT told whether an escalation occurred. That fact is carried by the
  // deterministic header, which cannot hedge, cannot paraphrase, and cannot invent it.
  const user = `SCREENED: ${input.screenedAt.toISOString()}  CHP: ${input.chpCode}
INSTRUMENT: PHQ-9 (0-27) and GAD-7 (0-21). PHQ-2 / GAD-2 threshold 3, matching the IPMH trial.
SCORES: PHQ-9 ${input.scores.phq9} (${input.scores.phq9Band.replace("_", " ")}), GAD-7 ${input.scores.gad7} (${input.scores.gad7Band}), PHQ-2 ${input.scores.phq2}, GAD-2 ${input.scores.gad2}.
COVERAGE: ${input.scores.coverage.phq9ItemsEvidenced}/9 PHQ-9 items evidenced, ${input.scores.coverage.gad7ItemsEvidenced}/7 GAD-7.
${input.incomplete ? "THE SCREEN WAS NOT COMPLETED. Say so.\n" : ""}${input.possibleUnderEndorsement ? "POSSIBLE UNDER-ENDORSEMENT: flat denial alongside strong somatic content. The clinician should know we suspected it.\n" : ""}REFERRAL (already decided, do not re-reason): ${input.referral.tier} — ${input.referral.reason}

HER QUOTES. Reproduce each verbatim, then a bracketed ENGLISH TRANSLATION OF THOSE WORDS. The
construct name is given only so you know why the quote is in the record. It is NOT the gloss and
must not be used as one.
${input.quotes
    .map((q) => `- "${q.span}"   (recorded against: ${getConstruct(q.construct)?.labelEn ?? q.construct})`)
    .join("\n")}

Write the note.`;

  return generateChecked(system, user, SAFE_FALLBACK.handoverEn, 500);
}

/** The deterministic header the handover is prefixed with, so the facts never depend on a model. */
export function handoverHeader(input: SummaryInput): string {
  const band = PHQ9_BAND_LABELS_SW[input.scores.phq9Band];
  return [
    `MAMA-SAUTI screening · ${input.screenedAt.toISOString().slice(0, 16).replace("T", " ")} · CHP ${input.chpCode}`,
    input.escalated ? "*** SAFETY ESCALATION — same-day facility contact required ***" : null,
    `PHQ-9 ${input.scores.phq9} (${input.scores.phq9Band.replace("_", " ")} / ${band})  ·  GAD-7 ${input.scores.gad7} (${input.scores.gad7Band})`,
    `PHQ-2 ${input.scores.phq2}  ·  GAD-2 ${input.scores.gad2}  ·  threshold 3 (IPMH)`,
    `Referral: ${input.referral.tier} — ${input.referral.reason}`,
    input.incomplete ? "Screen INCOMPLETE — fewer than 6 PHQ-9 items evidenced." : null,
    "Not a diagnosis. An initial screening that supports a referral.",
    "This instrument has not been criterion-validated in Kiswahili for a perinatal population.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * FR-24a — the output denylist. Every model-generated string passes this before it is rendered
 * or persisted.
 *
 * FR-24 ("the product never emits a diagnosis") is unenforceable by static string tests alone,
 * because five surfaces are generated at runtime: the probe, the Kiswahili back-read, the English
 * handover, and the `reasoning` / `severity_basis` free-text fields.
 *
 * On a hit the string is regenerated once; on a second hit the surface falls back to a fixed safe
 * template and the event is logged. That policy lives in the caller; this module decides only
 * whether a string is safe to show.
 */

export type DeniedCategory =
  | "icd_code"
  | "diagnostic_noun"
  | "stigmatising_term"
  | "medication"
  | "prescriptive_verb";

export interface DenylistHit {
  category: DeniedCategory;
  matched: string;
}

/** ICD-10 mood/anxiety block, and DSM-style code shapes. */
const ICD_RE = /\bF[0-9]{2}(\.[0-9]{1,2})?\b/gi;

/**
 * Diagnostic nouns in English and Kiswahili. Note the deliberate omissions: "screening",
 * "referral" and "band" are the words the product IS allowed to use (§10.9).
 */
const DIAGNOSTIC_NOUNS = [
  "depression", "depressed", "depressive",
  "disorder", "diagnosis", "diagnose", "diagnosed", "diagnostic",
  "psychosis", "psychotic", "schizophrenia", "bipolar",
  "ptsd", "neurosis",
  "ugonjwa wa akili", "ugonjwa wa mawazo", "utambuzi wa ugonjwa",
];

/**
 * §10.9: never used in output copy. They are recognition-lexicon entries only — the product must
 * understand them if a mother says them, and must never say them back.
 */
const STIGMATISING = ["mwendawazimu", "pagawa", "kichaa"];

/** A small psychotropic INN list. Any of these in output is a treatment recommendation (§8.5). */
const MEDICATIONS = [
  "sertraline", "fluoxetine", "amitriptyline", "diazepam", "citalopram",
  "escitalopram", "paroxetine", "imipramine", "olanzapine", "risperidone",
  "haloperidol", "lorazepam", "alprazolam", "antidepressant", "antidepressants",
];

const PRESCRIPTIVE_VERBS = [
  "should take", "must take", "needs medication", "prescribe", "prescribed", "prescription",
  "anafaa kunywa", "anatakiwa kunywa", "atumie dawa", "anywe dawa",
];

function findPhrases(haystack: string, phrases: string[], category: DeniedCategory): DenylistHit[] {
  const hay = haystack.toLowerCase();
  const hits: DenylistHit[] = [];
  for (const phrase of phrases) {
    const needle = phrase.toLowerCase();
    // Word-boundary match for single tokens; substring for multi-word phrases, since Swahili
    // agglutination makes a boundary regex unreliable across a phrase.
    if (needle.includes(" ")) {
      if (hay.includes(needle)) hits.push({ category, matched: phrase });
    } else {
      const re = new RegExp(`(^|[^\\p{L}])${escapeRe(needle)}([^\\p{L}]|$)`, "u");
      if (re.test(hay)) hits.push({ category, matched: phrase });
    }
  }
  return hits;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Negated forms that are REQUIRED copy, not violations.
 *
 * The product's own mandatory disclaimer is "Hii si utambuzi wa ugonjwa" — "this is not a
 * diagnosis" (§15.6, FR-24). A denylist that blocks the sentence the spec requires on three
 * screens is a denylist that will be switched off by whoever hits it at 3 a.m.
 *
 * So these spans are removed before scanning. The distinction is exact: asserting a diagnosis is
 * banned, and disclaiming one is mandatory. Anything that is not one of these literal negated
 * forms still trips the list.
 */
const REQUIRED_NEGATIONS = [
  "si utambuzi wa ugonjwa",
  "sio utambuzi wa ugonjwa",
  "hakuna utambuzi wa ugonjwa",
  "haitoi utambuzi wa ugonjwa",
  "not a diagnosis",
  "does not diagnose",
  "is not a diagnostic",
  "no diagnosis is made",
];

function stripRequiredNegations(text: string): string {
  let out = text;
  for (const phrase of REQUIRED_NEGATIONS) {
    out = out.replace(new RegExp(escapeRe(phrase), "gi"), " ");
  }
  return out;
}

export function checkDenylist(raw: string): DenylistHit[] {
  if (!raw) return [];
  const text = stripRequiredNegations(raw);
  const hits: DenylistHit[] = [];

  const icd = text.match(ICD_RE);
  if (icd) for (const m of icd) hits.push({ category: "icd_code", matched: m });

  hits.push(...findPhrases(text, DIAGNOSTIC_NOUNS, "diagnostic_noun"));
  hits.push(...findPhrases(text, STIGMATISING, "stigmatising_term"));
  hits.push(...findPhrases(text, MEDICATIONS, "medication"));
  hits.push(...findPhrases(text, PRESCRIPTIVE_VERBS, "prescriptive_verb"));

  return hits;
}

export function passesDenylist(text: string): boolean {
  return checkDenylist(text).length === 0;
}

/**
 * The fixed safe templates a surface falls back to after a second denylist hit. Deliberately
 * bland: a fallback that tries to be clever is a fallback that can fail the same way twice.
 */
export const SAFE_FALLBACK = {
  probeSw: "Unaweza kuniambia zaidi kuhusu jinsi umekuwa ukijisikia?",
  probeEn: "Can you tell me more about how you have been feeling?",
  backReadSw:
    "Nimeandika uliyoniambia leo. Tutapeleka maandishi haya kwa mhudumu wa kliniki. Hii si utambuzi wa ugonjwa.",
  handoverEn:
    "Screening record generated. The narrative summary was withheld because it did not pass the output safety check. See the structured scores, the evidence quotes and the referral tier below.",
  reasoning: "Withheld: generated text did not pass the output safety check.",
} as const;

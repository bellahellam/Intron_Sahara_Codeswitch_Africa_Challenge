/**
 * Token-level language identification (§17.6).
 *
 * Deliberately a heuristic: a wordlist plus character-n-gram cues, capped at the scope §24.11
 * agreed. The cut list is explicit that a proper LID model is not in scope, and that a heuristic
 * LID yields CMI with unknown error — which makes CMI-Δ meaningless anyway. So CMI is computed
 * once, in the benchmark harness, on gold text. What the PRODUCT needs LID for is exactly one
 * thing: tinting English spans ochre so the code-switching is visible on screen (§16.5).
 *
 * Saying that plainly is better than shipping a heuristic dressed up as a model.
 */

export type SpanLanguage = "sw" | "en" | "sheng" | "unknown";

export interface LanguageSpan {
  start: number;
  end: number;
  text: string;
  language: SpanLanguage;
}

/**
 * Common English function and content words that appear as insertions in Kenyan Kiswahili
 * speech. Not exhaustive, and not meant to be: it only has to be right often enough to tint.
 */
const EN_WORDS = new Set([
  "the","a","an","and","or","but","so","because","if","when","then","that","this","these","those",
  "i","you","he","she","it","we","they","me","him","her","us","them","my","your","his","their","our",
  "is","am","are","was","were","be","been","being","have","has","had","do","does","did","can","could",
  "will","would","should","must","not","no","yes","very","just","really","only","also","too","now",
  "stress","stressed","depressed","depression","anxious","anxiety","worry","worried","tired","sleep",
  "sad","alone","lonely","hopeless","overwhelmed","energy","body","heavy","struggle","painkillers",
  "baby","mother","bad","good","fine","okay","ok","feel","feeling","think","thinking","mind","heart",
  "hospital","clinic","doctor","nurse","medicine","money","work","house","family","husband","time",
  "day","night","morning","week","month","year","help","support","problem","pressure","control",
  "connect","concentrate","focus","appetite","weight","headache","pain","sick","health","life",
  "january","february","march","april","may","june","july","august","september","october","november","december",
  "one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","fifteen","twenty","thirty",
]);

/** Sheng markers — recorded when present, never claimed as a capability (§5.1). */
const SHENG_MARKERS = new Set(["poa", "sifeel", "siko", "manze", "buda", "mathe", "fom", "sare", "mtaa"]);

/**
 * Swahili morphology that survives on an English stem: "kuconnect", "nimecheck", "sifeel".
 * These are mixed-grammar tokens and the honest label is Sheng / code-mixed, not English.
 */
const SW_PREFIXES = [
  "nime", "aname", "tume", "wame", "ume", "nili", "ali", "tuli", "wali", "uli",
  "nina", "ana", "tuna", "wana", "una", "hana", "sina", "haku", "siku", "sita", "hata",
  "ku", "ni", "si", "ha", "a", "u", "tu", "wa", "ya", "na",
];

const SW_SUFFIXES = ["angu", "ako", "ake", "etu", "enu", "ao", "ni", "wa", "ka", "sha"];

function looksSwahili(token: string): boolean {
  // Swahili is overwhelmingly CV-structured and vowel-final. English is not.
  const vowelFinal = /[aeiou]$/.test(token);
  const hasSwCluster = /(ny|ng'|mb|nd|nj|mw|kw|sh|ch)/.test(token);
  const hasEnglishFinalCluster = /[bcdfghjklmnpqrstvwxz]{2}$/.test(token);
  if (hasEnglishFinalCluster) return false;
  return vowelFinal || hasSwCluster;
}

function hasSwahiliAffix(token: string): boolean {
  return (
    SW_PREFIXES.some((p) => token.length > p.length + 2 && token.startsWith(p)) ||
    SW_SUFFIXES.some((s) => token.length > s.length + 2 && token.endsWith(s))
  );
}

export function classifyToken(raw: string): SpanLanguage {
  const token = raw.normalize("NFC").toLowerCase();
  if (!/[\p{L}]/u.test(token)) return "unknown";

  if (SHENG_MARKERS.has(token)) return "sheng";
  if (EN_WORDS.has(token)) return "en";

  // A Swahili affix wrapped around an English stem ("kuconnect", "nimecheck") is mixed grammar.
  // Label it sheng: it is neither a clean English insertion nor plain Kiswahili, and §18.11
  // names it as a genuinely hard case worth reporting rather than hiding.
  const stripped = token.replace(/^(nime|aname|tume|wame|ume|nili|ali|tuli|wali|uli|ku|ni|si|ha)/, "");
  if (stripped !== token && stripped.length >= 4 && EN_WORDS.has(stripped)) return "sheng";

  if (looksSwahili(token) || hasSwahiliAffix(token)) return "sw";

  // Latin script, not obviously Swahili, not a known English word. Most often an English content
  // word we do not list. Do NOT call it unknown — that label is reserved for a genuinely
  // unrecognised third language, which triggers a real product behaviour (§10.8).
  return /[bcdfghjklmnpqrstvwxz]{2}|[aeiou]{2}[bcdfghjklmnpqrstvwxz]$/.test(token) ? "en" : "sw";
}

/** Contiguous runs of one language, so the UI can tint a phrase rather than a word at a time. */
export function tagLanguageSpans(text: string): LanguageSpan[] {
  const spans: LanguageSpan[] = [];
  const re = /[\p{L}\p{N}']+/gu;
  let m: RegExpExecArray | null;
  let current: LanguageSpan | null = null;

  while ((m = re.exec(text)) !== null) {
    const lang = classifyToken(m[0]);
    if (current && current.language === lang) {
      current.end = m.index + m[0].length;
      current.text = text.slice(current.start, current.end);
    } else {
      if (current) spans.push(current);
      current = { start: m.index, end: m.index + m[0].length, text: m[0], language: lang };
    }
  }
  if (current) spans.push(current);
  return spans;
}

export interface LanguageProfile {
  sw: number;
  en: number;
  sheng: number;
  unknown: number;
}

/** Token-weighted proportion across her turns. Stored as session.language_profile (§10.10 rule 2). */
export function languageProfile(texts: string[]): LanguageProfile {
  const counts: Record<SpanLanguage, number> = { sw: 0, en: 0, sheng: 0, unknown: 0 };
  let total = 0;
  for (const text of texts) {
    const re = /[\p{L}\p{N}']+/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      counts[classifyToken(m[0])] += 1;
      total += 1;
    }
  }
  if (total === 0) return { sw: 0, en: 0, sheng: 0, unknown: 0 };
  const round = (n: number) => Math.round((n / total) * 100) / 100;
  return { sw: round(counts.sw), en: round(counts.en), sheng: round(counts.sheng), unknown: round(counts.unknown) };
}

/** Her dominant matrix language. Probes are generated in this (§10.10 rule 3). */
export function matrixLanguage(profile: LanguageProfile): "sw" | "en" {
  // Rule 9: if her mix is majority-English, the product does not switch to English-only.
  // Kiswahili scaffolding remains, because the CHP's reading register is not necessarily the
  // mother's speaking register. So the threshold to flip is deliberately high.
  return profile.en > 0.7 ? "en" : "sw";
}

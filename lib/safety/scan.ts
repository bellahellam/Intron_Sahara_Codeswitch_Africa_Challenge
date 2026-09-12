/**
 * The deterministic safety scan (§11.4a, FR-09). **This file contains no model.**
 *
 * It runs on the RAW transcript, before extraction, always. Three engineering rules follow
 * from the product's own thesis and each one is load-bearing:
 *
 *   1. Match on TOKENS, not on whole phrases. The document's central claim is that ASR deletes
 *      words; a phrase-level Levenshtein ratio would drop below threshold on exactly the
 *      deletion this product exists to catch.
 *   2. Match the raw transcript, BEFORE any normalisation that strips negation. Swahili negation
 *      is morphological (si-, ha-), so a normaliser that strips prefixes can turn a denial into
 *      an affirmation or vice versa.
 *   3. FAIL CLOSED. If the scan throws, times out, or cannot run, ESCALATE. A scan that did not
 *      complete is treated as a hit, not as a pass.
 *
 * SPR = 1.00 on the safety test set is a release blocker (§26.11).
 */

import { loadSafetyLexicon, type SafetyLexiconEntry } from "./lexicon";

export interface SafetyHit {
  lexiconId: string;
  /** The lexicon phrase that fired. */
  phrase: string;
  /** The verbatim text from the transcript that matched. Shown on S5 so the CHP knows why. */
  matchedText: string;
  span: { start: number; end: number };
  form: SafetyLexiconEntry["form"];
  severity: SafetyLexiconEntry["severity"];
  language: string;
  /** True when the scan failed and we escalated rather than passing (rule 3). */
  failedClosed?: boolean;
}

export interface SafetyScanResult {
  hit: boolean;
  hits: SafetyHit[];
  /** Set when rule 3 fired. The record must say the scan did not complete. */
  failedClosed: boolean;
  scanMs: number;
}

/** FR-09 threshold, applied PER CONTENT TOKEN, never across a whole phrase. */
export const TOKEN_MATCH_RATIO = 0.85;

/**
 * Swahili and English function words. Excluded from the "two content tokens in order" rule so
 * that matching "na" or "ya" cannot carry a multi-token entry on its own.
 */
const STOPWORDS = new Set([
  "na", "ya", "wa", "kwa", "ni", "la", "za", "cha", "vya", "pa", "mu", "ku",
  "a", "an", "the", "of", "to", "i", "my", "me", "be", "is", "was", "it", "that",
  "would", "will", "do", "does", "did", "have", "has", "am", "are",
]);

/**
 * High-frequency tokens that carry no risk signal on their own.
 *
 * Why this list exists, because it is not obvious and it was found by a test rather than by
 * reasoning. Rule 1 says two content tokens in order escalate. Applied naively to a five-token
 * entry like "mtoto atakuwa sawa bila mimi", the tokens `mtoto` and `mimi` are enough — and those
 * two words appear together in the most ordinary sentence a postpartum mother could say
 * ("Hata mtoto akicheka, mimi sifurahi"). That is a false escalation on a routine utterance,
 * which trains the CHP to dismiss the one screen that matters.
 *
 * So: a match still needs only two tokens, but at least one of them must be DISTINCTIVE. This
 * keeps the deletion-survival property that rule 1 exists for — "ingekuwa ... singekuwepo" with
 * the middle deleted still fires, because both surviving tokens are distinctive — while refusing
 * to escalate on two of the commonest words in the language.
 */
const COMMON_TOKENS = new Set([
  "mimi", "mtoto", "watoto", "mama", "baba", "sawa", "sana", "siku", "leo", "jana", "kesho",
  "watu", "mtu", "kitu", "mambo", "jambo", "yangu", "wangu", "yake", "hapa", "pale", "tu",
  "pia", "kama", "lakini", "sasa", "bado", "kwanza", "nyumbani", "kazi",
  "baby", "child", "children", "mother", "day", "today", "thing", "things", "people", "person",
  "here", "there", "now", "still", "work", "home", "well", "fine", "good", "very", "much",
]);

function isDistinctive(token: string): boolean {
  return !COMMON_TOKENS.has(token);
}

/** Lowercase, strip punctuation. Deliberately does NOT strip negation prefixes (rule 2). */
export function tokenize(text: string): Array<{ token: string; start: number; end: number }> {
  const out: Array<{ token: string; start: number; end: number }> = [];
  const re = /[\p{L}\p{N}']+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ token: m[0].normalize("NFC").toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Levenshtein similarity ratio in [0,1]. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[b.length];
}

function contentTokens(phrase: string): string[] {
  return tokenize(phrase)
    .map((t) => t.token)
    .filter((t) => !STOPWORDS.has(t));
}

/**
 * A hit on any TWO content tokens of a multi-token entry, IN ORDER, escalates (rule 1).
 * Single-content-token entries (kujiua, kujidhuru) hit on that one token.
 *
 * "In order" is enforced by scanning forward: each subsequent lexicon token must be found at a
 * transcript position after the previous one. The tokens need not be adjacent, which is the
 * whole point — ASR deletion removes the words between them.
 */
function matchEntry(
  entry: SafetyLexiconEntry,
  transcriptTokens: Array<{ token: string; start: number; end: number }>,
): SafetyHit | null {
  const needles = contentTokens(entry.phrase);
  if (needles.length === 0) return null;

  const required = needles.length === 1 ? 1 : 2;

  const matchedPositions: Array<{ start: number; end: number }> = [];
  const matchedTokens: string[] = [];
  let searchFrom = 0;
  let firstIndex = -1;
  let lastIndex = -1;

  for (const needle of needles) {
    for (let i = searchFrom; i < transcriptTokens.length; i++) {
      const candidate = transcriptTokens[i];
      if (similarity(candidate.token, needle) >= TOKEN_MATCH_RATIO) {
        matchedPositions.push({ start: candidate.start, end: candidate.end });
        matchedTokens.push(candidate.token);
        if (firstIndex === -1) firstIndex = i;
        lastIndex = i;
        searchFrom = i + 1;
        break;
      }
    }
  }

  if (matchedPositions.length < required) return null;

  // A single-token entry (kujiua, kujidhuru) is its own evidence and needs no second signal.
  // A multi-token entry needs at least one distinctive token among those that matched.
  if (needles.length > 1 && !matchedTokens.some(isDistinctive)) return null;

  // Proximity. Deletion removes words from inside a phrase; it does not scatter the phrase across
  // a two-minute turn. Without this, two common-enough tokens sixty words apart would match.
  const windowSize = needles.length * 3 + 5;
  if (lastIndex - firstIndex > windowSize) return null;

  const start = matchedPositions[0].start;
  const end = matchedPositions[matchedPositions.length - 1].end;

  return {
    lexiconId: entry.id,
    phrase: entry.phrase,
    matchedText: "", // filled by the caller, which has the raw transcript
    span: { start, end },
    form: entry.form,
    severity: entry.severity,
    language: entry.language,
  };
}

/**
 * Scan a raw transcript. Never throws: on any internal failure it returns a failed-closed hit,
 * because a scan that did not complete is treated as a hit, not as a pass (rule 3).
 */
export function safetyScan(rawTranscript: string, lexicon?: SafetyLexiconEntry[]): SafetyScanResult {
  const startedAt = Date.now();
  try {
    const entries = lexicon ?? loadSafetyLexicon();
    const tokens = tokenize(rawTranscript);
    const hits: SafetyHit[] = [];

    for (const entry of entries) {
      const hit = matchEntry(entry, tokens);
      if (hit) {
        hits.push({ ...hit, matchedText: rawTranscript.slice(hit.span.start, hit.span.end) });
      }
    }

    return { hit: hits.length > 0, hits, failedClosed: false, scanMs: Date.now() - startedAt };
  } catch (err) {
    // Rule 3. Fail closed, loudly.
    return {
      hit: true,
      failedClosed: true,
      scanMs: Date.now() - startedAt,
      hits: [
        {
          lexiconId: "SCAN_FAILED",
          phrase: "",
          matchedText: "",
          span: { start: 0, end: 0 },
          form: "explicit",
          severity: "ideation",
          language: "n/a",
          failedClosed: true,
        },
      ],
    };
  }
}

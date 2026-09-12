/**
 * Idiom matching (§11.4). Fuzzy, lexicon-driven and auditable.
 *
 * Given the accent and orthographic variation in §5.6, exact matching would fail constantly.
 * Three rules, each with a reason:
 *
 *   - Normalise NFC → lowercase → strip punctuation. **Do not strip diacritics.** Intron's own
 *     reference harness does (§18.7), and it is wrong for a lexicon: it collapses distinctions
 *     the matcher relies on.
 *   - Token-level fuzzy match at Levenshtein ratio >= 0.85, plus stem variants per entry.
 *   - Record the matched `idiom_id` on the item so a reviewer can audit which entry fired.
 *
 * An idiom match raises confidence by at most +0.10 and NEVER sets severity on its own. That
 * follows directly from Kaiser 2015: "'thinking too much' should not be interpreted as a gloss
 * for psychiatric disorder." Idioms map to construct *evidence*, never to a diagnosis.
 */

import { similarity, tokenize } from "@/lib/safety/scan";
import { loadIdiomLexicon, type IdiomLexiconEntry } from "@/lib/safety/lexicon";

export const IDIOM_MATCH_RATIO = 0.85;

/** The most an idiom match may contribute. Never enough to populate a construct on its own. */
export const IDIOM_CONFIDENCE_BONUS = 0.1;

export interface IdiomMatch {
  idiomId: string;
  phrase: string;
  gloss: string;
  matchedText: string;
  span: { start: number; end: number };
  source: string;
  doiOrPmcid: string;
}

/**
 * Stem variants. Swahili verbs inflect heavily for subject and tense, so the lexicon stores one
 * citation form and we generate the family: kufikiria / kufikiri / nafikiria / anafikiria / ...
 */
export function stemVariants(phrase: string): string[] {
  const variants = new Set<string>([phrase]);
  const words = phrase.split(/\s+/);

  const inflect = (word: string): string[] => {
    const out = [word];
    const m = /^ku(.+)$/.exec(word);
    if (m) {
      const stem = m[1];
      out.push(stem);
      for (const prefix of ["na", "ana", "ni", "a", "wa", "tuna", "wana", "nime", "ame", "ali", "nili"]) {
        out.push(prefix + stem);
      }
      // kufikiria -> kufikiri, the attested variant pair in §5.4
      if (stem.endsWith("a")) out.push("ku" + stem.slice(0, -1));
    }
    return out;
  };

  if (words.length === 1) {
    for (const v of inflect(words[0])) variants.add(v);
  } else {
    for (const v of inflect(words[0])) variants.add([v, ...words.slice(1)].join(" "));
  }

  return [...variants];
}

function normalise(text: string): string {
  // NFC, lowercase, punctuation stripped. Diacritics deliberately preserved.
  return text.normalize("NFC").toLowerCase();
}

function matchVariant(
  variant: string,
  tokens: Array<{ token: string; start: number; end: number }>,
): { start: number; end: number } | null {
  const needles = tokenize(variant).map((t) => t.token);
  if (needles.length === 0) return null;

  // Contiguous token-level fuzzy match. Unlike the safety scan, an idiom must appear as a
  // phrase: the safety scan tolerates gaps because deletion is the thing it exists to survive,
  // whereas a gapped idiom match would produce false chips on unrelated speech.
  for (let i = 0; i + needles.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < needles.length; j++) {
      if (similarity(tokens[i + j].token, needles[j]) < IDIOM_MATCH_RATIO) {
        ok = false;
        break;
      }
    }
    if (ok) return { start: tokens[i].start, end: tokens[i + needles.length - 1].end };
  }
  return null;
}

export function matchIdioms(transcript: string, lexicon?: IdiomLexiconEntry[]): IdiomMatch[] {
  const entries = lexicon ?? loadIdiomLexicon();
  const tokens = tokenize(normalise(transcript));
  const matches: IdiomMatch[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    // Entries whose mapping is `safety_lexicon` are handled by the deterministic safety scan,
    // not here. Chipping them as idioms on an evidence card would be the wrong surface.
    if (entry.mapping.includes("safety_lexicon")) continue;

    for (const variant of stemVariants(entry.phrase)) {
      const span = matchVariant(variant, tokens);
      if (span && !seen.has(entry.id)) {
        seen.add(entry.id);
        matches.push({
          idiomId: entry.id,
          phrase: entry.phrase,
          gloss: entry.gloss,
          matchedText: transcript.slice(span.start, span.end),
          span,
          source: entry.source,
          doiOrPmcid: entry.doiOrPmcid,
        });
        break;
      }
    }
  }

  return matches;
}

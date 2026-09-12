/**
 * Lexicon loading. The CSVs in data/ are contracts with clinicians, not with the code (§14.8):
 * a clinician or a native speaker must be able to review them without reading TypeScript.
 *
 * Server-only — these read from disk. Never import into a client component.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export type SafetyForm = "explicit" | "idiomatic" | "hedged" | "passive" | "third_person";

/** All four severities escalate. Severity is recorded for the clinician, never used as a threshold. */
export type SafetySeverity = "active_intent" | "ideation" | "passive_ideation" | "hopelessness";

export interface SafetyLexiconEntry {
  id: string;
  phrase: string;
  language: string;
  register: string;
  form: SafetyForm;
  severity: SafetySeverity;
  source: string;
  clinicianReviewed: boolean;
  addedAt: string;
}

export interface IdiomLexiconEntry {
  id: string;
  phrase: string;
  register: string;
  gloss: string;
  /** Semicolon-separated construct ids, or a special token like `safety_lexicon`. */
  mapping: string[];
  source: string;
  doiOrPmcid: string;
  confidence: string;
}

const DATA_DIR = path.join(process.cwd(), "data");

/** Minimal RFC4180-ish CSV parser: handles quoted fields containing commas and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else if (ch !== "\r") field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  return rows;
}

function toObjects(csv: string): Array<Record<string, string>> {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

let safetyCache: SafetyLexiconEntry[] | null = null;

export function loadSafetyLexicon(): SafetyLexiconEntry[] {
  if (safetyCache) return safetyCache;
  const csv = readFileSync(path.join(DATA_DIR, "safety_lexicon.csv"), "utf8");
  safetyCache = toObjects(csv).map((r) => ({
    id: r.id,
    phrase: r.phrase,
    language: r.language,
    register: r.register,
    form: r.form as SafetyForm,
    severity: r.severity as SafetySeverity,
    source: r.source,
    clinicianReviewed: r.clinician_reviewed === "true",
    addedAt: r.added_at,
  }));
  return safetyCache;
}

let idiomCache: IdiomLexiconEntry[] | null = null;

export function loadIdiomLexicon(): IdiomLexiconEntry[] {
  if (idiomCache) return idiomCache;
  const csv = readFileSync(path.join(DATA_DIR, "idiom_lexicon.csv"), "utf8");
  idiomCache = toObjects(csv).map((r) => ({
    id: r.id,
    phrase: r.phrase,
    register: r.register,
    gloss: r.gloss,
    mapping: r.phq9_gad7_mapping.split(";").map((s) => s.trim()).filter(Boolean),
    source: r.source,
    doiOrPmcid: r.doi_or_pmcid,
    confidence: r.confidence,
  }));
  return idiomCache;
}

function loadTermList(file: string): Set<string> {
  const csv = readFileSync(path.join(DATA_DIR, file), "utf8");
  return new Set(toObjects(csv).map((r) => r.term.toLowerCase()));
}

let somaticCache: Set<string> | null = null;
let psychCache: Set<string> | null = null;

export function loadSomaticTerms(): Set<string> {
  if (!somaticCache) somaticCache = loadTermList("somatic_terms.csv");
  return somaticCache;
}

export function loadPsychMarkers(): Set<string> {
  if (!psychCache) psychCache = loadTermList("psych_markers.csv");
  return psychCache;
}

/**
 * §11.4a: clinician_reviewed must be true for every row before the demo is recorded. This is the
 * one artifact a software engineer should not author alone. Surfaced rather than assumed — if no
 * clinician was reachable, LIMITATIONS.md says so rather than implying review that did not happen.
 */
export function safetyLexiconReviewStatus(): { total: number; reviewed: number; allReviewed: boolean } {
  const entries = loadSafetyLexicon();
  const reviewed = entries.filter((e) => e.clinicianReviewed).length;
  return { total: entries.length, reviewed, allReviewed: reviewed === entries.length };
}

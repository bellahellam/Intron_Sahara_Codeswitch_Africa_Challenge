/**
 * Generate the two review packets that need a human.
 *
 *   npx tsx scripts/export-reviews.ts
 *
 * Writes:
 *   review/safety-lexicon-review.csv    for a Kenyan mental health clinician
 *   review/kiswahili-review.csv         for a native Kenyan Kiswahili speaker
 *
 * Both are CSV so they open in Excel or Google Sheets and can be filled in by someone who has
 * never seen this repository. That is the point: §14.8 makes these data files rather than code
 * specifically so the people who should review them are not required to read TypeScript.
 *
 * When they come back, `npx tsx scripts/apply-reviews.ts` folds the answers in.
 */
import "./env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadSafetyLexicon } from "../lib/safety/lexicon";
import { COPY } from "../lib/copy";

const OUT = path.join(process.cwd(), "review");

function csvEscape(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function writeCsv(file: string, headers: string[], rows: string[][]): void {
  const body = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  writeFileSync(path.join(OUT, file), body + "\n", "utf8");
  console.log(`  wrote review/${file}  (${rows.length} rows)`);
}

// ---------------------------------------------------------------------------------------------
// 1. Safety lexicon → clinician
// ---------------------------------------------------------------------------------------------
function exportSafetyLexicon(): void {
  const entries = loadSafetyLexicon();
  const rows = entries.map((e) => [
    e.id,
    e.phrase,
    e.language,
    e.form,
    e.severity,
    e.source,
    String(e.clinicianReviewed),
    "", // verdict
    "", // suggested_replacement
    "", // notes
  ]);

  writeCsv(
    "safety-lexicon-review.csv",
    [
      "id",
      "phrase",
      "language",
      "form",
      "severity",
      "source",
      "already_reviewed",
      "VERDICT_keep_remove_reword",
      "SUGGESTED_REPLACEMENT",
      "NOTES",
    ],
    rows,
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Every user-visible Kiswahili string → native speaker
//
// Walks lib/copy.ts rather than grepping the codebase, because every such string lives there by
// construction — which is the whole reason that file exists.
// ---------------------------------------------------------------------------------------------
interface CopyRow {
  key: string;
  sw: string;
  en: string;
}

function collectCopy(value: unknown, keyPath: string, out: CopyRow[]): void {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.sw === "string") {
      out.push({ key: keyPath, sw: obj.sw, en: typeof obj.en === "string" ? obj.en : "" });
      return;
    }
    for (const [k, v] of Object.entries(obj)) collectCopy(v, keyPath ? `${keyPath}.${k}` : k, out);
  }
}

function exportKiswahili(): void {
  const rows: CopyRow[] = [];
  collectCopy(COPY, "", rows);

  // The fixed item-9 probe is the highest-stakes string in the product and does not live in
  // COPY — it is a file, deliberately (§11.6a). It must be in this packet regardless.
  const item9 = readFileSync(path.join(process.cwd(), "data", "probes", "phq9_item9.sw.txt"), "utf8").trim();
  const item9En = readFileSync(path.join(process.cwd(), "data", "probes", "phq9_item9.en.txt"), "utf8").trim();
  rows.unshift({ key: "PROBE.phq9_item9 (READ ALOUD TO A WOMAN WHO MAY BE SUICIDAL)", sw: item9, en: item9En });

  writeCsv(
    "kiswahili-review.csv",
    ["key", "current_kiswahili", "english_gloss", "VERDICT_ok_or_fix", "SUGGESTED_KISWAHILI", "NOTES"],
    rows.map((r) => [r.key, r.sw, r.en, "", "", ""]),
  );
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  console.log("Generating review packets...\n");
  exportSafetyLexicon();
  exportKiswahili();
  console.log("\nSend these two files out. See docs/HUMAN-TASKS.md for what to ask for.");
  console.log("When they come back, run: npx tsx scripts/apply-reviews.ts");
}

main();

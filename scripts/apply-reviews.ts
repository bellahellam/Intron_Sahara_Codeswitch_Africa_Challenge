/**
 * Fold completed review packets back into the repository.
 *
 *   npx tsx scripts/apply-reviews.ts
 *
 * Reads review/safety-lexicon-review.csv and review/kiswahili-review.csv, applies what the
 * reviewers wrote, and reports what changed.
 *
 * THE ONE RULE: `clinician_reviewed` is only ever set to true for a row a clinician actually
 * marked. It is never set in bulk, never defaulted, and never inferred from "they sent the file
 * back". §11.4a is explicit that claiming review which did not happen is worse than admitting it
 * did not.
 */
import "./env";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "../lib/safety/lexicon";

const ROOT = process.cwd();

function readReview(file: string): Array<Record<string, string>> | null {
  const full = path.join(ROOT, "review", file);
  if (!existsSync(full)) {
    console.log(`  review/${file} not found — skipping.`);
    return null;
  }
  const rows = parseCsv(readFileSync(full, "utf8"));
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

function applySafetyLexicon(): void {
  const review = readReview("safety-lexicon-review.csv");
  if (!review) return;

  const lexPath = path.join(ROOT, "data", "safety_lexicon.csv");
  const rows = parseCsv(readFileSync(lexPath, "utf8"));
  const header = rows[0];
  const idIdx = header.indexOf("id");
  const phraseIdx = header.indexOf("phrase");
  const reviewedIdx = header.indexOf("clinician_reviewed");

  const byId = new Map(review.map((r) => [r.id, r]));
  let approved = 0;
  let reworded = 0;
  const removed: string[] = [];
  const kept: string[][] = [header];

  for (const row of rows.slice(1)) {
    const verdict = (byId.get(row[idIdx])?.VERDICT_keep_remove_reword ?? "").toLowerCase();
    const replacement = byId.get(row[idIdx])?.SUGGESTED_REPLACEMENT ?? "";

    if (verdict.startsWith("remove")) {
      removed.push(`${row[idIdx]} "${row[phraseIdx]}"`);
      continue;
    }
    if (verdict.startsWith("reword") && replacement) {
      row[phraseIdx] = replacement;
      row[reviewedIdx] = "true";
      reworded += 1;
    } else if (verdict.startsWith("keep")) {
      row[reviewedIdx] = "true";
      approved += 1;
    }
    // No verdict -> untouched, and clinician_reviewed stays exactly as it was.
    kept.push(row);
  }

  const out = kept
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
  writeFileSync(lexPath, out + "\n", "utf8");

  console.log(`\nSafety lexicon:`);
  console.log(`  ${approved} approved, ${reworded} reworded, ${removed.length} removed`);
  for (const r of removed) console.log(`    removed: ${r}`);
  const unmarked = rows.length - 1 - approved - reworded - removed.length;
  if (unmarked > 0) {
    console.log(`  ⚠️  ${unmarked} rows carry NO verdict and remain clinician_reviewed=false.`);
    console.log(`      That is correct behaviour, not a bug. Do not flip them by hand.`);
  }
}

function applyKiswahili(): void {
  const review = readReview("kiswahili-review.csv");
  if (!review) return;

  const fixes = review.filter(
    (r) => (r.VERDICT_ok_or_fix ?? "").toLowerCase().startsWith("fix") && r.SUGGESTED_KISWAHILI,
  );

  console.log(`\nKiswahili review:`);
  console.log(`  ${review.length} strings reviewed, ${fixes.length} corrections supplied`);

  if (fixes.length === 0) return;

  // Applied by hand rather than by search-and-replace: lib/copy.ts is TypeScript with nested
  // structure, and a blind string substitution across it is how you silently corrupt a key.
  console.log(`\n  Apply these to lib/copy.ts (and data/probes/ for the item-9 probe):\n`);
  for (const f of fixes) {
    console.log(`  ${f.key}`);
    console.log(`    was:  ${f.current_kiswahili}`);
    console.log(`    now:  ${f.SUGGESTED_KISWAHILI}`);
    if (f.NOTES) console.log(`    note: ${f.NOTES}`);
    console.log();
  }
}

function main(): void {
  console.log("Applying completed reviews...");
  applySafetyLexicon();
  applyKiswahili();
  console.log("\nRe-run `npm test` — the lexicon tests report the new review ratio.");
}

main();

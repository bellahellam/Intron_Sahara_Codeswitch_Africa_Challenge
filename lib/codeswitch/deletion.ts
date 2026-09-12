/**
 * The deletion-signature detector (§11.5, FR-32). The clearest bridge between the benchmark and
 * the product: it converts "we found that models delete embedded English" into "and here is the
 * product behaviour that catches it in the field".
 *
 *     cps = transcript_chars / audio_seconds
 *     cps < FLOOR  →  deletion_suspected
 *
 * ⚠️ FLOOR MUST BE DERIVED, NOT GUESSED. §11.5 and §24.11 are explicit: compute `cps` on
 * AfriSwitchCare Swahili gold transcripts, take the 5th percentile, subtract a safety margin,
 * and record the derived value in the repo.
 *
 * `scripts/derive-deletion-floor.ts` writes `data/deletion_floor.json`. Until that has been run,
 * this module reports `derived: false` and the UI says the detector is uncalibrated rather than
 * silently using a made-up number. A fabricated threshold that happens to look plausible is
 * worse than an absent one, because it cannot be argued with.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface DeletionFloor {
  floor: number;
  derived: boolean;
  /** How it was obtained, verbatim, so a judge can check it. */
  provenance: string;
  percentile?: number;
  safetyMargin?: number;
  n?: number;
  derivedAt?: string;
}

const FLOOR_FILE = path.join(process.cwd(), "data", "deletion_floor.json");

/**
 * Placeholder used only while `derived` is false. It is deliberately conservative (it fires
 * rarely) so an uncalibrated detector cannot spam the CHP with amber strips, and every call
 * site must check `derived` before presenting the result as a benchmark-backed finding.
 */
const UNCALIBRATED_PLACEHOLDER = 6.0;

let cache: DeletionFloor | null = null;

export function getDeletionFloor(): DeletionFloor {
  if (cache) return cache;
  if (existsSync(FLOOR_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(FLOOR_FILE, "utf8")) as DeletionFloor;
      if (typeof parsed.floor === "number" && parsed.derived) {
        cache = parsed;
        return cache;
      }
    } catch {
      // fall through to uncalibrated
    }
  }
  cache = {
    floor: UNCALIBRATED_PLACEHOLDER,
    derived: false,
    provenance:
      "NOT DERIVED. Run `npm run derive:floor` against AfriSwitchCare Swahili gold transcripts. Until then the detector is uncalibrated and its output must not be presented as a benchmark finding.",
  };
  return cache;
}

export function charsPerSecond(transcript: string, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return transcript.trim().length / durationSeconds;
}

export interface DeletionCheck {
  cps: number;
  floor: number;
  deletionSuspected: boolean;
  /** False when the floor has not been derived from the benchmark set yet. */
  calibrated: boolean;
}

export function checkDeletion(transcript: string, durationSeconds: number): DeletionCheck {
  const { floor, derived } = getDeletionFloor();
  const cps = charsPerSecond(transcript, durationSeconds);

  // A turn too short to say anything about is not evidence of deletion. Below ~3 s the ratio is
  // dominated by onset and offset silence, and a false amber strip on a genuinely terse answer
  // costs the CHP's attention for nothing (§9.2 step 7).
  const measurable = durationSeconds >= 3;

  return {
    cps: Math.round(cps * 100) / 100,
    floor,
    deletionSuspected: measurable && cps < floor,
    calibrated: derived,
  };
}

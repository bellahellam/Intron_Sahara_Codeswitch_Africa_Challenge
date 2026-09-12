/**
 * Derive the deletion-signature detector's FLOOR from real data (§11.5, FR-32).
 *
 * NOT YET IMPLEMENTED. This file exists so that `npm run derive:floor` explains itself rather
 * than failing with a module-not-found error, and so the method is written down before anyone
 * is tempted to shortcut it.
 *
 * THE METHOD, which is not negotiable:
 *
 *   1. Load `intronhealth/AfriSwitchCare`, config "swahili", split "test" (gated on Hugging Face;
 *      HF_TOKEN must have access).
 *   2. For every GOLD transcript, compute cps = len(transcript.strip()) / audio_duration_seconds.
 *   3. Take the 5th percentile of that distribution.
 *   4. Subtract a safety margin.
 *   5. Write the value, the percentile, the margin, n, and the date to data/deletion_floor.json
 *      with `derived: true`.
 *
 * ⚠️ DO NOT HARDCODE A GUESS. §11.5 and §24.11 both say so explicitly. Until this runs,
 * lib/codeswitch/deletion.ts reports `derived: false`, the API returns `calibrated: false`, and
 * the UI tells the CHP the threshold has not been measured. A fabricated threshold that happens
 * to look plausible is worse than an absent one, because it cannot be argued with.
 *
 * WHY THIS IS NOT A TypeScript JOB: the datasets are Hugging Face `datasets` artifacts and the
 * audio durations come from the dataset's own metadata. It belongs in the Python benchmark
 * harness (`bench/`), alongside the code that already has to load these corpora. This stub will
 * be replaced by a thin wrapper that shells out to it.
 */
import "./env";

console.error(`
derive:floor is not implemented yet.

The deletion-detector FLOOR must be derived from AfriSwitchCare Swahili gold transcripts:
5th percentile of chars-per-second, minus a safety margin (build spec section 11.5).

It is not implemented because it belongs in the Python benchmark harness (bench/), which loads
those gated datasets. That harness is the next milestone.

Until then the detector runs UNCALIBRATED and says so everywhere it is surfaced:
  - lib/codeswitch/deletion.ts  -> derived: false
  - POST /api/turn              -> deletion.calibrated: false
  - the conversation screen     -> "kizingiti hakijapimwa bado"

Do not hardcode a value to silence this. See LIMITATIONS.md.
`);
process.exit(1);

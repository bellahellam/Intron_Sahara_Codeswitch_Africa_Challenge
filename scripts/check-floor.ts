/** Confirms the product reads the derived FLOOR rather than the uncalibrated placeholder. */
import "./env";
import { checkDeletion, getDeletionFloor } from "../lib/codeswitch/deletion";

const f = getDeletionFloor();
console.log("floor:", f.floor, "| derived:", f.derived, "| n:", f.n);
console.log("provenance:", f.provenance.slice(0, 100) + "...");

// Replay the live TTS turn: 82 chars over 11 s of audio.
const live = checkDeletion(
  "You kusipati Using guys, na mawazo mengi sana, niko in a stress laking sijui nini.",
  11,
);
console.log("live turn replay -> cps", live.cps, "| suspected:", live.deletionSuspected, "| calibrated:", live.calibrated);

// A healthy turn at the corpus median.
const healthy = checkDeletion("x".repeat(Math.round(8.94 * 30)), 30);
console.log("median-rate turn  -> cps", healthy.cps, "| suspected:", healthy.deletionSuspected);

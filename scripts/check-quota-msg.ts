/** Confirms the observed "insufficient balance" body maps to a NAMED quota error (FR-31). */
import { ASRError } from "../lib/asr/types";

// The exact body Sahara returned on 12 Sep 2026 when the balance ran out.
const body = '{"data":{},"message":"insufficient balance to process the file","status":"Error"}';
const upper = body.toUpperCase();
const isQuota =
  upper.includes("QUOTA_EXCEEDED") ||
  upper.includes("INSUFFICIENT_CREDIT") ||
  upper.includes("INSUFFICIENT BALANCE") ||
  upper.includes("INSUFFICIENT_BALANCE");
console.log("classified as quota:", isQuota);

const err = new ASRError("quota", body, { adapter: "sahara-v2.5-corr-off", status: 400 });
console.log("CHP sees (sw):", err.chpMessageSw);
console.log("CHP sees (en):", err.chpMessageEn);

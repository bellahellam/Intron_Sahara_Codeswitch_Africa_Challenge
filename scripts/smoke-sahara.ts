/**
 * Milestone 0 task 1: "Prove the key and the datasets, do not assume them."
 *
 * One real transcription call returning text from a real audio file. Run it before writing any
 * code that depends on Sahara behaving as documented.
 *
 *   npm run smoke:sahara -- path/to/audio.wav
 *
 * It prints the raw response shape on failure, which is how the transcript field name gets
 * confirmed rather than guessed (see extractText in lib/asr/sahara.ts).
 */
import "./env";
import { readFileSync, existsSync } from "node:fs";
import { SaharaAdapter } from "../lib/asr/sahara";
import { ASRError } from "../lib/asr/types";

async function main() {
  const file = process.argv[2];
  if (!file || !existsSync(file)) {
    console.error("Usage: npm run smoke:sahara -- <path-to-audio-file>");
    console.error("Any of WAV, MP3, MP4, M4A, OGG, WebM or FLAC is accepted by Sahara.");
    process.exit(1);
  }

  const buf = readFileSync(file);
  console.log(`file: ${file} (${(buf.length / 1024).toFixed(1)} KB)`);

  const adapter = new SaharaAdapter({ disableLlmCorrections: true });
  console.log(`adapter: ${adapter.name}`);
  console.log("calling /file/v1/upload/sync with use_language_asr_input=sw ...\n");

  try {
    const result = await adapter.transcribe(buf, { lang: "sw" });
    console.log("--- TRANSCRIPT ---");
    console.log(result.text);
    console.log("------------------");
    console.log(`latency: ${result.latencyMs} ms`);
    console.log(`chars/sec will be computed against the real duration in the product.`);
  } catch (err) {
    if (err instanceof ASRError) {
      console.error(`FAILED [${err.kind}]: ${err.message}`);
      console.error(`What the CHP would see: "${err.chpMessageEn}"`);
      process.exit(2);
    }
    throw err;
  }
}

main();

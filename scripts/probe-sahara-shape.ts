/**
 * One-off: dump Sahara's raw response so the transcript field name is CONFIRMED, not guessed.
 * Delete once lib/asr/sahara.ts extractText() is known-correct.
 */
import "./env";
import { readFileSync } from "node:fs";

async function main() {
  const file = process.argv[2];
  const buf = readFileSync(file);
  const form = new FormData();
  form.append("audio_file_name", "turn.wav");
  form.append("audio_file_blob", new Blob([new Uint8Array(buf)], { type: "audio/wav" }), "turn.wav");
  form.append("use_language_asr_input", "sw");
  form.append("use_disable_llm_corrections", "TRUE");

  const res = await fetch("https://infer.voice.intron.io/file/v1/upload/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SAHARA_API_KEY}` },
    body: form,
  });
  const text = await res.text();
  console.log("HTTP", res.status);
  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2).slice(0, 3000));
  } catch {
    console.log(text.slice(0, 3000));
  }
}

main();

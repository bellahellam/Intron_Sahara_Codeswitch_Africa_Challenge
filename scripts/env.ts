/**
 * Load .env then .env.local for standalone scripts.
 *
 * Next.js does this automatically; `tsx` does not. Without it a smoke test reports
 * "XAI_API_KEY is not set" at a user who has just set it, which is the most annoying
 * possible failure mode: the error is accurate about the process and wrong about the world.
 *
 * .env.local wins, matching Next.js's own precedence.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function load(file: string) {
  const full = path.join(process.cwd(), file);
  if (!existsSync(full)) return;
  for (const raw of readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value !== "") process.env[key] = value;
  }
}

load(".env");
load(".env.local"); // wins, as in Next.js

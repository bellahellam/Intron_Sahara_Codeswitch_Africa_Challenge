"use client";

import { useState } from "react";
import results from "@/data/benchmark_results.json";

const MODEL_LABEL: Record<string, string> = {
  "sahara-v2.5-corr-off": "Sahara v2.5 (shipped)",
  "elevenlabs-scribe-v2": "ElevenLabs Scribe v2",
  "jacaranda-asr-stt": "Jacaranda (regional)",
  "whisper-large-v3-auto": "Whisper v3 (auto)",
  "whisper-large-v3-sw": "Whisper v3 (sw forced)",
};

const SHIPPED = "sahara-v2.5-corr-off";

const PROS_CONS: Record<string, { pros: string; cons: string }> = {
  "elevenlabs-scribe-v2": {
    pros: "Best WER (17.1%) and CER (7.5%). Strong English span retention (EESR 89.1%). Low latency. Handles code-switching without language forcing.",
    cons: "EESR-clinical (80%) lower than Whisper auto despite better WER — some affective terms transcribed in paraphrase rather than verbatim. Cloud-only; data leaves the device (consent implications). Cost at scale.",
  },
  "sahara-v2.5-corr-off": {
    pros: "Lowest latency of all API models (p95 7.4 s/chunk). Competitive WER for an African-language model. No switch-boundary catastrophe. Deterministic transcript — every score is justified by a verbatim quote read back to the patient.",
    cons: "EESR-clinical 73.3% — lowest among models with a score. Corrections OFF is deliberate but means any transcription errors are not smoothed.",
  },
  "whisper-large-v3-auto": {
    pros: "Best EESR-clinical (93.3%) — preserves affective English spans better than any other model. Best CMI-Δ (3.37), meaning it flattens code-switching structure the least. No API cost.",
    cons: "Higher WER (33.2%). p95 latency 42.9 s/chunk on CPU — not viable for real-time use without a GPU.",
  },
  "whisper-large-v3-sw": {
    pros: "Lower aggregate WER than auto-detect (28.9%). Faster than auto-detect.",
    cons: "Critical finding: forcing language=\"sw\" deletes all embedded English. EESR-clinical is unmeasurable — zero affective spans survived across all 12 conversations. CMI-Δ 10.32 confirms switching structure is flattened. Lower WER while losing all clinical content is the exact failure mode this benchmark was built to catch. Unsafe for this use case.",
  },
  "jacaranda-asr-stt": {
    pros: "Regional incumbent fine-tuned on Swahili+English. No API cost. Meaningful baseline — Sahara must beat this or the finding is negative.",
    cons: "Worst on every metric: WER 56.5%, EESR 35.5%, EESR-clinical 20.0%. Loses the majority of embedded English and scores near-zero on affective terms for most conversations.",
  },
};

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`);

type Row = {
  model: string; wer: number; cer: number; eesr: number;
  eesr_clinical: number | null; cmi_delta: number; latency_ms_p95_per_chunk: number;
};

export function FullReportModal() {
  const [open, setOpen] = useState(false);
  const table1 = results.table1 as Row[];

  return (
    <>
      <p className="text-xs text-neutral-500">
        For the full report —{" "}
        <button
          onClick={() => setOpen(true)}
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          published baselines, excluded models, and method notes
        </button>
      </p>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl my-8">
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="space-y-5 px-5 pb-8 pt-5">
              <h2 className="pr-8 text-base font-semibold text-neutral-900">
                Full benchmark report
              </h2>

              {/* ── Results table ── */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">Results</h3>
                <p className="text-xs text-neutral-500">12 conversations · 1.54 h · Kiswahili-English code-switched · AfriSwitchCare Swahili</p>
                <div className="overflow-x-auto rounded-md border border-neutral-100">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 text-left text-neutral-500">
                      <tr>
                        <th className="py-2 pl-3 pr-2">Model</th>
                        <th className="pr-2 text-right">WER ↓</th>
                        <th className="pr-2 text-right">CER ↓</th>
                        <th className="pr-2 text-right">EESR ↑</th>
                        <th className="pr-2 text-right">EESR-cl ↑</th>
                        <th className="pr-2 text-right">CMI-Δ ↓</th>
                        <th className="pr-3 text-right">p95/chunk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table1.map((r) => (
                        <tr
                          key={r.model}
                          className={`border-t border-neutral-100 ${r.model === SHIPPED ? "bg-primary/5 font-medium" : ""}`}
                        >
                          <td className="py-1.5 pl-3 pr-2 text-neutral-900">
                            {MODEL_LABEL[r.model] ?? r.model}
                            {r.model === SHIPPED && (
                              <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">shipped</span>
                            )}
                          </td>
                          <td className="pr-2 text-right">{pct(r.wer)}</td>
                          <td className="pr-2 text-right">{pct(r.cer)}</td>
                          <td className="pr-2 text-right">{pct(r.eesr)}</td>
                          <td className={`pr-2 text-right ${r.eesr_clinical === null ? "italic text-neutral-400" : ""}`}>
                            {pct(r.eesr_clinical)}
                          </td>
                          <td className="pr-2 text-right">{r.cmi_delta.toFixed(2)}</td>
                          <td className="pr-3 text-right">{ms(r.latency_ms_p95_per_chunk)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-0.5 text-xs text-neutral-500">
                  <p><strong>EESR-cl —</strong> blank (Whisper sw-forced) means the model deleted all embedded English — zero affective spans survived.</p>
                  <p><strong>CMI-Δ —</strong> how much the model flattens code-switching structure. Lower preserves it better.</p>
                </div>
              </section>

              {/* ── Pros / Cons per model ── */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-900">Strengths &amp; weaknesses per model</h3>
                {table1.map((r) => {
                  const pc = PROS_CONS[r.model];
                  if (!pc) return null;
                  return (
                    <div key={r.model} className="rounded-md border border-neutral-100 px-3 py-2 text-xs">
                      <p className="mb-1 font-medium text-neutral-900">
                        {MODEL_LABEL[r.model] ?? r.model}
                        {r.model === SHIPPED && (
                          <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">shipped</span>
                        )}
                      </p>
                      <p className="text-neutral-700"><span className="font-medium text-green-700">Strengths:</span> {pc.pros}</p>
                      <p className="mt-1 text-neutral-700"><span className={`font-medium ${r.model === "whisper-large-v3-sw" ? "text-red-700" : "text-orange-700"}`}>Weaknesses:</span> {pc.cons}</p>
                    </div>
                  );
                })}
              </section>

              {/* ── Published baselines ── */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">Published baselines</h3>
                <p className="text-xs text-neutral-600">Context so a bad number reads as a finding, not a panic.</p>
                <ul className="space-y-2">
                  {results.baselines.map((b) => (
                    <li key={b.source} className="border-l-2 border-neutral-200 pl-3 text-xs text-neutral-700">
                      <span className="block font-medium text-neutral-900">{b.result}</span>
                      <span className="block text-neutral-600">{b.source}</span>
                      {b.note && <span className="mt-0.5 block italic text-neutral-500">{b.note}</span>}
                    </li>
                  ))}
                </ul>
              </section>

              {/* ── Models not benchmarked ── */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">Models not benchmarked</h3>
                <ul className="space-y-2">
                  {results.table5_not_benchmarked.map((m) => (
                    <li key={m.model} className="border-l-2 border-neutral-200 pl-3 text-xs text-neutral-700">
                      <span className="block font-medium text-neutral-900">{m.model}</span>
                      <span className="block text-neutral-600">{m.reason}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* ── Method notes ── */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">Method notes</h3>
                <ul className="space-y-1 text-xs text-neutral-700 list-disc pl-4">
                  <li>Sahara runs with LLM corrections <strong>OFF</strong> — the shipped configuration and primary column. Corrections ON is reported separately; most teams benchmark the API default without realising it includes an undisclosed post-processor.</li>
                  <li>Chunking: fixed 75 s windows, 1 s overlap, computed once and shared byte-identically across all models.</li>
                  <li>A failed chunk is recorded as a failure, never as an empty transcript. An empty string scores as perfect deletion and flatters the model.</li>
                  <li>WER/CER use Intron's normalisation (diacritics removed). EESR/CIR/SPR use diacritic-preserving normalisation.</li>
                  <li>Tier 3 (band-flip) is absent by design — degenerate on AfriSwitchCare by construction.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * S10 Kwa nini Sahara? (Why Sahara?) — §15.4, FR-29, M16.
 *
 * Purpose: put the benchmark INSIDE the product, not only in a PDF. Aimed at a judge, so it's in
 * English, unlike every other screen, and it explains its own method.
 *
 * ⚠️ Renders from a committed file, not from live benchmark output (§24.11). While that file was
 * a placeholder this screen said the benchmark had not been run rather than showing invented
 * numbers — a fabricated results table would be the fastest way to lose this competition on
 * Ethics. It now has real numbers; the same rule still applies to anything not yet run.
 */

import Link from "next/link";
import { Header } from "@/components/ui";
import { BarList } from "@/components/charts";
import results from "@/data/benchmark_results.json";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Kwa nini Sahara? — MAMA-SAUTI" };

const MODEL_LABEL: Record<string, string> = {
  "sahara-v2.5-corr-off": "Sahara v2.5 (shipped)",
  "elevenlabs-scribe-v2": "ElevenLabs Scribe v2",
  "jacaranda-asr-stt": "Jacaranda (regional incumbent)",
  "whisper-large-v3-auto": "Whisper large-v3 (auto-detect)",
  "whisper-large-v3-sw": "Whisper large-v3 (sw forced)",
};

const SHIPPED_MODEL = "sahara-v2.5-corr-off";
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default async function WhySahara() {
  await requireAdmin();
  const table1 = results.table1 as Array<{
    model: string; wer: number; cer: number; eesr: number;
    eesr_clinical: number | null; eesr_clinical_total: number;
    cir: number | null; cir_total: number; spr: number | null; spr_total: number;
    cmi_delta: number; latency_ms_p95_per_chunk: number; n: number;
  }>;
  const hasResults = table1.length > 0;

  return (
    <main className="flex min-h-screen flex-col pb-10">
      <Header title="Kwa nini Sahara?" back="/" />

      <div className="space-y-6 px-4">
        <section className="space-y-1.5">
          <h2 className="text-base font-semibold text-neutral-900">What this asks</h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Not which model has the lowest WER — whether ASR quality on code-switched Swahili{" "}
            <strong>changes the clinical decision this product makes</strong>. The dominant failure
            here is switch-boundary deletion: a model returns fluent Swahili with the embedded
            English simply gone, and that English carries the affective vocabulary (&ldquo;stress&rdquo;,
            &ldquo;I can&apos;t cope&rdquo;). So alongside WER/CER we compute <strong>EESR</strong>
            (did each gold English span survive?) and <strong>EESR-clinical</strong>, the same
            metric restricted to spans an affective term actually shows up in — the subset that
            determines whether the product works.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-900">Results</h2>
          {!hasResults ? (
            <div className="rounded-md border-2 border-warning bg-white px-3 py-3 text-sm">
              <p className="font-medium text-warning">! The benchmark has not been run yet.</p>
              <p className="mt-1 text-neutral-700">
                This page renders from <code className="text-xs">data/benchmark_results.json</code>,
                still a placeholder. No numbers are shown because we don&apos;t have any — a
                plausible-looking table here would be worse than an empty one.
              </p>
            </div>
          ) : (
            <>
              <div className="card space-y-1">
                <p className="text-label m-0">Word error rate <span className="normal-case text-neutral-400">— lower is better</span></p>
                <BarList
                  format={pct}
                  items={table1
                    .slice()
                    .sort((a, b) => a.wer - b.wer)
                    .map((r) => ({ label: MODEL_LABEL[r.model] ?? r.model, value: r.wer, highlight: r.model === SHIPPED_MODEL }))}
                />
              </div>

              <div className="card space-y-1">
                <p className="text-label m-0">
                  EESR-clinical <span className="normal-case text-neutral-400">— higher is better, embedded-English survival on affective spans</span>
                </p>
                <BarList
                  format={(v) => (v < 0 ? "n/a" : pct(v))}
                  items={table1
                    .filter((r) => r.eesr_clinical !== null)
                    .slice()
                    .sort((a, b) => (b.eesr_clinical ?? 0) - (a.eesr_clinical ?? 0))
                    .map((r) => ({ label: MODEL_LABEL[r.model] ?? r.model, value: r.eesr_clinical ?? 0, highlight: r.model === SHIPPED_MODEL }))}
                />
                {table1.some((r) => r.eesr_clinical === null) && (
                  <p className="pt-1 text-xs italic text-neutral-400">
                    {table1.filter((r) => r.eesr_clinical === null).map((r) => MODEL_LABEL[r.model] ?? r.model).join(", ")}: incomplete
                    run (n={table1.find((r) => r.eesr_clinical === null)?.n}), not shown.
                  </p>
                )}
              </div>

              <div className="overflow-x-auto rounded-md border border-neutral-100">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 text-left text-neutral-500">
                    <tr>
                      <th className="py-2 pl-3 pr-2">Model</th>
                      <th className="pr-2">WER</th>
                      <th className="pr-2">CER</th>
                      <th className="pr-2">EESR</th>
                      <th className="pr-2">CMI-Δ</th>
                      <th className="pr-2">p95 ms/chunk</th>
                      <th className="pr-3">n</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {table1.map((r) => (
                      <tr key={r.model} className={`border-t border-neutral-100 ${r.model === SHIPPED_MODEL ? "bg-primary/5" : ""}`}>
                        <td className="py-1.5 pl-3 pr-2 font-medium text-neutral-900">{MODEL_LABEL[r.model] ?? r.model}</td>
                        <td className="pr-2">{pct(r.wer)}</td>
                        <td className="pr-2">{pct(r.cer)}</td>
                        <td className="pr-2">{pct(r.eesr)}</td>
                        <td className="pr-2">{r.cmi_delta.toFixed(2)}</td>
                        <td className="pr-2">{r.latency_ms_p95_per_chunk.toLocaleString()}</td>
                        <td className="pr-3">{r.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs italic text-neutral-500">
                CMI-Δ: how much the model flattens code-switching structure (lower = preserves it
                better). {results._status}
              </p>
            </>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-neutral-900">Published baselines</h2>
          <p className="text-sm text-neutral-700">So a bad number reads as a finding, not a panic.</p>
          <ul className="space-y-2 text-sm text-neutral-700">
            {results.baselines.map((b) => (
              <li key={b.source} className="border-l-2 border-neutral-200 pl-3">
                <span className="block font-medium text-neutral-900">{b.result}</span>
                <span className="block">{b.source}</span>
                {b.note && <span className="mt-1 block italic text-neutral-500">{b.note}</span>}
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-neutral-400">
          Excluded models, licensing notes, and full method (chunking, normalisation, why Tier 3
          isn&apos;t reported here) are in <code className="text-xs">report/BENCHMARK.md</code>.
        </p>

        <Link href="/" className="btn-quiet flex items-center justify-center">
          Rudi nyumbani
        </Link>
      </div>
    </main>
  );
}

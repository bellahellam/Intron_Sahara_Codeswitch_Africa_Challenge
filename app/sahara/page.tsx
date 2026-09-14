/**
 * S10 Kwa nini Sahara? (Why Sahara?) — §15.4, FR-29, M16.
 * Renders from data/benchmark_results.json — real numbers only, never placeholder.
 */

import Link from "next/link";
import { Header } from "@/components/ui";
import results from "@/data/benchmark_results.json";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Kwa nini Sahara? — MAMA-SAUTI" };

const MODEL_LABEL: Record<string, string> = {
  "sahara-v2.5-corr-off": "Sahara v2.5 (shipped)",
  "elevenlabs-scribe-v2": "ElevenLabs Scribe v2",
  "jacaranda-asr-stt": "Jacaranda (regional)",
  "whisper-large-v3-auto": "Whisper v3 (auto)",
  "whisper-large-v3-sw": "Whisper v3 (sw forced)",
};

const SHIPPED_MODEL = "sahara-v2.5-corr-off";
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const ms = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`;

type Row = {
  model: string; wer: number; cer: number; eesr: number;
  eesr_clinical: number | null; eesr_clinical_total: number;
  cir: number | null; cir_total: number;
  cmi_delta: number; latency_ms_p95_per_chunk: number; n: number;
};

export default async function WhySahara() {
  await requireAdmin();
  const table1 = results.table1 as Row[];
  const hasResults = table1.length > 0;

  return (
    <main className="flex min-h-screen flex-col pb-10">
      <Header title="Kwa nini Sahara?" back="/" />

      <div className="space-y-6 px-4">

        {/* ---- What we measured ---- */}
        <section className="space-y-1.5">
          <h2 className="text-base font-semibold text-neutral-900">What this benchmark asks</h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Not "which model has the lowest WER" — whether ASR quality on code-switched Swahili{" "}
            <strong>changes the clinical decision this product makes</strong>.
          </p>
          <p className="text-sm leading-relaxed text-neutral-700">
            The dominant failure is <strong>switch-boundary deletion</strong>: the model returns
            fluent Swahili with the embedded English gone. That English carries the affective
            vocabulary — "stress", "depressed", "I can't cope". WER cannot see this failure
            because losing a filler word and losing the only clinical content score identically.
          </p>
          <p className="text-sm leading-relaxed text-neutral-700">
            <strong>EESR</strong> asks whether each gold English span survived.{" "}
            <strong>EESR-clinical</strong> restricts that to spans containing an affective term
            — the subset that determines whether the product works.
            A model where EESR looks fine but EESR-clinical collapses is unsafe for this use case.
          </p>
        </section>

        {/* ---- Results table ---- */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-900">Results</h2>
          {!hasResults ? (
            <div className="rounded-md border-2 border-warning bg-white px-3 py-3 text-sm">
              <p className="font-medium text-warning">Benchmark has not been run yet.</p>
            </div>
          ) : (
            <>
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
                  <tbody className="tabular">
                    {table1.map((r) => (
                      <tr
                        key={r.model}
                        className={`border-t border-neutral-100 ${r.model === SHIPPED_MODEL ? "bg-primary/5 font-medium" : ""}`}
                      >
                        <td className="py-1.5 pl-3 pr-2 text-neutral-900">
                          {MODEL_LABEL[r.model] ?? r.model}
                          {r.model === SHIPPED_MODEL && (
                            <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">shipped</span>
                          )}
                        </td>
                        <td className="pr-2 text-right">{pct(r.wer)}</td>
                        <td className="pr-2 text-right">{pct(r.cer)}</td>
                        <td className="pr-2 text-right">{pct(r.eesr)}</td>
                        <td className={`pr-2 text-right ${r.eesr_clinical === null ? "text-neutral-400 italic" : ""}`}>
                          {r.eesr_clinical === null ? "—" : pct(r.eesr_clinical)}
                        </td>
                        <td className="pr-2 text-right">{r.cmi_delta.toFixed(2)}</td>
                        <td className="pr-3 text-right">{ms(r.latency_ms_p95_per_chunk)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                <p><strong>EESR-cl —</strong> when this is blank (Whisper sw-forced), the model deleted all embedded English — zero clinical spans survived to score.</p>
                <p><strong>CMI-Δ —</strong> how much the model flattens code-switching structure. Lower preserves it better.</p>
                <p>12 conversations, 1.54 h, AfriSwitchCare Swahili. Sahara runs with LLM corrections off — that is the shipped configuration.</p>
              </div>
            </>
          )}
        </section>

        <p className="text-xs text-neutral-400">
          Published baselines, excluded models, and full method are in{" "}
          <code className="text-xs">report/BENCHMARK.md</code>.
        </p>

        <Link href="/" className="btn-quiet flex items-center justify-center">
          Rudi nyumbani
        </Link>
      </div>
    </main>
  );
}

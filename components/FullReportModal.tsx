"use client";

import { useState } from "react";
import results from "@/data/benchmark_results.json";

export function FullReportModal() {
  const [open, setOpen] = useState(false);

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

              {/* Published baselines */}
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

              {/* Models not benchmarked */}
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

              {/* Method notes */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">Method notes</h3>
                <ul className="space-y-1 text-xs text-neutral-700 list-disc pl-4">
                  <li>Sahara runs with LLM corrections <strong>OFF</strong> — that is the shipped configuration and the primary benchmark column. Corrections ON is reported separately; most teams benchmark the API default without realising it includes an undisclosed post-processor.</li>
                  <li>Chunking is fixed 75 s windows with 1 s overlap, computed once and shared byte-identically across all models. A per-model segmentation would void the comparison.</li>
                  <li>A failed chunk is recorded as a failure, never as an empty transcript. An empty string scores as perfect deletion and flatters the model.</li>
                  <li>WER/CER use Intron's normalisation (diacritics removed) for comparability. EESR/CIR/SPR use a diacritic-preserving normalisation, because diacritic stripping collapses lexicon-matching distinctions.</li>
                  <li>Tier 3 (band-flip, |ΔPHQ-9|) is absent by design — degenerate on AfriSwitchCare by construction (11/12 conversations are non-psychiatric with PHQ-9 near zero).</li>
                  <li>EESR and EESR-clinical are net-new metrics absent from Intron's own benchmarking repo, which computes no CMI, no switch-point metric, and no per-word LID.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

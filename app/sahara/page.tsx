/**
 * S10 Kwa nini Sahara? (Why Sahara?) — §15.4, FR-29, M16.
 *
 * Purpose: put the benchmark INSIDE the product, not only in a PDF.
 *
 * This screen is aimed at a judge, and §15.4 says it "should be visibly aimed at a judge rather
 * than pretending otherwise" — so it is in English, unlike every other screen, and it explains
 * its own method.
 *
 * ⚠️ It renders from a committed file, not from live benchmark output (§24.11: "a judge cannot
 * tell the difference, and the wiring competes directly with M5's polish box"). While that file
 * is a placeholder, this screen SAYS the benchmark has not been run rather than showing plausible
 * invented numbers. A fabricated results table would be the single fastest way to lose this
 * competition on Ethics.
 */

import Link from "next/link";
import { Header } from "@/components/ui";
import results from "@/data/benchmark_results.json";

export const metadata = { title: "Kwa nini Sahara? — MAMA-SAUTI" };

export default function WhySahara() {
  const hasResults = Array.isArray(results.table1) && results.table1.length > 0;

  return (
    <main className="flex min-h-screen flex-col pb-10">
      <Header title="Kwa nini Sahara?" back="/" />

      <div className="space-y-6 px-4">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-neutral-900">What this benchmark asks</h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Not &ldquo;which model has the lowest WER.&rdquo; The question is whether ASR quality on
            code-switched Swahili <strong>changes the clinical decision this product makes</strong>.
            If two models differ by 8 WER points but produce the same PHQ-9 band on every case, the
            WER difference is not a product fact. If two models differ by 2 points and one flips the
            band on a fifth of cases, that is the headline.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-neutral-900">Why WER alone is misleading here</h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            The dominant failure on code-switched speech is <strong>switch-boundary deletion</strong>:
            the model returns fluent monolingual Swahili with the embedded English simply gone. In
            this setting that English carries the <em>affective</em> vocabulary — &ldquo;stress&rdquo;,
            &ldquo;depressed&rdquo;, &ldquo;I can&apos;t cope&rdquo;. Aggregate WER cannot see the
            difference between losing a filler word and losing the only clinical content in the
            sentence.
          </p>
          <p className="text-sm leading-relaxed text-neutral-700">
            So we compute <strong>EESR</strong> (Embedded-English Span Recall): for each gold English
            span, is its token sequence still present in the hypothesis? And{" "}
            <strong>EESR-clinical</strong>, the same metric restricted to spans containing an
            affective term. The general number can look fine while the clinical subset collapses.
            That subset is what determines whether the product works.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-neutral-900">Results</h2>
          {hasResults ? (
            <p className="text-sm text-neutral-700">See the table below.</p>
          ) : (
            <div className="rounded-md border-2 border-warning bg-white px-3 py-3 text-sm">
              <p className="font-medium text-warning">! The benchmark has not been run yet.</p>
              <p className="mt-1 text-neutral-700">
                This page renders from <code className="text-xs">data/benchmark_results.json</code>,
                which is still a placeholder. No numbers are shown because we do not have any.
                Publishing a plausible-looking table here before the run would be worse than an
                empty one.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-neutral-900">
            Published baselines, so a bad number is a finding rather than a panic
          </h2>
          <ul className="space-y-2 text-sm text-neutral-700">
            {results.baselines.map((b) => (
              <li key={b.source} className="border-l-2 border-neutral-200 pl-3">
                <span className="block font-medium text-neutral-900">{b.result}</span>
                <span className="block">{b.source}</span>
                {b.note && <span className="mt-1 block italic text-neutral-500">{b.note}</span>}
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed text-neutral-700">
            The gap between <strong>0.068</strong> on monolingual accented clinical Swahili and{" "}
            <strong>0.34</strong> on genuinely code-switched speech is the entire story of this
            competition. Monolingual Swahili is close to solved. Code-switched Swahili is not.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-neutral-900">Models we did not benchmark, and why</h2>
          <ul className="space-y-3 text-sm text-neutral-700">
            {results.table5_not_benchmarked.map((row) => (
              <li key={row.model}>
                <span className="block font-medium text-neutral-900">{row.model}</span>
                <span className="block">{row.reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed text-neutral-500">
            Two of those are Terms of Service exclusions. A team that publishes Deepgram numbers has
            either not read the terms or has decided not to care. We read them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-neutral-900">Method notes we are obliged to state</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-700">
            <li>
              The product ships with Sahara&apos;s LLM corrections <strong>OFF</strong>, and that is
              the primary benchmark column. Corrections ON is reported separately, because most
              teams will benchmark the API default and not notice they are measuring an ASR model
              plus an undisclosed post-processor.
            </li>
            <li>
              Band-flip is computed on the first-party field set only. On AfriSwitchCare it would be
              degenerate by construction: 12 conversations across 12 conditions, one of which is
              depression, so eleven gold PHQ-9 totals sit near zero and the band cannot move.
            </li>
            <li>
              WER is reported under Intron&apos;s own normalisation for comparability. EESR, CIR and
              SPR are computed under a <strong>diacritic-preserving</strong> normalisation, because
              their pipeline strips diacritics and that collapses distinctions our lexicon matching
              relies on.
            </li>
            <li>
              Intron&apos;s benchmarking repo is not a code-switching harness — it computes no CMI,
              no switch-point metric and no per-word LID. Our Tier-2 metrics are net-new.
            </li>
          </ul>
        </section>

        <Link href="/" className="btn-quiet flex items-center justify-center">
          Rudi nyumbani
        </Link>
      </div>
    </main>
  );
}

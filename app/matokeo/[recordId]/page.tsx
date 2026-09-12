"use client";

/**
 * S7 Matokeo (Result & referral) — §15.4.
 *
 * Tell Grace what happened and what happens next.
 *
 * Band in WORDS, never a bare number first (§16.5). Both disclaimers verbatim. The second one —
 * that the instrument has not been criterion-validated in Kiswahili — is unusual to put on a
 * result screen, and it is there because Larsen 2023 shows instrument choice moves measured
 * prevalence fourfold in the same Kenyan women. Saying so here is the honest thing and the
 * impressive thing.
 */

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { COPY } from "@/lib/copy";
import { BandChip, DisclaimerStrip, Header, PrimaryButton } from "@/components/ui";
import { GAD7_BAND_LABELS_SW, PHQ9_BAND_LABELS_SW, type Gad7Band, type Phq9Band } from "@/lib/clinical/score";
import { TIER_LABELS_SW, type ReferralTier } from "@/lib/clinical/route";

interface RecordData {
  scores: {
    phq2: number;
    phq9: number;
    gad2: number;
    gad7: number;
    phq9Band: Phq9Band;
    gad7Band: Gad7Band;
    coverage: { phq9ItemsEvidenced: number; gad7ItemsEvidenced: number };
  };
  referral: { tier: ReferralTier; reason: string; reasonSw: string; incomplete: boolean };
  risk: { flagged: boolean };
  disclaimers: string[];
}

export default function Result({ params }: { params: Promise<{ recordId: string }> }) {
  // Next 16 delivers route params as a Promise; `use` unwraps it in a client component.
  const { recordId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<RecordData | null>(null);

  useEffect(() => {
    fetch(`/api/record/${recordId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [recordId]);

  if (!data) {
    return (
      <main className="flex min-h-full flex-col">
        <Header title="Matokeo" />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto h-9 w-9 animate-pulse rounded-full border-4 border-primary/15 border-t-primary" aria-hidden />
            <p className="text-neutral-500">Inapakia...</p>
          </div>
        </div>
      </main>
    );
  }

  const { scores, referral } = data;

  const tierConfig: Record<string, { color: string; bg: string; bar: string }> = {
    facility_urgent:  { color: "text-danger",  bg: "border-danger/30 bg-danger/5", bar: "bg-danger"  },
    facility_routine: { color: "text-warning", bg: "border-warning/30 bg-warning/5", bar: "bg-warning" },
    chp_followup:     { color: "text-primary", bg: "border-primary/30 bg-primary/5", bar: "bg-primary" },
  };
  const tier = tierConfig[referral.tier] ?? tierConfig.chp_followup;

  return (
    <main className="flex min-h-full flex-col pb-8">
      <Header title="Matokeo" />

      <div className="flex-1 space-y-4 px-4 pt-2">
        {data.risk.flagged && (
          <div className="flex items-start gap-3 rounded-xl border-2 border-danger/40
                          bg-danger/5 p-4">
            <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden>
              <path d="M10 3l7 13H3L10 3zM10 7v4m0 2v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="font-bold text-danger">Alama ya hatari ilitolewa katika kikao hiki.</p>
              <p className="text-xs text-neutral-500 mt-0.5 italic">
                A safety escalation occurred. This cannot be lowered by any later edit.
              </p>
            </div>
          </div>
        )}

        {/* Scores */}
        <section className="card space-y-3">
          <p className="section-label">Matokeo ya uchunguzi</p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "PHQ-9", band: PHQ9_BAND_LABELS_SW[scores.phq9Band], total: scores.phq9 },
              { label: "GAD-7", band: GAD7_BAND_LABELS_SW[scores.gad7Band], total: scores.gad7 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-neutral-50 border border-neutral-100 p-3">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{s.label}</p>
                <p className="mt-1 text-lg font-bold text-neutral-900">{s.band}</p>
                <p className="tabular text-sm text-neutral-500">({s.total})</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-2.5">
            <p className="tabular text-sm text-neutral-600">
              PHQ-2 <strong>{scores.phq2}</strong> · GAD-2 <strong>{scores.gad2}</strong>
              <span className="text-neutral-400"> · kizingiti 3</span>
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {scores.coverage.phq9ItemsEvidenced}/9 PHQ-9 · {scores.coverage.gad7ItemsEvidenced}/7 GAD-7 evidenced
            </p>
          </div>

          {referral.incomplete && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
              <span aria-hidden>!</span>
              Uchunguzi haukukamilika.
              <span className="gloss not-italic font-normal ml-1">Screen not completed.</span>
            </p>
          )}
        </section>

        {/* Referral */}
        <section className={`card space-y-2 border ${tier.bg}`}>
          <div className="flex items-center gap-3">
            <span className={`h-9 w-1 rounded-full ${tier.bar}`} aria-hidden />
            <div>
              <p className="section-label">Rufaa</p>
              <p className={`text-lg font-bold ${tier.color}`}>
                {TIER_LABELS_SW[referral.tier]}
              </p>
            </div>
          </div>
          <p className="text-sm text-neutral-700">{referral.reasonSw}</p>
          <p className="text-xs italic text-neutral-400">{referral.reason}</p>
        </section>

        <DisclaimerStrip withValidation />
      </div>

      <div className="px-4 pt-4">
        <PrimaryButton onClick={() => router.push(`/rufaa/${recordId}`)}>
          <span className="flex items-center justify-center gap-2">
            {COPY.buttons.sendReferral.sw}
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </PrimaryButton>
      </div>
    </main>
  );
}

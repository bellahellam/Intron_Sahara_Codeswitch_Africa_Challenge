"use client";

/**
 * S7 Matokeo (Result & referral) — §15.4.
 *
 * Risk level leads, scores follow (§16.5's "band in words, never a bare number first" applied one
 * level up): the tier is what Grace acts on, so it is the first thing on the screen, not the last.
 * `Tuma rufaa` only appears for a tier that actually needs a facility referral — showing it
 * unconditionally would let her send a referral a CHP-followup screen never asked for.
 *
 * Both disclaimers verbatim. The second one — that the instrument has not been criterion-validated
 * in Kiswahili — is unusual to put on a result screen, and it is there because Larsen 2023 shows
 * instrument choice moves measured prevalence fourfold in the same Kenyan women. Saying so here is
 * the honest thing and the impressive thing.
 */

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { COPY } from "@/lib/copy";
import { DisclaimerStrip, Header, PrimaryButton } from "@/components/ui";
import { StepIndicator } from "@/components/StepIndicator";
import { GAD7_BAND_LABELS_SW, PHQ9_BAND_LABELS_SW, type Gad7Band, type Phq9Band } from "@/lib/clinical/score";
import { TIER_LABELS_SW, type ReferralTier } from "@/lib/clinical/route";

interface RecordData {
  createdAt: string;
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

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

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
  const needsReferral = referral.tier !== "chp_followup";

  const tierConfig: Record<string, { color: string; bg: string; bar: string; cardBg: string; cardBorder: string }> = {
    facility_urgent:  { color: "text-danger",  bg: "border-danger/30 bg-danger/5",   bar: "bg-danger",  cardBg: "bg-danger/5",   cardBorder: "border-danger/40" },
    facility_routine: { color: "text-warning", bg: "border-warning/30 bg-warning/5", bar: "bg-warning", cardBg: "bg-warning/5",  cardBorder: "border-warning/40" },
    // A CHP-followup tier is the reassuring outcome: no facility referral today. Green, matching
    // how the rest of the product signals "nothing further required" (e.g. the completed banner).
    chp_followup:     { color: "text-success", bg: "border-success/30 bg-success/5", bar: "bg-success", cardBg: "bg-success/5", cardBorder: "border-success/40" },
  };
  const tier = tierConfig[referral.tier] ?? tierConfig.chp_followup;

  const followUpDate = new Date(new Date(data.createdAt).getTime() + FOURTEEN_DAYS_MS)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <main className="flex min-h-full flex-col pb-8">
      <Header title="Matokeo" />
      <StepIndicator current={2} skipStep3={!needsReferral} />

      <div className="flex-1 space-y-4 px-4 pt-4">
        {/* Risk level leads. */}
        <section className={`card space-y-1 border-2 ${tier.cardBg} ${tier.cardBorder}`}>
          <p className={`section-label ${tier.color}`}>Kiwango cha hatari</p>
          <p className={`text-2xl font-bold tracking-tight ${tier.color}`}>
            {TIER_LABELS_SW[referral.tier]}
          </p>
          <p className="text-sm text-neutral-700">{referral.reasonSw}</p>
          <p className="gloss">{referral.reason}</p>

          {/* Says what's true and checkable — nothing to send today — without claiming "no
              risk": a negative screen on an unvalidated instrument is not evidence of absence
              (route.ts's own reasoning). This is the line that answers "am I done here?" */}
          {!needsReferral && (
            <p className="mt-1 text-sm font-semibold text-success">{COPY.noReferralToday.sw}</p>
          )}

          {data.risk.flagged && (
            <p className="mt-1 flex items-start gap-2 text-xs font-medium text-danger">
              <span aria-hidden>!</span>
              Alama ya hatari ilitolewa katika kikao hiki.
              <span className="gloss not-italic font-normal">
                A safety escalation occurred. This cannot be lowered by any later edit.
              </span>
            </p>
          )}
        </section>

        {/* Scores */}
        <section className="card space-y-3">
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

        {/* CHP-followup: nothing to send today, but she still gets a date and a way home. */}
        {!needsReferral && (
          <section className="card flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">{COPY.followUpVisit.sw}</p>
              <p className="gloss">{COPY.followUpVisit.en}</p>
            </div>
            <span className="tabular text-sm font-bold text-primary">{followUpDate}</span>
          </section>
        )}

        <DisclaimerStrip withValidation />
      </div>

      <div className="space-y-2 px-4 pt-4">
        {needsReferral ? (
          <PrimaryButton onClick={() => router.push(`/rufaa/${recordId}`)}>
            <span className="flex items-center justify-center gap-2">
              {COPY.buttons.sendReferral.sw}
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </PrimaryButton>
        ) : (
          <>
            <PrimaryButton onClick={() => router.push("/")}>{COPY.buttons.home.sw}</PrimaryButton>
            <button type="button" onClick={() => router.push(`/rufaa/${recordId}`)} className="btn-quiet w-full">
              {COPY.buttons.sendReferralAnyway.sw}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

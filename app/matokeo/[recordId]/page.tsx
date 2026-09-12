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
import { useEffect, useState } from "react";
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

export default function Result({ params }: { params: { recordId: string } }) {
  const { recordId } = params;
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
      <main className="min-h-screen p-4">
        <Header title="Matokeo" />
        <p className="text-neutral-500">Inapakia...</p>
      </main>
    );
  }

  const { scores, referral } = data;

  return (
    <main className="flex min-h-screen flex-col pb-8">
      <Header title="Matokeo" />

      <div className="flex-1 space-y-5 px-4">
        {data.risk.flagged && (
          <div className="rounded-lg border-2 border-danger bg-white p-4">
            <p className="font-semibold text-danger">Alama ya hatari ilitolewa katika kikao hiki.</p>
            <p className="gloss not-italic">
              A safety escalation occurred in this session. This cannot be lowered by any later edit.
            </p>
          </div>
        )}

        {/* Word first, number second. */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-700">PHQ-9</span>
            <BandChip label={PHQ9_BAND_LABELS_SW[scores.phq9Band]} total={scores.phq9} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-700">GAD-7</span>
            <BandChip label={GAD7_BAND_LABELS_SW[scores.gad7Band]} total={scores.gad7} />
          </div>
          <p className="tabular text-sm text-neutral-500">
            PHQ-2 {scores.phq2} · GAD-2 {scores.gad2} · kizingiti 3
            <span className="gloss block not-italic">
              PHQ-9 is scored 0–27 and GAD-7 0–21. The PHQ-2 / GAD-2 threshold of 3 matches the
              IPMH trial running in Western Kenya, so this output feeds a pathway that exists.
            </span>
          </p>
          <p className="tabular text-sm text-neutral-700">
            Vipengele vilivyopatikana: {scores.coverage.phq9ItemsEvidenced}/9 PHQ-9 ·{" "}
            {scores.coverage.gad7ItemsEvidenced}/7 GAD-7
          </p>
          {referral.incomplete && (
            <p className="text-sm font-medium text-warning">
              ! Uchunguzi haukukamilika.
              <span className="gloss block not-italic">
                The screen was not completed, and the record says so.
              </span>
            </p>
          )}
        </section>

        <section className="card space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Rufaa</p>
          <p className="text-lg font-semibold text-neutral-900">{TIER_LABELS_SW[referral.tier]}</p>
          <p className="text-sm text-neutral-700">{referral.reasonSw}</p>
          <p className="gloss not-italic">{referral.reason}</p>
        </section>

        {/* Both disclaimers, verbatim, never paraphrased. */}
        <DisclaimerStrip withValidation />
      </div>

      <div className="px-4 pt-6">
        <PrimaryButton onClick={() => router.push(`/rufaa/${recordId}`)}>
          {COPY.buttons.sendReferral.sw}
        </PrimaryButton>
      </div>
    </main>
  );
}

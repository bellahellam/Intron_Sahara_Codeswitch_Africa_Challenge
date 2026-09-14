"use client";

/**
 * S6 Kagua (Review & confirm) — §15.4.
 *
 * Two verifications, in order, and the order matters: human first, then the source.
 *
 *   Layer 2 (human): every amber item requires an explicit per-item tap. Bulk-confirm is
 *   deliberately not implemented, and the primary action stays disabled until every amber item
 *   is resolved. The server refuses the write too (FR-17), so this is not the only guard.
 *
 *   Layer 3 (source): the back-read, in her own words, read aloud to her BEFORE submission. She
 *   is the ground truth for what she said and she gets the last word. `Amekanusha` is available
 *   during the back-read, and her disagreement is recorded rather than silently discarded.
 */

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { COPY } from "@/lib/copy";
import { Header, PrimaryButton, ErrorCard } from "@/components/ui";
import { StepIndicator } from "@/components/StepIndicator";
import { EvidenceCard, type EvidenceItem } from "@/components/EvidenceCard";
import {
  bandForConfidence,
  emptyCoverage,
  isContestedConstructResolved,
  type CoverageMap,
} from "@/lib/clinical/coverage";

type Stage = "confirm" | "backread";

export default function Review({ params }: { params: Promise<{ sessionId: string }> }) {
  // Next 16 delivers route params as a Promise; `use` unwraps it in a client component.
  const { sessionId } = use(params);
  const router = useRouter();

  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [coverage, setCoverage] = useState<CoverageMap>(emptyCoverage());
  // Fetched but previously discarded — meaning "nothing was evidenced" rendered unconditionally
  // even when the session had actually escalated on turn 1 (safety scan short-circuits before
  // extraction ever runs, so zero scored items is expected there, not a failure). Matokeo goes on
  // to show facility_urgent for exactly this session, which read as a flat contradiction.
  const [escalated, setEscalated] = useState(false);
  // A turn that genuinely failed to process (LLM timeout/error, not a safety short-circuit —
  // see /api/session/[id]'s heuristic). Without this, a failed turn looks identical to a
  // conversation where nothing relevant was ever said.
  const [extractionFailedCount, setExtractionFailedCount] = useState(0);
  const [stage, setStage] = useState<Stage>("confirm");
  const [backRead, setBackRead] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ sw: string; en: string } | null>(null);

  useEffect(() => {
    fetch(`/api/session/${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setItems(d.items ?? []);
          if (d.coverage) setCoverage(d.coverage);
          setEscalated(d.escalated === true);
          setExtractionFailedCount(typeof d.extractionFailedCount === "number" ? d.extractionFailedCount : 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  // Only items that were actually populated appear. Low-confidence ones were never populated,
  // and somatic-only ones were capped below the threshold on purpose.
  const visible = items.filter((i) => !i.somatic_only && bandForConfidence(i.confidence) !== "low");
  const contestedIds = Object.entries(coverage)
    .filter(([, state]) => state === "CONTESTED")
    .map(([id]) => id);
  const contestedSet = new Set(contestedIds);
  const regular = visible.filter((i) => !contestedSet.has(i.construct));
  const amber = regular.filter((i) => bandForConfidence(i.confidence) === "medium");
  const unresolvedAmber = amber.filter((i) => !i.confirmed && !i.disputed);
  const unresolvedContested = contestedIds.filter((id) => {
    const group = visible.filter((i) => i.construct === id);
    return !isContestedConstructResolved(
      group.map((i) => ({
        construct: i.construct,
        evidence_span: i.evidence_span,
        confirmed: i.confirmed === true,
        disputed: i.disputed === true,
      })),
      id,
    );
  });

  function itemStates() {
    return visible.map((i) => ({
      construct: i.construct,
      evidence_span: i.evidence_span,
      confirmed: i.confirmed === true,
      disputed: i.disputed === true,
    }));
  }

  function pickStanding(construct: string, span: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.construct !== construct
          ? it
          : it.evidence_span === span
            ? { ...it, confirmed: true, disputed: false }
            : { ...it, confirmed: false, disputed: true },
      ),
    );
  }

  function pickNeither(construct: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.construct === construct ? { ...it, confirmed: false, disputed: true } : it,
      ),
    );
  }

  /** Stage 1 → 2. Generates the back-read. Persists NOTHING: she still gets the last word. */
  async function toBackRead() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/backread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, items: itemStates() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError({
          sw: body.messageSw ?? "Haikuwezekana kuandaa maandishi ya kusoma. Jaribu tena.",
          en: body.messageEn ?? "Could not prepare the back-read. Try again.",
        });
        setBusy(false);
        return;
      }
      const data = await res.json();
      setBackRead(data.backRead);
      setStage("backread");
      setBusy(false);
    } catch {
      setError({ sw: COPY.states.failedNetwork.sw, en: COPY.states.failedNetwork.en });
      setBusy(false);
    }
  }

  /** Stage 2 → done. Only now is anything written, and only after she has heard it. */
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, items: itemStates() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError({
          sw: body.messageSw ?? COPY.states.failedSave.sw,
          en: body.messageEn ?? COPY.states.failedSave.en,
        });
        setBusy(false);
        return;
      }
      const data = await res.json();
      // §12.6 rule 1: the success screen is not reached until the write is confirmed.
      router.push(`/matokeo/${data.recordId}`);
    } catch {
      setError({ sw: COPY.states.failedSave.sw, en: COPY.states.failedSave.en });
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-4">
        <Header title="Kagua" />
        <p className="px-0 text-neutral-500">Inapakia...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col pb-8">
      <Header title="Kagua" back={`/mazungumzo/${sessionId}`} />
      <StepIndicator current={1} />

      <div className="flex-1 space-y-4 px-4 pt-4">
        {/* Shown regardless of stage or whether other items exist — a failed turn can sit
            alongside real evidence from the rest of the conversation, and either way she should
            know part of it was never processed, not just told the record is complete. */}
        {extractionFailedCount > 0 && (
          <div className="rounded-md border border-warning bg-white px-3 py-2 text-sm">
            <p className="font-medium text-warning">
              ! {extractionFailedCount === 1
                ? "Sehemu moja ya mazungumzo haikuweza kuchambuliwa."
                : `Sehemu ${extractionFailedCount} za mazungumzo hazikuweza kuchambuliwa.`}
            </p>
            <p className="gloss not-italic">
              {extractionFailedCount === 1
                ? "One part of the conversation could not be processed."
                : `${extractionFailedCount} parts of the conversation could not be processed.`}{" "}
              Whatever she said there is not reflected below or in the score. Consider asking again.
            </p>
          </div>
        )}

        {stage === "confirm" ? (
          <>
            {visible.length === 0 ? (
              escalated ? (
                <div className="rounded-md border border-danger bg-white px-3 py-2 text-sm">
                  <p className="font-medium text-danger">
                    ! Hakuna kipengele cha PHQ-9/GAD-7 kilichopatikana, lakini kikao hiki kiliashiria hatari.
                  </p>
                  <p className="gloss not-italic">
                    No PHQ-9/GAD-7 item was evidenced — but this session raised a safety concern.
                    That carries through to the result regardless of the score.
                  </p>
                </div>
              ) : (
                <p className="text-neutral-700">
                  Hakuna kilichopatikana katika mazungumzo haya.
                  <span className="gloss block not-italic">
                    Nothing was evidenced in this conversation. The record will say so plainly.
                  </span>
                </p>
              )
            ) : (
              <>
                {unresolvedAmber.length > 0 && (
                  <div className="rounded-md border border-warning bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-warning">
                      ! {COPY.states.confirming.sw} ({unresolvedAmber.length})
                    </p>
                    <p className="gloss not-italic">{COPY.states.confirming.en}</p>
                  </div>
                )}

                {unresolvedContested.length > 0 && (
                  <div className="rounded-md border border-warning bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-warning">! {COPY.contested.sw}</p>
                    <p className="gloss not-italic">{COPY.contested.en}</p>
                  </div>
                )}

                {contestedIds.map((id) => {
                  const group = visible.filter((i) => i.construct === id);
                  if (group.length === 0) return null;
                  return (
                    <section key={id} className="space-y-3 rounded-md border border-warning/40 p-3">
                      <p className="text-sm text-neutral-700">
                        {COPY.contested.sw}
                        <span className="gloss block not-italic">{COPY.contested.en}</span>
                      </p>
                      {group.map((item, i) => (
                        <EvidenceCard
                          key={`${item.construct}-${i}`}
                          item={item}
                          onConfirm={() => pickStanding(item.construct, item.evidence_span)}
                        />
                      ))}
                      <button type="button" onClick={() => pickNeither(id)} className="btn-quiet">
                        {COPY.buttons.neither.sw}
                        <span className="gloss ml-1 not-italic">({COPY.buttons.neither.en})</span>
                      </button>
                    </section>
                  );
                })}

                <section className="space-y-3">
                  {regular.map((item, i) => (
                    <EvidenceCard
                      key={`${item.construct}-${i}`}
                      item={item}
                      onConfirm={
                        bandForConfidence(item.confidence) === "medium"
                          ? () =>
                              setItems((prev) =>
                                prev.map((it) =>
                                  it === item ? { ...it, confirmed: true, disputed: false } : it,
                                ),
                              )
                          : undefined
                      }
                      onDispute={() =>
                        setItems((prev) =>
                          prev.map((it) => (it === item ? { ...it, disputed: true, confirmed: false } : it)),
                        )
                      }
                    />
                  ))}
                </section>
              </>
            )}
          </>
        ) : (
          <>
            <section className="card space-y-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                Soma kwa sauti kwa mama <span className="gloss normal-case">(read aloud to the mother)</span>
              </p>
              {/* Largest text on the screen. It exists to be spoken. */}
              <p className="aloud">{backRead}</p>
            </section>

            <p className="text-sm text-neutral-700">
              Akikanusha jambo lolote, bofya <strong>{COPY.buttons.disputed.sw}</strong> kwenye kadi husika.
              <span className="gloss block not-italic">
                If she disagrees with anything, tap {COPY.buttons.disputed.en} on that card. Her
                disagreement is recorded.
              </span>
            </p>

            <section className="space-y-3">
              {visible.map((item, i) => (
                <EvidenceCard
                  key={`br-${item.construct}-${i}`}
                  item={item}
                  onDispute={() =>
                    setItems((prev) =>
                      prev.map((it) => (it === item ? { ...it, disputed: true } : it)),
                    )
                  }
                />
              ))}
            </section>
          </>
        )}

        {error && <ErrorCard sw={error.sw} en={error.en} />}
      </div>

      <div className="px-4 pt-6">
        {stage === "confirm" ? (
          <PrimaryButton
            onClick={toBackRead}
            disabled={unresolvedAmber.length > 0 || unresolvedContested.length > 0 || busy}
            busy={busy}
            disabledReason={
              unresolvedContested.length > 0
                ? COPY.disabledReasons.contestedPending.sw
                : unresolvedAmber.length > 0
                  ? COPY.disabledReasons.amberPending.sw
                  : undefined
            }
          >
            {busy ? "Inaandaa..." : COPY.buttons.confirmAndRead.sw}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={submit} disabled={busy} busy={busy}>
            {busy ? "Inahifadhi..." : COPY.buttons.finishScreening.sw}
          </PrimaryButton>
        )}
      </div>
    </main>
  );
}

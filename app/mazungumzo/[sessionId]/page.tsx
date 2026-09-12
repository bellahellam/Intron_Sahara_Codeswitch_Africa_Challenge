"use client";

/**
 * S4 Mazungumzo (Conversation) — §15.4. The screen where the product lives.
 *
 * Four states: idle, recording, processing, extracted.
 *
 * Two design rules are enforced here and are not negotiable:
 *   - The largest text on any card is the mother's own words (§16.2 principle 1).
 *   - The transcript is never the primary object; it is collapsed below the evidence (CR-C2).
 *
 * `Maliza` (finish) and `Alama ya hatari` (raise risk flag) are available at ALL times, so Grace
 * is never trapped in the loop and never dependent on the machine noticing risk before she does.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { COPY } from "@/lib/copy";
import { formatElapsed, useRecorder, WARN_AT_MS } from "@/components/useRecorder";
import { AmplitudeMeter, CoverageStrip, ErrorCard, Header, RecordControl } from "@/components/ui";
import { EvidenceCard, TranscriptDisclosure, type EvidenceItem } from "@/components/EvidenceCard";
import { Escalation, type EscalationTrigger } from "@/components/Escalation";
import { emptyCoverage, type CoverageMap } from "@/lib/clinical/coverage";

type Phase = "idle" | "recording" | "asr" | "extracting" | "extracted";

interface TurnResponse {
  turnIndex: number;
  transcript: string;
  languageSpans: Array<{ start: number; end: number; language: string }>;
  deletion: { cps: number; deletionSuspected: boolean; calibrated: boolean };
  safety: { hit: boolean; failedClosed: boolean; hits: Array<{ matchedText: string; lexiconId: string }> };
  items: EvidenceItem[];
  riskFlag: boolean;
  riskEvidence: string | null;
  idiomMatches: Array<{ idiomId: string; phrase: string; gloss: string }>;
  coverage: CoverageMap;
  decision: { action: "PROBE" | "ESCALATE" | "COMPLETE"; targetConstruct: string | null; rationale: string };
  probe: { text: string; fixed: boolean; targetConstruct: string } | null;
  extractionFailed: boolean;
  droppedCount: number;
}

export default function Conversation({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("idle");
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [coverage, setCoverage] = useState<CoverageMap>(emptyCoverage());
  const [lastTurn, setLastTurn] = useState<TurnResponse | null>(null);
  // Turn 0 is pre-filled with the opening question (§15.4 S4 empty state).
  const [probe, setProbe] = useState<{ text: string; fixed: boolean } | null>({
    text: COPY.openingQuestion.sw,
    fixed: true,
  });
  const [escalation, setEscalation] = useState<EscalationTrigger | null>(null);
  const [error, setError] = useState<{ sw: string; en: string; retryable: boolean } | null>(null);
  const [micPrompt, setMicPrompt] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const submitTurn = useCallback(
    async ({ blob, durationMs }: { blob: Blob; durationMs: number }) => {
      setPhase("asr");
      setError(null);

      const form = new FormData();
      form.append("sessionId", sessionId);
      form.append("audio", blob, "turn.webm");
      form.append("durationMs", String(durationMs));

      // Two named phases, because a single indeterminate spinner over a six-second wait reads as
      // a hang on a slow connection. Never a fake percentage (§10.3).
      const toExtracting = setTimeout(() => setPhase("extracting"), 3500);

      try {
        const res = await fetch("/api/turn", { method: "POST", body: form });
        clearTimeout(toExtracting);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError({
            sw: body.messageSw ?? COPY.states.failedNetwork.sw,
            en: body.messageEn ?? COPY.states.failedNetwork.en,
            retryable: body.retryable !== false,
          });
          setPhase("idle");
          return;
        }

        const data: TurnResponse = await res.json();
        setLastTurn(data);
        setCoverage(data.coverage);
        setItems((prev) => [...prev, ...data.items]);

        if (data.decision.action === "ESCALATE" || data.safety.hit || data.riskFlag) {
          setEscalation({
            matchedTexts: [
              ...data.safety.hits.map((h) => h.matchedText),
              ...(data.riskEvidence ? [data.riskEvidence] : []),
            ].filter(Boolean),
            source: data.safety.hit ? "deterministic_lexicon" : "llm_risk_flag",
            failedClosed: data.safety.failedClosed,
          });
          setPhase("extracted");
          return;
        }

        if (data.decision.action === "COMPLETE") {
          setProbe(null);
          setPhase("extracted");
          return;
        }

        setProbe(data.probe ? { text: data.probe.text, fixed: data.probe.fixed } : null);
        setPhase("extracted");
      } catch {
        clearTimeout(toExtracting);
        setError({ sw: COPY.states.failedNetwork.sw, en: COPY.states.failedNetwork.en, retryable: true });
        setPhase("idle");
      }
    },
    [sessionId],
  );

  const recorder = useRecorder(submitTurn);

  useEffect(() => {
    if (recorder.state === "recording") setPhase("recording");
  }, [recorder.state]);

  async function raiseManualFlag() {
    recorder.abort();
    await fetch("/api/escalate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, source: "manual" }),
    }).catch(() => {});
    // The interrupt renders from bundled data, so it appears even if that call failed.
    setEscalation({ matchedTexts: [], source: "manual" });
  }

  async function acknowledgeEscalation(quoteSuppressed: boolean) {
    await fetch("/api/escalate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, acknowledged: true, quoteSuppressed }),
    }).catch(() => {});
    setEscalation(null);
  }

  async function withdrawConsent() {
    await fetch("/api/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
    router.push("/imekamilika?reason=withdrawn");
  }

  const recording = recorder.state === "recording";
  const processing = phase === "asr" || phase === "extracting";

  return (
    <main className="flex min-h-screen flex-col pb-6">
      {escalation && (
        <Escalation
          trigger={escalation}
          onAcknowledge={acknowledgeEscalation}
          onWithdraw={withdrawConsent}
          linkFacilityNumber={null}
        />
      )}

      <Header title="Mazungumzo" />

      {/* §16.5a: "the machine is not listening for risk right now." Persistent, not dismissible. */}
      {!online && (
        <div className="mx-4 rounded-md border-2 border-warning bg-white px-3 py-2 text-sm">
          <p className="font-medium text-warning">! {COPY.offlineCaptureBanner.sw}</p>
          <p className="gloss not-italic">{COPY.offlineCaptureBanner.en}</p>
        </div>
      )}

      <div className={["flex-1 space-y-4 px-4", recording ? "opacity-30" : ""].join(" ")}>
        {/* The single affordance that makes an open-ended conversation feel finite. */}
        <section>
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Hali ya uchunguzi <span className="gloss normal-case">(coverage)</span>
          </p>
          <CoverageStrip coverage={coverage} />
        </section>

        {lastTurn?.deletion.deletionSuspected && (
          <div className="rounded-md border border-warning bg-white px-3 py-2 text-sm">
            <p className="font-medium text-warning">! {COPY.states.deletionSuspected.sw}</p>
            <p className="gloss not-italic">{COPY.states.deletionSuspected.en}</p>
            {!lastTurn.deletion.calibrated && (
              <p className="mt-1 text-xs text-neutral-500">
                Kizingiti hakijapimwa bado (detector not yet calibrated against the benchmark set).
              </p>
            )}
          </div>
        )}

        {lastTurn?.extractionFailed && (
          <ErrorCard
            sw="Uchambuzi haukufanikiwa kwa zamu hii. Maandishi yamehifadhiwa. Unaweza kuuliza tena au kuandika mwenyewe."
            en="Extraction failed for this turn. The transcript is saved. Ask again, or enter the item manually."
          />
        )}

        {/* The probe card. Marked as a SUGGESTION, not an instruction, with Uliza and Ruka at
            equal visual weight — if Ruka looks discouraged, the CHP's clinical judgement is
            being overridden by button styling (§16.5a). */}
        {probe && !processing && (
          <section className="rounded-lg border border-ochre/40 bg-ochre/10 p-4 space-y-3">
            <p className="text-xs uppercase tracking-wide text-ochre">
              Pendekezo la swali <span className="gloss normal-case">(suggested question)</span>
              {probe.fixed && <span className="ml-2 normal-case">· maandishi yasiyobadilika</span>}
            </p>
            <p className="aloud">{probe.text}</p>
            <div className="flex gap-2">
              <button type="button" className="btn-quiet flex-1" onClick={() => recorder.start()}>
                {COPY.buttons.ask.sw}
              </button>
              <button type="button" className="btn-quiet flex-1" onClick={() => setProbe(null)}>
                {COPY.buttons.skip.sw}
              </button>
            </div>
          </section>
        )}

        {error && (
          <ErrorCard
            sw={error.sw}
            en={error.en}
            action={
              error.retryable ? (
                <p className="text-sm text-neutral-700">Rekodi tena ukiwa tayari.</p>
              ) : undefined
            }
          />
        )}

        {processing && (
          <div className="card space-y-1">
            {/* Two named phases. Cancel is available throughout; no fake percentage. */}
            <p className="font-medium text-neutral-900">
              {phase === "asr" ? COPY.states.asr.sw : COPY.states.extracting.sw}
            </p>
            <p className="gloss not-italic">
              {phase === "asr" ? COPY.states.asr.en : COPY.states.extracting.en}
            </p>
          </div>
        )}

        {items.length === 0 && !processing ? (
          <p className="text-neutral-500">{COPY.emptyStates.noEvidence.sw}</p>
        ) : (
          <section className="space-y-3">
            {items.map((item, i) => (
              <EvidenceCard
                key={`${item.construct}-${i}`}
                item={item}
                idiomLabel={
                  lastTurn?.idiomMatches.find((m) => m.idiomId === item.idiom_id)?.phrase ?? undefined
                }
                onConfirm={() =>
                  setItems((prev) => prev.map((it, j) => (j === i ? { ...it, confirmed: true } : it)))
                }
                onDispute={() =>
                  setItems((prev) => prev.map((it, j) => (j === i ? { ...it, disputed: true } : it)))
                }
              />
            ))}
          </section>
        )}

        {/* Collapsed BELOW the evidence, always. */}
        {lastTurn && (
          <TranscriptDisclosure transcript={lastTurn.transcript} spans={lastTurn.languageSpans} />
        )}
      </div>

      {/* Capture controls. */}
      <div className="space-y-4 px-4 pt-6">
        {recording && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-900">{COPY.states.recording.sw}</span>
              <span
                className={["tabular text-lg font-semibold", recorder.nearLimit ? "text-warning" : "text-neutral-900"].join(" ")}
              >
                {formatElapsed(recorder.elapsedMs)}
              </span>
            </div>
            <AmplitudeMeter level={recorder.level} lowHint={recorder.lowLevelHint} />
            {recorder.elapsedMs >= WARN_AT_MS && (
              <p className="text-sm font-medium text-warning">! {COPY.states.nearLimit.sw}</p>
            )}
          </div>
        )}

        {recorder.state === "denied" && (
          <ErrorCard sw={COPY.micDenied.sw} en={COPY.micDenied.en} />
        )}

        {recorder.state === "unsupported" && (
          <ErrorCard
            sw="Kivinjari hiki hakiwezi kurekodi sauti. Tumia Chrome kwenye Android."
            en="This browser cannot record audio. Use Chrome on Android."
          />
        )}

        {/* Permission is requested in context at the first record tap, never at launch. */}
        {micPrompt && recorder.state === "idle" && (
          <div className="card space-y-3">
            <p className="text-neutral-900">{COPY.micPermission.sw}</p>
            <p className="gloss">{COPY.micPermission.en}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setMicPrompt(false);
                recorder.start();
              }}
            >
              Sawa
            </button>
          </div>
        )}

        <RecordControl
          recording={recording}
          onStart={() => (micPrompt ? recorder.start() : setMicPrompt(true))}
          onStop={recorder.stop}
          disabled={processing}
        />

        <div className="flex gap-2">
          {/* Persistent, in a fixed position so it becomes muscle memory. Outline, not filled:
              always available, never alarming (§16.5a). */}
          <button
            type="button"
            onClick={raiseManualFlag}
            className="h-12 flex-1 rounded-lg border-2 border-danger font-medium text-danger"
          >
            {COPY.buttons.riskFlag.sw}
          </button>
          {/* Always available, so Grace is never trapped in the loop. */}
          <button
            type="button"
            onClick={() => router.push(`/kagua/${sessionId}`)}
            className="btn-quiet flex-1"
          >
            {COPY.buttons.finish.sw}
          </button>
        </div>
      </div>
    </main>
  );
}

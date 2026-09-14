"use client";

/**
 * S4 Mazungumzo (Conversation) — MVP preset-question mode.
 *
 * WHAT CHANGED FOR MVP:
 * The LLM-generated probe system is replaced with 5 preset evidence-based questions
 * (lib/preset-questions.ts). The CHP records continuously through all 5 questions;
 * she advances manually with "Swali lijalo" after each patient response. After the
 * last question the session ends with "Maliza ziara".
 *
 * The full agentic probe system (lib/agent/probe.ts) and the segment-by-segment
 * real-time processing are retained — the continuous recorder still sends segments
 * to /api/turn and builds up coverage state — but the DISPLAYED question is always
 * the next preset, not whatever the LLM suggested.
 *
 * Why retain the turn pipeline: the safety scan (step 4) must still run on every
 * segment. If item-9 content appears before the CHP reaches question 5, the
 * escalation interrupt fires immediately.
 */

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/copy";
import { PRESET_QUESTIONS, TOTAL_QUESTIONS } from "@/lib/preset-questions";
import { formatElapsed, useContinuousRecorder, type Segment } from "@/components/useContinuousRecorder";
import { CoverageStrip, ErrorCard, Header, ListeningControl } from "@/components/ui";
import { EvidenceCard, TranscriptDisclosure, type EvidenceItem } from "@/components/EvidenceCard";
import { Escalation, type EscalationTrigger } from "@/components/Escalation";
import { emptyCoverage, type CoverageMap } from "@/lib/clinical/coverage";

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

export default function Conversation({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [coverage, setCoverage] = useState<CoverageMap>(emptyCoverage());
  const [lastTurn, setLastTurn] = useState<TurnResponse | null>(null);
  const [escalation, setEscalation] = useState<EscalationTrigger | null>(null);
  const [error, setError] = useState<{ sw: string; en: string } | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [finishing, setFinishing] = useState(false);

  // ── Preset question state ──────────────────────────────────────────────
  // questionIndex tracks which question is currently displayed (0-based).
  // After question 4 (the last), the "Maliza ziara" button replaces "Swali lijalo".
  const [questionIndex, setQuestionIndex] = useState(0);
  const currentQuestion = PRESET_QUESTIONS[questionIndex];
  const isLastQuestion = questionIndex >= TOTAL_QUESTIONS - 1;
  const allQuestionsAsked = questionIndex >= TOTAL_QUESTIONS;

  function advanceQuestion() {
    if (questionIndex < TOTAL_QUESTIONS) {
      setQuestionIndex((i) => i + 1);
    }
  }

  // Segments must reach the server IN ORDER — the agent's coverage state is sequential.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  // Set the moment a segment's response escalates, checked by finish() before it navigates.
  // Needed because MediaRecorder.stop() is async: without this, finish() could already be
  // mid-navigation to Kagua by the time the final segment — possibly the one with the
  // disclosure that matters most — comes back as an escalation.
  const justEscalatedRef = useRef(false);

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

  const sendSegment = useCallback(
    async (segment: Segment) => {
      const form = new FormData();
      form.append("sessionId", sessionId);
      form.append("audio", segment.blob, "turn.webm");
      form.append("durationMs", String(segment.durationMs));
      if (segment.chpSpokeDuring) form.append("chpSpokeDuring", "true");

      try {
        const res = await fetch("/api/turn", { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError({
            sw: body.messageSw ?? COPY.states.failedNetwork.sw,
            en: body.messageEn ?? COPY.states.failedNetwork.en,
          });
          return;
        }

        const data: TurnResponse = await res.json();
        setLastTurn(data);
        setCoverage(data.coverage);
        setItems((prev) => [...prev, ...data.items]);
        setError(null);

        // Safety escalation fires regardless of which preset question we're on.
        if (data.decision.action === "ESCALATE" || data.safety.hit || data.riskFlag) {
          justEscalatedRef.current = true;
          setEscalation({
            matchedTexts: [
              ...data.safety.hits.map((h) => h.matchedText),
              ...(data.riskEvidence ? [data.riskEvidence] : []),
            ].filter(Boolean),
            source: data.safety.hit ? "deterministic_lexicon" : "llm_risk_flag",
            failedClosed: data.safety.failedClosed,
          });
          recorder.stop();
          return;
        }
        // LLM-generated probes are ignored in MVP — we show preset questions only.
      } catch {
        setError({ sw: COPY.states.failedNetwork.sw, en: COPY.states.failedNetwork.en });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId],
  );

  const onSegment = useCallback(
    (segment: Segment) => {
      setPending((n) => n + 1);
      queueRef.current = queueRef.current
        .then(() => sendSegment(segment))
        .finally(() => setPending((n) => Math.max(0, n - 1)));
    },
    [sendSegment],
  );

  const recorder = useContinuousRecorder(onSegment);

  async function raiseManualFlag() {
    recorder.stop();
    await fetch("/api/escalate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, source: "manual" }),
    }).catch(() => {});
    setEscalation({ matchedTexts: [], source: "manual" });
  }

  async function acknowledgeEscalation(quoteSuppressed: boolean) {
    await fetch("/api/escalate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, acknowledged: true, quoteSuppressed }),
    }).catch(() => {});
    justEscalatedRef.current = false;
    setEscalation(null);
  }

  async function withdrawConsent() {
    recorder.abort();
    await fetch("/api/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
    router.push("/imekamilika?reason=withdrawn");
  }

  async function finish() {
    setFinishing(true);
    // Wait for the final segment to actually be handed to onSegment before touching queueRef —
    // recorder.stop() used to be fire-and-forget here, so this navigation could get queued
    // *before* the final segment (the one most likely to contain whatever she says last) was
    // even enqueued for sending, let alone processed. That let this page navigate to Kagua out
    // from under an escalation the final segment had just triggered.
    await recorder.stop();
    await queueRef.current;
    // If that final segment escalated, the Escalation overlay is already showing (sendSegment
    // set justEscalatedRef and escalation state before this promise resolved). Stay put — she
    // acknowledges it normally, and finishing the visit happens afterward, not instead of it.
    if (justEscalatedRef.current) return;
    router.push(`/kagua/${sessionId}`);
  }

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

      {recorder.recording ? (
        <div style={{
          display:"flex", alignItems:"center", gap:10, minHeight:56, padding:"0 14px",
          background:"linear-gradient(105deg,#5B21B6 0%,#7C3AED 54%,#C026D3 100%)", color:"#fff", flexShrink:0,
        }}>
          <span aria-hidden className="animate-pulse-halo" style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:"#fff" }} />
          <span style={{ font:"600 12px Inter, system-ui, sans-serif" }}>Ziara inaendelea</span>
          <span className="tabular" style={{ font:"700 14px Inter, system-ui, sans-serif", marginLeft:2 }}>
            {formatElapsed(recorder.elapsedMs)}
          </span>
          <button
            type="button"
            onClick={raiseManualFlag}
            aria-label={COPY.buttons.riskFlag.sw}
            style={{
              marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:5,
              padding:"6px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,.5)",
              background:"transparent", color:"#fff",
              font:"700 10px Inter, system-ui, sans-serif", letterSpacing:".04em", cursor:"pointer",
            }}
          >
            <svg viewBox="0 0 14 14" fill="none" style={{ width:12, height:12 }} aria-hidden>
              <path d="M7 2l5.5 10H1.5L7 2zM7 5.5v3.2m0 1.6v.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {COPY.states.riskBadge.sw}
          </button>
        </div>
      ) : (
        <Header title="Mazungumzo" />
      )}

      {!online && (
        <div className="mx-4 rounded-md border-2 border-warning bg-white px-3 py-2 text-sm">
          <p className="font-medium text-warning">! {COPY.offlineCaptureBanner.sw}</p>
          <p className="gloss not-italic">{COPY.offlineCaptureBanner.en}</p>
        </div>
      )}

      <div className="flex-1 space-y-4 px-4 pt-4">
        {/* Coverage */}
        <section>
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Hali ya uchunguzi <span className="gloss normal-case">(coverage)</span>
          </p>
          <CoverageStrip coverage={coverage} />
        </section>

        {/* ── Preset question card ── */}
        {recorder.recording && !allQuestionsAsked && (
          <div style={{
            padding:"12px 14px", borderRadius:10,
            background:"#FDF8F2", borderLeft:"3px solid #D9B98E",
          }}>
            {/* Question counter */}
            <p style={{ margin:"0 0 6px", fontSize:10, letterSpacing:".06em", fontWeight:700, color:"#B09272", textTransform:"uppercase" }}>
              Swali {questionIndex + 1} / {TOTAL_QUESTIONS}
            </p>
            {/* Question text */}
            <p style={{ margin:0, fontStyle:"italic", fontSize:15, lineHeight:1.55, color:"#8C521F", fontWeight:500 }}>
              {currentQuestion.sw}
            </p>
            <p style={{ margin:"4px 0 0", fontStyle:"italic", fontSize:12, color:"#B09272" }}>
              {currentQuestion.en}
            </p>
            {/* Advance button */}
            <div style={{ marginTop:10, display:"flex", justifyContent:"flex-end" }}>
              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={advanceQuestion}
                  style={{
                    padding:"6px 14px", borderRadius:7, border:"1px solid #D9B98E",
                    background:"#FDF8F2", color:"#8C521F",
                    font:"600 12px Inter, system-ui, sans-serif", cursor:"pointer",
                  }}
                >
                  Swali la mwisho limeulizwa ✓
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { recorder.markSpeaking(); advanceQuestion(); }}
                  style={{
                    padding:"6px 14px", borderRadius:7, border:"1px solid #D9B98E",
                    background:"#FDF8F2", color:"#8C521F",
                    font:"600 12px Inter, system-ui, sans-serif", cursor:"pointer",
                  }}
                >
                  Swali lijalo →
                </button>
              )}
            </div>
          </div>
        )}

        {/* After all questions have been asked */}
        {recorder.recording && allQuestionsAsked && (
          <div style={{
            padding:"10px 14px", borderRadius:10,
            background:"#F7F5FF", borderLeft:"3px solid #DCD2EE",
          }}>
            <p style={{ margin:0, fontSize:14, color:"#7D7691", fontStyle:"italic" }}>
              Maswali yote yamekamilika. Unaweza kumaliza ziara.
            </p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#A79DB8", fontStyle:"italic" }}>
              All questions complete. You can end the visit.
            </p>
          </div>
        )}

        {/* Errors */}
        {lastTurn?.deletion.deletionSuspected && (
          <div className="rounded-md border border-warning bg-white px-3 py-2 text-sm">
            <p className="font-medium text-warning">! {COPY.states.deletionSuspected.sw}</p>
            <p className="gloss not-italic">{COPY.states.deletionSuspected.en}</p>
          </div>
        )}
        {lastTurn?.extractionFailed && (
          <ErrorCard
            sw="Sehemu moja haikueleweka. Endelea kuongea naye."
            en="One part could not be understood. Keep talking with her."
          />
        )}
        {error && <ErrorCard sw={error.sw} en={error.en} />}

        {/* Evidence cards */}
        {items.length === 0 ? (
          <p className="text-neutral-500">
            {recorder.recording ? COPY.states.listeningEmpty.sw : COPY.emptyStates.noEvidence.sw}
          </p>
        ) : (
          <section className="space-y-3">
            {items.map((item, i) => (
              <EvidenceCard
                key={`${item.construct}-${i}`}
                item={item}
                idiomLabel={lastTurn?.idiomMatches.find((m) => m.idiomId === item.idiom_id)?.phrase}
                onDispute={() =>
                  setItems((prev) => prev.map((it, j) => (j === i ? { ...it, disputed: true } : it)))
                }
              />
            ))}
          </section>
        )}

        {lastTurn && <TranscriptDisclosure transcript={lastTurn.transcript} spans={lastTurn.languageSpans} />}
      </div>

      {/* ── Capture controls ── */}
      <div className="space-y-4 px-4 pt-6">
        {finishing ? (
          <div className="card flex items-center gap-3">
            <span aria-hidden className="animate-pulse-halo" style={{ width:9, height:9, borderRadius:"50%", background:"#7C3AED", flexShrink:0 }} />
            <div>
              <p className="text-neutral-900">{COPY.states.finishingVisit.sw}</p>
              <p className="gloss">{COPY.states.finishingVisit.en}</p>
            </div>
          </div>
        ) : (
          <>
            {recorder.state === "denied" && <ErrorCard sw={COPY.micDenied.sw} en={COPY.micDenied.en} />}
            {recorder.state === "unsupported" && (
              <ErrorCard
                sw="Kivinjari hiki hakiwezi kurekodi sauti. Tumia Chrome kwenye Android."
                en="This browser cannot record audio. Use Chrome on Android."
              />
            )}

            <ListeningControl
              recording={recorder.recording}
              voiceActive={recorder.voiceActive}
              level={recorder.level}
              elapsed={formatElapsed(recorder.elapsedMs)}
              lowLevel={recorder.lowLevelHint}
              busy={pending > 0}
              onStart={() => recorder.start()}
              onStop={finish}
              // Question display and "all done" messaging are both handled by the preset-question
              // card above — the whisper slot's probe/screeningComplete UI would just duplicate it.
              hideWhisper
              onProbeTap={() => recorder.markSpeaking()}
            />
          </>
        )}
      </div>
    </main>
  );
}

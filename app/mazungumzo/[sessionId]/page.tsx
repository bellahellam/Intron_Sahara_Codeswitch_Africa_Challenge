"use client";

/**
 * S4 Mazungumzo (Conversation) — the screen where the product lives.
 *
 * TWO THINGS CHANGED FROM THE ORIGINAL SPEC, both because of the CHP rather than the engineering.
 *
 * 1. CAPTURE IS CONTINUOUS. She taps once at the start of the visit and once at the end. Segments
 *    close on silence, automatically. §10.1 chose tap-per-turn, and its reasoning about hand
 *    availability was right — but it put the phone in the middle of a conversation about self-harm,
 *    repeatedly, at the exact moments her attention belongs on the mother. See
 *    components/useContinuousRecorder.ts for what that costs and what stands in its place.
 *
 * 2. NO NUMBERS ON HER SCREEN. No confidence values, no latencies, no model names, no chars-per-
 *    second. Confidence is still computed and still gates the amber confirmation — she sees the
 *    WORD ("Thibitisha") and never the number. Those belong on the admin view (lib/roles.ts).
 *
 * What she sees while a mother is speaking: the mother's own words, a shape showing how much of
 * the screening is covered, one suggested question, and the two controls she must never have to
 * hunt for — raise a risk flag, and finish.
 */

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/copy";
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
  const [probe, setProbe] = useState<{ text: string; fixed: boolean } | null>({
    text: COPY.openingQuestion.sw,
    fixed: true,
  });
  const [screeningComplete, setScreeningComplete] = useState(false);
  const [escalation, setEscalation] = useState<EscalationTrigger | null>(null);
  const [error, setError] = useState<{ sw: string; en: string } | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [micPrompt, setMicPrompt] = useState(false);
  // True from the moment "Maliza ziara" is pressed until the review screen actually loads.
  // Without this, the capture UI reverts to its pre-recording state the instant recorder.stop()
  // fires — before the last segment has even finished uploading — and looks exactly like nothing
  // was ever recorded.
  const [finishing, setFinishing] = useState(false);

  // Segments must reach the server IN ORDER — the agent's coverage state is sequential, and a
  // turn that overtakes its predecessor would be scored against the wrong context.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

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

        if (data.decision.action === "ESCALATE" || data.safety.hit || data.riskFlag) {
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

        if (data.decision.action === "COMPLETE") {
          setProbe(null);
          setScreeningComplete(true);
        } else if (data.probe) {
          setProbe({ text: data.probe.text, fixed: data.probe.fixed });
        }
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

  function finish() {
    setFinishing(true);
    recorder.stop();
    // Let the last segment drain before moving on, so nothing she said is discarded.
    queueRef.current = queueRef.current.then(() => {
      router.push(`/kagua/${sessionId}`);
    });
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
        // The persistent session bar (§16.2). It says this is one continuous recording spanning
        // the whole visit, not a recording per question — and it carries the risk flag, always
        // one tap away, so it never has to compete with `Maliza ziara` at the bottom.
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

      <div className="flex-1 space-y-4 px-4">
        <section>
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Hali ya uchunguzi <span className="gloss normal-case">(coverage)</span>
          </p>
          <CoverageStrip coverage={coverage} />
        </section>

        {/* The deletion hint is phrased as something SHE can act on. No cps, no threshold. */}
        {lastTurn?.deletion.deletionSuspected && (
          <div className="rounded-md border border-warning bg-white px-3 py-2 text-sm">
            <p className="font-medium text-warning">! {COPY.states.deletionSuspected.sw}</p>
            <p className="gloss not-italic">{COPY.states.deletionSuspected.en}</p>
          </div>
        )}

        {lastTurn?.extractionFailed && (
          <ErrorCard
            sw="Sehemu moja haikueleweka. Endelea kuongea naye — utaweza kuiandika baadaye."
            en="One part could not be understood. Keep talking with her; you can enter it later."
          />
        )}

        {error && <ErrorCard sw={error.sw} en={error.en} />}

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

      {/* Capture controls. One tap to begin, one to end. Nothing in between. */}
      <div className="space-y-4 px-4 pt-6">
        {finishing ? (
          // recorder.recording is already false by the time this renders (stop() flips it
          // instantly), but she hasn't reached Kagua yet — the last segment is still uploading.
          // Without this card, the screen falls back to "Anza kusikiliza" and looks like the
          // visit never happened.
          <div className="card flex items-center gap-3">
            <span aria-hidden className="animate-pulse-halo" style={{ width: 9, height: 9, borderRadius: "50%", background: "#7C3AED", flexShrink: 0 }} />
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

            {micPrompt && !recorder.recording && (
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

            <ListeningControl
              recording={recorder.recording}
              voiceActive={recorder.voiceActive}
              level={recorder.level}
              elapsed={formatElapsed(recorder.elapsedMs)}
              lowLevel={recorder.lowLevelHint}
              busy={pending > 0}
              onStart={() => (micPrompt ? recorder.start() : setMicPrompt(true))}
              onStop={finish}
              probe={probe}
              screeningComplete={screeningComplete}
              onProbeTap={() => recorder.markSpeaking()}
              onProbeSkip={() => setProbe(null)}
            />
          </>
        )}
      </div>
    </main>
  );
}

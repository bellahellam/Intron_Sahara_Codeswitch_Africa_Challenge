"use client";

import Link from "next/link";
import { COPY } from "@/lib/copy";

/* ── Header ──────────────────────────────────────────────────────────────── */
export function Header({ title, back }: { title: string; back?: string }) {
  return (
    <header style={{
      display:"flex", alignItems:"center", gap:12,
      padding:"18px 20px 14px",
      borderBottom:"1px solid #DCE4E1",
    }}>
      {back && (
        <Link
          href={back}
          aria-label="Go back"
          style={{
            display:"flex", alignItems:"center", justifyContent:"center",
            width:36, height:36, minHeight:36, borderRadius:8,
            background:"#FFFFFF", border:"1px solid #DCE4E1",
            color:"#40505A", textDecoration:"none", flexShrink:0,
            transition:"background 130ms",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 12L4 7l5-5" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      )}
      <h1 style={{ fontSize:16, fontWeight:700, color:"#17252D", letterSpacing:"-.02em", margin:0 }}>
        {title}
      </h1>
    </header>
  );
}

/* ── Disclaimer ──────────────────────────────────────────────────────────── */
export function DisclaimerStrip({ withValidation = false }: { withValidation?: boolean }) {
  return (
    <div className="disclaimer">
      <svg viewBox="0 0 16 16" fill="none" style={{ width:14, height:14, flexShrink:0, marginTop:1, color:"#7C3AED" }}>
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div>
          <p style={{ fontSize:13, fontWeight:500, color:"#40505A", margin:"0 0 2px", lineHeight:1.45 }}>
          {COPY.nonDiagnosis.sw}
        </p>
          <p style={{ fontSize:12, color:"#687880", margin:0, fontStyle:"italic" }}>
          {COPY.nonDiagnosis.en}
        </p>
        {withValidation && (
          <>
            <p style={{ fontSize:13, fontWeight:500, color:"#40505A", margin:"8px 0 2px", lineHeight:1.45 }}>
              {COPY.validationDisclaimer.sw}
            </p>
            <p style={{ fontSize:12, color:"#687880", margin:0, fontStyle:"italic" }}>
              {COPY.validationDisclaimer.en}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Primary button ──────────────────────────────────────────────────────── */
export function PrimaryButton({
  children, onClick, disabled, disabledReason, type = "button",
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  disabledReason?: string; type?: "button" | "submit";
}) {
  return (
    <div>
      <button type={type} className="btn-primary" onClick={onClick} disabled={disabled}>
        {children}
      </button>
      {disabled && disabledReason && (
        <p style={{ fontSize:12, color:"#9CA3AF", textAlign:"center", marginTop:6 }}>
          {disabledReason}
        </p>
      )}
    </div>
  );
}

/* ── Amplitude meter ──────────────────────────────────────────────────────── */
const LOW_FLOOR = 0.08;

export function AmplitudeMeter({ level, lowHint }: { level: number; lowHint: boolean }) {
  const segs  = 14;
  const lit   = Math.round(level * segs);
  const floor = Math.round(LOW_FLOOR * segs);

  return (
    <div>
      <div
        role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={level}
        style={{ display:"flex", gap:3, height:24, alignItems:"stretch" }}
      >
        {Array.from({ length: segs }, (_, i) => {
          const active = i < lit;
          let color = "#E5E7EB";
          if (active) {
            if (i < segs * .55) color = "#7C3AED";
            else if (i < segs * .82) color = "#A8652A";
            else color = "#B42318";
          }
          return (
            <div key={i} style={{
              flex:1, borderRadius:3, background:color,
              transition:"background 60ms",
              outline: i === floor ? "1.5px solid rgba(0,0,0,0.15)" : undefined,
            }}/>
          );
        })}
      </div>
      {/* Kiswahili first, and sourced from COPY — a hardcoded English string here would be
          invisible to scripts/export-reviews.ts and so would never reach the native-speaker
          review packet. */}
      {lowHint && (
        <p style={{ fontSize:12, color:"#8C521F", fontWeight:500, marginTop:6 }}>
          ! {COPY.states.lowLevel.sw} <span className="gloss">({COPY.states.lowLevel.en})</span>
        </p>
      )}
    </div>
  );
}

/* ── Listening control (hands-free) ───────────────────────────────────────── */
/**
 * The hands-free capture control.
 *
 * It has exactly two states because the CHP performs exactly two actions in a visit: begin, and
 * end. Everything between them is the system's problem, not hers. Nothing here asks her to press
 * anything per turn — interrupting her to manage a device during a home visit degrades the care
 * she is there to give.
 *
 * The meter is doing a real job and is the reason it survives the "no numbers on her screen" rule:
 * it is the only element that proves the phone is actually hearing the mother, and it does that
 * for the MOTHER watching the screen as much as for the CHP. What it does NOT show is a number.
 *
 * The halo pulses only while a voice is present, so "it is listening and it can hear her" and
 * "it is on but hearing nothing" are visibly different from a metre away (§16.2 principle 3).
 */
export function ListeningControl({
  recording, voiceActive, level, elapsed, lowLevel, busy, onStart, onStop,
}: {
  recording: boolean; voiceActive: boolean; level: number; elapsed: string;
  lowLevel: boolean; busy: boolean; onStart: () => void; onStop: () => void;
}) {
  if (!recording) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
        <button
          type="button"
          onClick={onStart}
          aria-label={COPY.buttons.startListening.sw}
          style={{
            display:"flex", alignItems:"center", justifyContent:"center",
            width:88, height:88, minHeight:88,
            border:"none", borderRadius:"50%",
            background:"linear-gradient(135deg, #7C3AED, #C026D3)",
            color:"#ffffff",
            boxShadow:"0 0 0 8px rgba(124,58,237,0.10), 0 10px 26px rgba(124,58,237,0.30)",
            transition:"transform 150ms, box-shadow 150ms",
          }}
        >
          {/* A mic, not a dot: at rest the control should say what it is about to do. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" style={{ width:30, height:30 }}>
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
          </svg>
        </button>
        <span style={{ fontSize:16, fontWeight:600, color:"#17252D" }}>{COPY.buttons.startListening.sw}</span>
        <span className="gloss">{COPY.buttons.startListening.en}</span>
      </div>
    );
  }

  return (
    <div style={{ display:"grid", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:9, fontSize:15, fontWeight:600, color:"#17252D" }}>
          <span
            aria-hidden
            className={voiceActive ? "animate-pulse-halo" : undefined}
            style={{
              display:"inline-block", width:12, height:12, borderRadius:"50%",
              background:"linear-gradient(135deg, #7C3AED, #C026D3)",
              opacity: voiceActive ? 1 : 0.35,
            }}
          />
          {voiceActive ? COPY.states.hearing.sw : COPY.states.listening.sw}
        </span>
        <span className="tabular" style={{ fontSize:18, fontWeight:700, color:"#17252D" }}>{elapsed}</span>
      </div>

      <AmplitudeMeter level={level} lowHint={lowLevel} />

      {/* Work in flight is shown as reassurance, never as a number or a spinner she must wait on. */}
      {busy && <p style={{ margin:0, fontSize:14, color:"#64747B" }}>{COPY.states.working.sw}</p>}

      <button type="button" onClick={onStop} className="btn-primary">
        {COPY.buttons.endVisit.sw}
      </button>
    </div>
  );
}

/* ── Record control ───────────────────────────────────────────────────────── */
export function RecordControl({
  recording, onStart, onStop, disabled,
}: {
  recording: boolean; onStart: () => void; onStop: () => void; disabled?: boolean;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
      <div style={{ position:"relative", width:96, height:96, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {recording && (
          <>
            <span aria-hidden style={{
              position:"absolute", inset:0, borderRadius:"50%",
              background:"rgba(239,68,68,0.12)",
              animation:"pulse-halo 1.4s ease-in-out infinite",
            }}/>
            <span aria-hidden style={{
              position:"absolute", inset:6, borderRadius:"50%",
              background:"rgba(239,68,68,0.08)",
              animation:"pulse-halo 1.4s ease-in-out .5s infinite",
            }}/>
          </>
        )}
        <button
          type="button"
          onClick={recording ? onStop : onStart}
          disabled={disabled}
          aria-label={recording ? COPY.buttons.stop.sw : COPY.buttons.tapToRecord.sw}
          style={{
            position:"relative",
            width:76, height:76, minHeight:76,
            borderRadius:"50%",
            display:"flex", alignItems:"center", justifyContent:"center",
            border:"none",
            transition:"transform 150ms, box-shadow 150ms",
            ...(disabled ? {
              background:"#E5E7EB", color:"#9CA3AF",
            } : recording ? {
              background:"#B42318",
              color:"#ffffff",
              boxShadow:"0 0 0 6px rgba(180,35,24,0.12), 0 8px 20px rgba(180,35,24,0.22)",
              transform:"scale(1.04)",
            } : {
              background:"linear-gradient(135deg, #7C3AED, #C026D3)",
              color:"#ffffff",
              boxShadow:"0 0 0 6px rgba(124,58,237,0.12), 0 8px 20px rgba(124,58,237,0.28)",
            }),
          }}
        >
          {recording ? (
            /* Stop icon */
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width:22, height:22 }}>
              <rect x="5" y="5" width="14" height="14" rx="2"/>
            </svg>
          ) : (
            /* Mic icon */
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:22, height:22 }}>
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
            </svg>
          )}
        </button>
      </div>
      <span style={{ fontSize:13, fontWeight:500, color: recording ? "#B42318" : "#40505A" }}>
        {recording ? COPY.buttons.stop.sw : COPY.buttons.tapToRecord.sw}
      </span>
    </div>
  );
}

/* ── Coverage strip ───────────────────────────────────────────────────────── */
export function CoverageStrip({
  coverage, onSelect,
}: { coverage: Record<string, string>; onSelect?: (id: string) => void; }) {
  const STATE: Record<string, { bg: string; border: string; dash?: boolean }> = {
    COVERED_HIGH:     { bg:"#EDE9FE", border:"#7C3AED" },
    COVERED_MEDIUM:   { bg:"#F8E9D7", border:"#A8652A" },
    DENIED:           { bg:"#F3F1F6", border:"#8E889B" },
    PROBED_NO_ANSWER: { bg:"transparent", border:"#8E889B", dash:true },
  };

  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }} aria-label="Screening coverage">
      {Object.entries(coverage).map(([id, state]) => {
        const s = STATE[state] ?? { bg:"#F3F4F6", border:"#E5E7EB" };
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect?.(id)}
            aria-label={`${id}: ${state}`}
            title={`${id}: ${state}`}
            style={{
              width:16, height:16, minHeight:16, borderRadius:"50%",
              background:s.bg, border:`2px ${s.dash?"dashed":"solid"} ${s.border}`,
              padding:0, cursor:"pointer",
              transition:"transform 120ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.transform="scale(1.15)")}
            onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}
          />
        );
      })}
    </div>
  );
}

/* ── Band chip ────────────────────────────────────────────────────────────── */
export function BandChip({ label, total }: { label: string; total: number }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"4px 12px", borderRadius:100,
        background:"#EDE9FE", color:"#6D28D9",
      fontSize:13, fontWeight:600,
    }}>
      {label}
      <span style={{ fontSize:12, color:"#A78BFA", fontVariantNumeric:"tabular-nums" }}>({total})</span>
    </span>
  );
}

/* ── Confidence band ──────────────────────────────────────────────────────── */
export function ConfidenceBand({ band }: { band: "high" | "medium" }) {
  return band === "high" ? (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"3px 10px", borderRadius:100,
      background:"#EEF8F3", color:"#087443",
      fontSize:11, fontWeight:600, border:"1px solid #B8DACA",
    }}>
      <svg viewBox="0 0 12 12" fill="none" style={{ width:10, height:10 }}>
        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {COPY.confidence.high.sw}
    </span>
  ) : (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"3px 10px", borderRadius:100,
      background:"#FFF9EF", color:"#8C521F",
      fontSize:11, fontWeight:600, border:"1px solid #EDD4AD",
    }}>
      ! {COPY.confidence.medium.sw}
    </span>
  );
}

/* ── Error card ───────────────────────────────────────────────────────────── */
export function ErrorCard({ sw, en, action }: { sw: string; en: string; action?: React.ReactNode }) {
  return (
    <div className="banner-danger">
      <p style={{ fontSize:13, fontWeight:600, color:"#9F1C16", margin:"0 0 2px" }}>{sw}</p>
      <p style={{ fontSize:12, color:"#52636B", margin:0, fontStyle:"italic" }}>{en}</p>
      {action && <div style={{ marginTop:8 }}>{action}</div>}
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
export function LoadingPulse({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-label="Loading...">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton"
          style={{ height:14, marginBottom:10, width:`${62+(i%3)*16}%` }}/>
      ))}
    </div>
  );
}

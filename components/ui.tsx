"use client";

/**
 * Shared components. §16.5a's five affordance rules are enforced here rather than left to each
 * screen to remember:
 *
 *   1. Shape carries meaning before colour does — the record control is the ONLY circle.
 *   2. Size encodes priority, exactly once per screen.
 *   3. Every icon carries its word. No icon-only controls anywhere.
 *   4. State is shown, never implied by absence.
 *   5. Disabled controls explain themselves.
 */

import Link from "next/link";
import { COPY } from "@/lib/copy";

export function Header({ title, back }: { title: string; back?: string }) {
  return (
    <header className="flex items-center gap-3 px-4 pt-5 pb-3">
      {back && (
        <Link
          href={back}
          className="flex h-12 items-center rounded-lg px-3 text-neutral-700 hover:bg-neutral-200"
        >
          ← Rudi
        </Link>
      )}
      <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
    </header>
  );
}

/** FR-24: always visible on S1, S7 and S8. Never dismissible. */
export function DisclaimerStrip({ withValidation = false }: { withValidation?: boolean }) {
  return (
    <div className="disclaimer space-y-2">
      <p>{COPY.nonDiagnosis.sw}</p>
      <p className="gloss not-italic text-neutral-500">{COPY.nonDiagnosis.en}</p>
      {withValidation && (
        <>
          <p className="pt-1">{COPY.validationDisclaimer.sw}</p>
          <p className="gloss not-italic text-neutral-500">{COPY.validationDisclaimer.en}</p>
        </>
      )}
    </div>
  );
}

/**
 * §16.5a rule 5. A greyed primary action always carries its reason inline. A disabled control
 * with no explanation reads as a broken app, and Grace will conclude the phone is faulty rather
 * than that she has a step remaining.
 */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  disabledReason,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  type?: "button" | "submit";
}) {
  return (
    <div className="space-y-2">
      <button type={type} className="btn-primary" onClick={onClick} disabled={disabled}>
        {children}
      </button>
      {disabled && disabledReason && (
        <p className="text-center text-sm text-neutral-700">{disabledReason}</p>
      )}
    </div>
  );
}

/**
 * §16.5: the amplitude meter. A fixed floor marker is visible so "too quiet" is legible rather
 * than inferred — without it, a low reading looks like a quiet voice rather than a problem.
 */
export function AmplitudeMeter({ level, lowHint }: { level: number; lowHint: boolean }) {
  const segments = 12;
  const lit = Math.round(level * segments);
  const floorSegment = Math.round(LOW_FLOOR_FRACTION * segments);

  return (
    <div className="space-y-2">
      <div
        className="flex h-8 items-stretch gap-1"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Math.round(level * 100) / 100}
        aria-label="Kiwango cha sauti (audio level)"
      >
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            className={[
              "flex-1 rounded-sm transition-colors duration-75",
              i < lit ? "bg-primary-light" : "bg-neutral-200",
              i === floorSegment ? "ring-2 ring-inset ring-neutral-500" : "",
            ].join(" ")}
          />
        ))}
      </div>
      {lowHint && (
        <p className="text-sm text-warning">
          ! {COPY.states.lowLevel.sw} <span className="gloss">({COPY.states.lowLevel.en})</span>
        </p>
      )}
    </div>
  );
}

const LOW_FLOOR_FRACTION = 0.08;

/**
 * The hands-free capture control.
 *
 * It has exactly two states because the CHP performs exactly two actions in a visit: begin, and
 * end. Everything between them is the system's problem, not hers.
 *
 * The meter is doing a real job and is the reason it survives the "no numbers on her screen" rule:
 * it is the only element that proves the phone is actually hearing the mother, and it does that
 * for the MOTHER watching the screen as much as for the CHP. What it does NOT show is a number.
 *
 * The halo pulses only while a voice is present, so "it is listening and it can hear her" and
 * "it is on but hearing nothing" are visibly different from a metre away (§16.2 principle 3).
 */
export function ListeningControl({
  recording,
  voiceActive,
  level,
  elapsed,
  lowLevel,
  busy,
  onStart,
  onStop,
}: {
  recording: boolean;
  voiceActive: boolean;
  level: number;
  elapsed: string;
  lowLevel: boolean;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  if (!recording) {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          aria-label={COPY.buttons.startListening.sw}
          className="h-[88px] w-[88px] rounded-full bg-primary text-3xl text-white active:bg-primary-light"
        >
          ●
        </button>
        <span className="text-base font-medium text-neutral-900">{COPY.buttons.startListening.sw}</span>
        <span className="gloss">{COPY.buttons.startListening.en}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-neutral-900">
          <span
            aria-hidden
            className={[
              "inline-block h-3 w-3 rounded-full bg-primary",
              voiceActive ? "animate-pulse-halo" : "opacity-40",
            ].join(" ")}
          />
          {voiceActive ? COPY.states.hearing.sw : COPY.states.listening.sw}
        </span>
        <span className="tabular text-lg font-semibold text-neutral-900">{elapsed}</span>
      </div>

      <AmplitudeMeter level={level} lowHint={lowLevel} />

      {/* Work in flight is shown as reassurance, never as a number or a spinner she must wait on. */}
      {busy && <p className="text-sm text-neutral-500">{COPY.states.working.sw}</p>}

      <button type="button" onClick={onStop} className="btn-primary">
        {COPY.buttons.endVisit.sw}
      </button>
    </div>
  );
}

/**
 * §16.5a: the record control is the only circle in the product, and at rest it does NOT pulse,
 * so rest and active are unambiguous. The pulse lives on a halo rather than the button, because
 * a growing button moves the tap target.
 */
export function RecordControl({
  recording,
  onStart,
  onStop,
  disabled,
}: {
  recording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-[104px] w-[104px] items-center justify-center">
        {recording && (
          <span
            aria-hidden
            className="absolute inset-0 animate-pulse-halo rounded-full bg-primary-light"
          />
        )}
        <button
          type="button"
          onClick={recording ? onStop : onStart}
          disabled={disabled}
          aria-label={recording ? COPY.buttons.stop.sw : COPY.buttons.tapToRecord.sw}
          className={[
            "relative h-[88px] w-[88px] rounded-full text-white font-semibold",
            disabled ? "bg-neutral-200 text-neutral-500" : "bg-primary active:bg-primary-light",
          ].join(" ")}
        >
          {recording ? "◼" : "●"}
        </button>
      </div>
      {/* Rule 3: every icon carries its word. */}
      <span className="text-base font-medium text-neutral-900">
        {recording ? COPY.buttons.stop.sw : COPY.buttons.tapToRecord.sw}
      </span>
    </div>
  );
}

/**
 * §16.5a: the single affordance that makes an open-ended conversation feel finite, which is what
 * stops Grace ending a session early. Never colour-only — each pip carries an aria-label.
 */
export function CoverageStrip({
  coverage,
  onSelect,
}: {
  coverage: Record<string, string>;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Hali ya uchunguzi (screening coverage)">
      {Object.entries(coverage).map(([id, state]) => {
        const style =
          state === "COVERED_HIGH"
            ? "bg-success border-success"
            : state === "COVERED_MEDIUM"
              ? "bg-warning/40 border-warning"
              : state === "DENIED"
                ? "bg-neutral-200 border-neutral-500"
                : state === "PROBED_NO_ANSWER"
                  ? "bg-neutral-50 border-neutral-500 border-dashed"
                  : "bg-neutral-50 border-neutral-200";
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect?.(id)}
            aria-label={`${id}: ${state}`}
            title={`${id}: ${state}`}
            className={`h-4 w-4 min-h-0 rounded-full border-2 ${style}`}
          >
            {/* Shape carries the DENIED state too, not colour alone. */}
            {state === "DENIED" && <span aria-hidden className="block text-[8px] leading-none">/</span>}
          </button>
        );
      })}
    </div>
  );
}

/** §16.5: word first, number second. `Wastani (14)`, never `14 – moderate`. */
export function BandChip({ label, total }: { label: string; total: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-200 px-3 py-1 text-sm font-semibold text-neutral-900">
      {label} <span className="tabular ml-1">({total})</span>
    </span>
  );
}

/** §16.2 principle 4: never colour alone. Glyph + word + colour, all three. */
export function ConfidenceBand({ band }: { band: "high" | "medium" }) {
  return band === "high" ? (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
      ✓ {COPY.confidence.high.sw}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-warning">
      ! {COPY.confidence.medium.sw}
    </span>
  );
}

export function ErrorCard({ sw, en, action }: { sw: string; en: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-danger bg-white p-4 space-y-2">
      <p className="font-medium text-danger">{sw}</p>
      <p className="gloss not-italic text-neutral-700">{en}</p>
      {action}
    </div>
  );
}

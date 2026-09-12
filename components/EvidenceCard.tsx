"use client";

/**
 * The evidence card (§16.5, §16.5a).
 *
 * What it must signal, unprompted: "this is something SHE said, not something the phone decided."
 * The mechanism is the visual hierarchy itself — ochre left rule plus her quote as the largest
 * text on the card — so provenance is obvious before anyone reads a word. That is the trust
 * mechanism, and it is why the transcript is never the primary object on this screen.
 */

import { getConstruct } from "@/lib/clinical/constructs";
import { bandForConfidence } from "@/lib/clinical/coverage";
import { COPY } from "@/lib/copy";
import { ConfidenceBand } from "./ui";

export interface EvidenceItem {
  construct: string;
  evidence_span: string;
  span_language: string;
  idiom_id: string | null;
  severity_estimate: number;
  confidence: number;
  somatic_only: boolean;
  reasoning: string;
  severity_basis: string;
  /** Local UI state, not part of the extraction contract. */
  confirmed?: boolean;
  disputed?: boolean;
}

export function EvidenceCard({
  item,
  gloss,
  idiomLabel,
  onConfirm,
  onDispute,
  onCorrect,
}: {
  item: EvidenceItem;
  gloss?: string;
  idiomLabel?: string;
  onConfirm?: () => void;
  onDispute?: () => void;
  onCorrect?: () => void;
}) {
  const def = getConstruct(item.construct);
  const band = bandForConfidence(item.confidence);
  // Low-confidence items are never shown, because they were never populated (§16.5).
  if (band === "low") return null;

  const needsConfirm = band === "medium" && !item.confirmed;

  return (
    <article
      className={[
        "animate-card-in card space-y-3 border-l-4 border-l-ochre",
        // Amber cards are the only cards with an outline — shape, not colour alone.
        needsConfirm ? "border-2 border-warning" : "",
        item.disputed ? "opacity-50" : "",
      ].join(" ")}
    >
      <p className="text-sm font-medium text-neutral-700">{def?.labelSw ?? item.construct}</p>

      {/* The largest text on the card, always. Nothing outranks her words. */}
      <blockquote className="quote">{item.evidence_span}</blockquote>
      {gloss && <p className="gloss">{gloss}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBand band={band} />
        {item.idiom_id && (
          // "This phrase was recognised from a known list, not inferred."
          <span className="inline-flex items-center rounded-full bg-ochre/15 px-3 py-1 text-xs font-medium text-ochre">
            {idiomLabel ?? item.idiom_id}
          </span>
        )}
        {item.somatic_only && (
          <span className="inline-flex items-center rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700">
            Mwili tu — inahitaji swali lingine
          </span>
        )}
      </div>

      {item.disputed ? (
        <p className="text-sm font-medium text-neutral-700">
          Amekanusha. Haitahesabiwa.
          <span className="gloss block not-italic">She disagreed. This will not be scored.</span>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {needsConfirm && onConfirm && (
            // §11.9 layer 2: an explicit PER-ITEM tap. Bulk-confirm is deliberately not implemented.
            <button type="button" onClick={onConfirm} className="btn-quiet border-warning text-warning">
              ✓ {COPY.buttons.confirm.sw}
            </button>
          )}
          {onCorrect && (
            <button type="button" onClick={onCorrect} className="btn-quiet">
              {COPY.buttons.correct.sw}
            </button>
          )}
          {onDispute && (
            // Her disagreement is itself data and must survive into the record.
            <button type="button" onClick={onDispute} className="btn-quiet">
              {COPY.buttons.disputed.sw}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * The transcript, collapsed by default and never the primary object (§10.4, CR-C2).
 * English spans are tinted ochre so the switching is VISIBLE — a small touch that makes the
 * product's thesis apparent at a glance.
 */
export function TranscriptDisclosure({
  transcript,
  spans,
}: {
  transcript: string;
  spans: Array<{ start: number; end: number; language: string }>;
}) {
  return (
    <details className="card">
      <summary className="cursor-pointer text-sm font-medium text-neutral-700">
        {COPY.buttons.seeTranscript.sw} <span className="gloss">({COPY.buttons.seeTranscript.en})</span>
      </summary>
      <p className="mt-3 leading-relaxed text-neutral-900">
        {renderTinted(transcript, spans)}
      </p>
      <p className="gloss mt-2 not-italic">
        Maandishi kamili, kama alivyosema — hayajabadilishwa wala kutafsiriwa.
        <span className="block">Verbatim, as spoken. Not normalised to one language, not translated.</span>
      </p>
    </details>
  );
}

function renderTinted(text: string, spans: Array<{ start: number; end: number; language: string }>) {
  if (spans.length === 0) return text;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, i) => {
    if (span.start > cursor) out.push(text.slice(cursor, span.start));
    const chunk = text.slice(span.start, span.end);
    out.push(
      span.language === "en" || span.language === "sheng" ? (
        <span key={i} className="text-ochre" title={span.language}>
          {chunk}
        </span>
      ) : (
        <span key={i}>{chunk}</span>
      ),
    );
    cursor = span.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

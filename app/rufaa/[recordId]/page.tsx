"use client";

/**
 * S8 Rufaa (Handover card) — §15.4.
 *
 * Serves Peter Otieno's fifteen-second job: an English summary a clinical officer can skim.
 *
 * Dense by design — §16.2 principle 6 puts density where text is READ and space where it is
 * TAPPED. The conversation screen is spacious; this one is not.
 *
 * The three success facts are stated explicitly because each one is a promise made on the consent
 * screen: the referral went, the record is saved, the audio is gone.
 */

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { COPY } from "@/lib/copy";
import { DisclaimerStrip, Header } from "@/components/ui";

export default function Handover({ params }: { params: Promise<{ recordId: string }> }) {
  // Next 16 delivers route params as a Promise; `use` unwraps it in a client component.
  const { recordId } = use(params);
  const [handover, setHandover] = useState<string | null>(null);
  const [withheld, setWithheld] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/record/${recordId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setHandover(d.handoverEn ?? null);
        setWithheld((d.disclaimers ?? []).includes("generated_text_withheld_by_safety_check"));
      })
      .catch(() => setHandover(null));
  }, [recordId]);

  async function copy() {
    if (!handover) return;
    try {
      await navigator.clipboard.writeText(handover);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (!handover) return;
    // No PHI in a URL, ever (§14.5). Share the text body only.
    if (navigator.share) await navigator.share({ text: handover }).catch(() => {});
    else await copy();
  }

  return (
    <main className="flex min-h-screen flex-col pb-8">
      <Header title="Rufaa" />

      <div className="flex-1 space-y-4 px-4">
        <div className="rounded-lg border-2 border-success bg-white p-4">
          <p className="font-semibold text-success">✓ {COPY.success.sw}</p>
          <p className="gloss not-italic">{COPY.success.en}</p>
        </div>

        {withheld && (
          <div className="rounded-md border border-warning bg-white px-3 py-2 text-sm">
            <p className="font-medium text-warning">
              ! Sehemu ya maandishi iliyoandaliwa na mfumo haikupita ukaguzi wa usalama, kwa hivyo
              haikutumika.
            </p>
            <p className="gloss not-italic">
              Part of the generated text did not pass the output safety check and was withheld. The
              scores, quotes and referral below are unaffected — they are computed, not generated.
            </p>
          </div>
        )}

        <section className="card">
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Kwa mhudumu wa kliniki <span className="gloss normal-case">(for the clinical officer)</span>
          </p>
          {/* Monospace-adjacent so it survives being pasted into WhatsApp. */}
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-neutral-900">
            {handover ?? "Inapakia..."}
          </pre>
        </section>

        <div className="flex gap-2">
          <button type="button" onClick={copy} className="btn-quiet flex-1">
            {copied ? "✓ Imenakiliwa" : COPY.buttons.copy.sw}
          </button>
          <button type="button" onClick={share} className="btn-quiet flex-1">
            {COPY.buttons.share.sw}
          </button>
        </div>

        <DisclaimerStrip withValidation />
      </div>

      <div className="px-4 pt-6">
        <Link href="/" className="btn-primary flex items-center justify-center">
          {COPY.buttons.home.sw}
        </Link>
      </div>
    </main>
  );
}

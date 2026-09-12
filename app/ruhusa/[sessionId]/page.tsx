"use client";

/**
 * S3 Ruhusa (Consent) — §15.4.
 *
 * Make consent a real, legible act rather than a checkbox.
 *
 * The script is the LARGEST text on the screen, because its job is to be read aloud. That is a
 * type role (§16.4), not a heading.
 *
 * `Amekataa` (she declined) is styled as an equal, not a demoted, choice. If declining looks
 * discouraged, the consent is not free.
 *
 * No microphone access is requested or possible before this screen resolves — and that is
 * enforced server-side (FR-03), not only here.
 */

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { COPY } from "@/lib/copy";
import { Header } from "@/components/ui";

export default function Consent({ params }: { params: Promise<{ sessionId: string }> }) {
  // Next 16 delivers route params as a Promise; `use` unwraps it in a client component.
  const { sessionId } = use(params);
  const router = useRouter();
  const [retainAudio, setRetainAudio] = useState(false);
  const [busy, setBusy] = useState<"agree" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(granted: boolean) {
    if (busy) return;
    setBusy(granted ? "agree" : "decline");
    setError(null);
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, granted, audioRetentionOptIn: granted ? retainAudio : false }),
      });
      if (!res.ok) {
        setError("Haikuwezekana kuhifadhi jibu. Angalia mtandao, kisha jaribu tena.");
        setBusy(null);
        return;
      }
      // On decline: nothing is stored except an anonymous counter. The session ends cleanly.
      router.push(granted ? `/mazungumzo/${sessionId}` : "/imekamilika?reason=declined");
    } catch {
      setError("Hakuna mtandao. Jaribu tena ukipata mtandao.");
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen flex-col pb-8">
      <Header title="Ruhusa" back="/mama" />

      <div className="flex-1 space-y-5 px-4">
        <section className="card space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Soma kwa sauti kwa mama <span className="gloss normal-case">(read aloud to the mother)</span>
          </p>
          {/* Largest text on the screen. It exists to be spoken. */}
          <p className="aloud">{COPY.consentScript.sw}</p>
          <p className="gloss">{COPY.consentScript.en}</p>
        </section>

        <ul className="space-y-2">
          {COPY.consentBullets.map((b) => (
            <li key={b.en} className="flex gap-2 text-base text-neutral-900">
              <span aria-hidden className="text-primary">
                •
              </span>
              <span>
                {b.sw}
                <span className="gloss block not-italic">{b.en}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* §15.4 S3: default OFF, with one line of consequence text. FR-23 / M18. */}
        <label className="card flex items-start gap-3">
          <input
            type="checkbox"
            checked={retainAudio}
            onChange={(e) => setRetainAudio(e.target.checked)}
            className="mt-1 h-6 w-6 rounded border-neutral-500"
          />
          <span>
            <span className="block font-medium text-neutral-900">Hifadhi sauti</span>
            <span className="block text-sm text-neutral-700">
              Kawaida sauti hufutwa mara tu baada ya kuandikwa. Ukichagua hii, sauti itahifadhiwa
              kwa kikao hiki pekee.
            </span>
            <span className="gloss block not-italic">
              Audio is deleted immediately after transcription by default. This keeps it for this
              session only.
            </span>
          </span>
        </label>

        {error && (
          <div className="rounded-lg border-2 border-danger bg-white p-4">
            <p className="font-medium text-danger">{error}</p>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pt-6">
        <button type="button" className="btn-primary" onClick={() => resolve(true)} disabled={busy !== null}>
          {busy === "agree" ? "Inahifadhi..." : COPY.buttons.agreed.sw}
        </button>
        {/* Equal prominence. Never visually demoted. */}
        <button type="button" className="btn-secondary" onClick={() => resolve(false)} disabled={busy !== null}>
          {busy === "decline" ? "Inamaliza..." : COPY.buttons.declined.sw}
        </button>
      </div>
    </main>
  );
}

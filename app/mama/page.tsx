"use client";

/**
 * S2 Mama (Mother identity) — §15.4.
 *
 * Attach the screening to a person without an interrogation. Two fields, ≤20 s.
 *
 * Names are NEVER derived from audio (§5.7: names are the single worst ASR entity class in this
 * setting). A hint says so on screen, so nobody wonders why they are typing.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COPY } from "@/lib/copy";
import { Header, PrimaryButton } from "@/components/ui";

interface RecentMother {
  id: string;
  displayName: string;
  age: number | null;
}

export default function MotherIdentity() {
  const router = useRouter();
  const [chpCode, setChpCode] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [recent, setRecent] = useState<RecentMother[]>([]);
  const [ageWarning, setAgeWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("chp_code") ?? "";
    setChpCode(stored);
    if (stored) {
      fetch(`/api/mothers?chp=${encodeURIComponent(stored)}`)
        .then((r) => (r.ok ? r.json() : { mothers: [] }))
        .then((d) => setRecent(d.mothers ?? []))
        .catch(() => setRecent([]));
    }
  }, []);

  function onAgeChange(value: string) {
    setAge(value);
    const n = Number(value);
    // §15.4 S2: inline, non-blocking, confirmable. A 13-year-old mother is tragically possible
    // and the product must not refuse her.
    if (value && Number.isFinite(n) && (n < 12 || n > 55)) {
      setAgeWarning("Umri uko nje ya kawaida (12–55). Endelea ikiwa ni sahihi.");
    } else setAgeWarning(null);
  }

  async function startSession(motherId?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          motherId
            ? { chpCode, motherId }
            : { chpCode, displayName: anonymous ? initialsOf(name) || "Mama" : name.trim(), age: age ? Number(age) : null, anonymous },
        ),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // FR-31: name what failed and what to do next. Never "something went wrong".
        setError(body.messageSw ?? "Haikuwezekana kuanzisha kikao. Angalia mtandao, kisha jaribu tena.");
        setBusy(false);
        return;
      }
      const { sessionId } = await res.json();
      router.push(`/ruhusa/${sessionId}`);
    } catch {
      setError("Hakuna mtandao. Jaribu tena ukipata mtandao.");
      setBusy(false);
    }
  }

  const canContinue = anonymous || name.trim().length > 0;

  return (
    <main className="flex min-h-full flex-col pb-8">
      <Header title="Mama mpya" back="/" />

      <div className="flex-1 space-y-5 px-4 pt-4">
        {recent.length > 0 && (
          <section>
            <p className="section-label mb-2">
              Mama wa hivi karibuni <span className="normal-case font-normal text-neutral-400">(recent)</span>
            </p>
            <ul className="space-y-2">
              {recent.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="card flex w-full items-center gap-3 text-left
                               hover:border-neutral-300 hover:shadow-sm transition-all"
                    onClick={() => startSession(m.id)}
                    disabled={busy}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center
                                    rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {m.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="flex-1 font-semibold text-neutral-900">{m.displayName}</span>
                    {m.age !== null && (
                      <span className="tabular text-sm text-neutral-400">{m.age} yrs</span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                         className="text-neutral-300 shrink-0" aria-hidden>
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                            strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-400 font-medium">au mama mpya</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>
          </section>
        )}

        <section className="card space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-neutral-700 mb-1">
              Jina <span className="gloss not-italic font-normal">(name)</span>
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={anonymous}
              placeholder="Amina Hassan"
              className="h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-base
                         focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20
                         disabled:bg-neutral-100 disabled:text-neutral-400 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="age" className="block text-sm font-semibold text-neutral-700 mb-1">
              Umri <span className="gloss not-italic font-normal">(age)</span>
            </label>
            <input
              id="age"
              inputMode="numeric"
              value={age}
              onChange={(e) => onAgeChange(e.target.value)}
              placeholder="22"
              className="tabular h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-base
                         focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            />
            {ageWarning && (
              <p className="mt-1.5 flex items-center gap-1 text-sm text-warning font-medium">
                <span aria-hidden>!</span> {ageWarning}
              </p>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="h-5 w-5 rounded border-neutral-300 text-primary
                           focus:ring-primary focus:ring-offset-0"
              />
            </div>
            <span className="text-base text-neutral-800">
              {COPY.buttons.anonymous.sw}
              <span className="gloss block not-italic text-sm font-normal">
                Anonymous — initials only
              </span>
            </span>
          </label>
        </section>

        <p className="flex items-start gap-2 text-sm text-neutral-500 px-1">
          <svg aria-hidden viewBox="0 0 18 18" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-primary">
            <path d="M3 3.5h12v11H3zM5.5 7h7M5.5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>
            Majina hayatokani na sauti — yanaandikwa hapa tu.
            <span className="gloss block not-italic">Names are never taken from audio.</span>
          </span>
        </p>

        {error && (
          <div className="info-strip-danger">
            <p className="text-sm font-semibold text-danger">{error}</p>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        <PrimaryButton
          onClick={() => startSession()}
          disabled={!canContinue || busy}
          disabledReason={!canContinue ? "Andika jina, au chagua 'Bila jina'." : undefined}
        >
          {busy ? "Inaanzisha..." : COPY.buttons.continue.sw}
        </PrimaryButton>
      </div>
    </main>
  );
}

/** An "Anonymous" toggle produces an initials-only local reference. Screening proceeds. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join(".");
}

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
    <main className="flex min-h-screen flex-col pb-8">
      <Header title="Mama" back="/" />

      <div className="flex-1 space-y-5 px-4">
        {recent.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-neutral-700">
              Akina mama wa hivi karibuni <span className="gloss">(recent mothers)</span>
            </h2>
            <ul className="mt-2 space-y-2">
              {recent.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="card flex w-full items-center justify-between text-left"
                    onClick={() => startSession(m.id)}
                    disabled={busy}
                  >
                    <span className="font-medium text-neutral-900">{m.displayName}</span>
                    {m.age !== null && <span className="tabular text-sm text-neutral-500">{m.age}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
              Jina <span className="gloss">(name)</span>
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={anonymous}
              className="mt-1 h-12 w-full rounded-lg border border-neutral-200 px-3 text-base disabled:bg-neutral-200"
            />
          </div>

          <div>
            <label htmlFor="age" className="block text-sm font-medium text-neutral-700">
              Umri <span className="gloss">(age)</span>
            </label>
            <input
              id="age"
              inputMode="numeric"
              value={age}
              onChange={(e) => onAgeChange(e.target.value)}
              className="tabular mt-1 h-12 w-full rounded-lg border border-neutral-200 px-3 text-base"
            />
            {ageWarning && <p className="mt-1 text-sm text-warning">! {ageWarning}</p>}
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-6 w-6 rounded border-neutral-500"
            />
            <span className="text-base text-neutral-900">
              {COPY.buttons.anonymous.sw} <span className="gloss">(anonymous)</span>
            </span>
          </label>

          <p className="text-sm text-neutral-500">
            Majina hayatokani na sauti — yanaandikwa hapa tu.
            <br />
            <span className="gloss">Names are never taken from audio. They are typed here only.</span>
          </p>
        </section>

        {error && (
          <div className="rounded-lg border-2 border-danger bg-white p-4">
            <p className="font-medium text-danger">{error}</p>
          </div>
        )}
      </div>

      <div className="px-4 pt-6">
        <PrimaryButton
          onClick={() => startSession()}
          disabled={!canContinue || busy}
          disabledReason={!canContinue ? "Andika jina, au chagua 'Bila jina'." : undefined}
        >
          {COPY.buttons.continue.sw}
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

"use client";

/**
 * S1 Nyumbani (Home) — §15.4.
 *
 * Two jobs: get Grace into a screening in one tap, and make the product's limits visible before
 * anything else. The non-diagnosis statement is first in DOM order, not merely visually first,
 * so it is the first thing a screen reader reaches too.
 *
 * No microphone permission is requested here. That prompt belongs at the first record tap, in
 * context, where it can be explained.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { COPY } from "@/lib/copy";
import { DisclaimerStrip } from "@/components/ui";

interface TodayRecord {
  id: string;
  motherName: string;
  time: string;
  band: string;
  tier: string;
  unsent?: boolean;
}

export default function Home() {
  const [chpCode, setChpCode] = useState<string>("");
  const [editingCode, setEditingCode] = useState(false);
  const [records, setRecords] = useState<TodayRecord[] | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // FR-01: the CHP code persists in localStorage, appears on every record, and is changeable.
    // It is an identifier, not a secret, and §14.5 says so explicitly rather than implying
    // security the MVP does not have.
    const stored = localStorage.getItem("chp_code");
    if (stored) setChpCode(stored);
    else setEditingCode(true);

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

  useEffect(() => {
    if (!chpCode) return;
    fetch(`/api/records/today?chp=${encodeURIComponent(chpCode)}`)
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((d) => setRecords(d.records ?? []))
      .catch(() => setRecords([]));
  }, [chpCode]);

  function saveCode(code: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    localStorage.setItem("chp_code", trimmed);
    setChpCode(trimmed);
    setEditingCode(false);
  }

  return (
    <main className="flex min-h-screen flex-col px-4 pb-8 pt-6">
      {/* First in DOM order, deliberately. */}
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-primary">{COPY.productName}</h1>
        <p className="text-base leading-relaxed text-neutral-900">{COPY.purpose.sw}</p>
        <p className="gloss not-italic">{COPY.purpose.en}</p>
        <DisclaimerStrip />
      </div>

      {/* §16.5a rule 4: state is shown, never implied by absence. */}
      {!online && (
        <div className="mt-4 rounded-md border border-warning bg-white px-4 py-3 text-sm">
          <p className="font-medium text-warning">! {COPY.states.offline.sw}</p>
          <p className="gloss not-italic">{COPY.states.offline.en}</p>
        </div>
      )}

      <section className="mt-6 flex-1">
        {editingCode ? (
          <form
            className="card space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveCode(new FormData(e.currentTarget).get("code") as string);
            }}
          >
            <label className="block text-sm font-medium text-neutral-700" htmlFor="code">
              Nambari yako ya CHP <span className="gloss">(your CHP code)</span>
            </label>
            <input
              id="code"
              name="code"
              defaultValue={chpCode}
              autoCapitalize="characters"
              placeholder="KWG-014"
              className="h-12 w-full rounded-lg border border-neutral-200 px-3 text-base"
            />
            <button type="submit" className="btn-primary">
              {COPY.buttons.continue.sw}
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-700">
              CHP: <span className="font-semibold text-neutral-900">{chpCode}</span>
            </p>
            <button type="button" className="btn-quiet" onClick={() => setEditingCode(true)}>
              Badilisha
            </button>
          </div>
        )}

        <h2 className="mt-6 text-base font-semibold text-neutral-900">
          Uchunguzi wa leo <span className="gloss">(today&apos;s screenings)</span>
        </h2>

        {records === null ? (
          // §16.5a anti-affordance: no skeleton shimmer that resembles content — a user who
          // cannot yet read fluently will try to tap it. A plain line instead.
          <p className="mt-3 text-sm text-neutral-500">Inapakia...</p>
        ) : records.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-neutral-200 p-6 text-center">
            <p className="text-neutral-700">{COPY.emptyStates.home.sw}</p>
            <p className="gloss not-italic mt-1">{COPY.emptyStates.home.en}</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {records.map((r) => (
              <li key={r.id}>
                <Link href={`/rufaa/${r.id}`} className="card flex items-center justify-between">
                  <span>
                    <span className="block font-medium text-neutral-900">{r.motherName}</span>
                    <span className="tabular text-sm text-neutral-500">{r.time}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold text-neutral-900">{r.band}</span>
                    <span className="block text-xs text-neutral-700">{r.tier}</span>
                    {/* §16.5a: "this has not left the phone." Never a silent retry. */}
                    {r.unsent && <span className="block text-xs font-medium text-warning">! Haijatumwa</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 space-y-3">
        {/* Primary CTA in the lower third, thumb-reachable. Exactly one per screen. */}
        <Link href="/mama" className="btn-primary flex items-center justify-center">
          {COPY.buttons.start.sw}
        </Link>
        <Link href="/sahara" className="btn-quiet flex items-center justify-center">
          {COPY.buttons.whySahara.sw}
        </Link>
        {/* Deliberately understated. The technical surface is not for the person on a doorstep. */}
        <Link href="/admin" className="block text-center text-xs text-neutral-500 underline">
          Admin
        </Link>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

interface Viewer {
  role: "user" | "admin";
  chpCode?: string;
}

const TIER_CFG: Record<string, { label: string; dot: string; text: string }> = {
  facility_urgent: { label: "Urgent", dot: "#B42318", text: "#9B1C13" },
  facility_routine: { label: "Routine", dot: "#A8652A", text: "#8C521F" },
  chp_followup: { label: "Follow-up", dot: "#7C3AED", text: "#6D28D9" },
};

function WaveMark() {
  return (
    <svg viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M1 7h1M3 4v6M6 1v12M9 4v6M12 2v10M15 4v6M18 4v6M20 7h-1" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 14 14" fill="none" width="14" height="14" aria-hidden>
      <path d="M2 7l3 3 7-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [chpCode, setChpCode] = useState("");
  const [editingCode, setEditing] = useState(false);
  const [records, setRecords] = useState<TodayRecord[] | null>(null);
  const [online, setOnline] = useState(true);
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("chp_code");
    if (stored) setChpCode(stored); else setEditing(true);
    fetch("/api/auth/session")
      .then((response) => response.ok ? response.json() : null)
      .then((session) => {
        if (!session?.authenticated) {
          router.replace("/login");
          return;
        }
        setViewer({ role: session.role, ...(session.chpCode ? { chpCode: session.chpCode } : {}) });
        if (session.chpCode) {
          localStorage.setItem("chp_code", session.chpCode);
          setChpCode(session.chpCode);
          setEditing(false);
        }
      })
      .catch(() => router.replace("/login"));
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [router]);

  useEffect(() => {
    if (!chpCode) return;
    fetch(`/api/records/today?chp=${encodeURIComponent(chpCode)}`)
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((d) => setRecords(d.records ?? []))
      .catch(() => setRecords([]));
  }, [chpCode]);

  function saveCode(code: string) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    localStorage.setItem("chp_code", normalized);
    setChpCode(normalized);
    setEditing(false);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("chp_code");
    router.replace("/login");
  }

  return (
    <main className="home-page flex flex-col">
      <header className="home-toolbar">
        <div className="home-brand">
          <WaveMark />
          <span>MAMA-SAUTI</span>
        </div>
        <span className="home-context">Community health screening</span>
        <div className="home-toolbar-actions">
          {viewer?.role === "admin" && <Link href="/admin">Admin</Link>}
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="home-intro">
        <p className="home-kicker">Postnatal screening desk</p>
        <h1 className="home-title">Screen with care, in her own words.</h1>
        <p className="home-description">
          Voice screening for Kiswahili and English. Each result remains linked to the words she used.
        </p>

        {editingCode ? (
          <form
            className="home-code"
            onSubmit={(event) => {
              event.preventDefault();
              saveCode(new FormData(event.currentTarget).get("code") as string);
            }}
          >
            <div>
              <label className="sr-only" htmlFor="chp-code">CHP code</label>
              <input id="chp-code" name="code" defaultValue={chpCode} autoCapitalize="characters" placeholder="CHP code, e.g. KWG-014" />
            </div>
            <button type="submit" className="btn-primary">Continue</button>
          </form>
        ) : (
          <div className="home-user">
            <div className="home-user-mark">{chpCode.slice(0, 2)}</div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[10px] font-bold uppercase tracking-[.08em] text-neutral-500">Signed in as</p>
              <p className="m-0 font-mono text-sm font-bold tracking-[.04em] text-neutral-900">{chpCode}</p>
            </div>
            {viewer?.role === "admin" && (
              <button type="button" className="btn-quiet h-9 min-h-9 px-3 text-xs" onClick={() => setEditing(true)}>Change</button>
            )}
          </div>
        )}

        <div className="home-checks" aria-label="Product safeguards">
          {[
            "Audio deleted after transcription",
            "Referral support, not diagnosis",
            "Works offline",
          ].map((item) => (
            <span key={item} className="home-check"><CheckMark />{item}</span>
          ))}
        </div>

        {!online && (
          <div className="banner-warning mt-4">
            <p className="m-0 text-sm font-semibold text-[#8c521f]">No network — past records are available; new screenings need connectivity.</p>
          </div>
        )}
      </section>

      <section className="home-content">
        <div className="flex items-center justify-between">
          <p className="text-label m-0">Today&apos;s screenings</p>
          {records && records.length > 0 && (
            <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-xs font-bold text-[#6d28d9]">{records.length}</span>
          )}
        </div>

        {records === null && (
          <div className="flex flex-col gap-2" aria-label="Loading today’s screenings">
            {[0, 1, 2].map((item) => <div key={item} className="skeleton h-14" />)}
          </div>
        )}

        {records !== null && records.length === 0 && (
          <div className="home-empty">
            <p className="m-0 text-sm font-semibold text-neutral-800">No screenings yet today</p>
            <p className="mt-1 mb-0 text-sm text-neutral-500">Start a screening when you are ready.</p>
          </div>
        )}

        {records !== null && records.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {records.map((record) => {
              const tier = TIER_CFG[record.tier];
              return (
                <li key={record.id}>
                  <Link href={`/rufaa/${record.id}`} className="home-record">
                    <div className="home-user-mark">{record.motherName.slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-neutral-900">{record.motherName}</p>
                      <p className="m-0 text-xs text-neutral-500 tabular">{record.time}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="m-0 text-sm font-bold text-neutral-900">{record.band}</p>
                      {tier && <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: tier.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: tier.dot }} />{tier.label}</span>}
                      {record.unsent && <span className="text-[11px] font-semibold text-[#8c521f]">Unsent</span>}
                    </div>
                    <svg viewBox="0 0 14 14" fill="none" width="14" height="14" className="shrink-0 text-neutral-400" aria-hidden>
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="home-action-area">
          <DisclaimerStrip />
          <Link href="/mama" className="btn-primary no-underline">
            {COPY.buttons.start.sw}
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          {viewer?.role === "admin" && (
            <Link href="/admin" className="btn-quiet w-full no-underline">Open administration</Link>
          )}
        </div>
      </section>
    </main>
  );
}

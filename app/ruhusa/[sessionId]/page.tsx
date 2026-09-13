"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { COPY } from "@/lib/copy";
import { Header } from "@/components/ui";

export default function Consent({ params }: { params: Promise<{ sessionId: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;
  const router = useRouter();
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
        body: JSON.stringify({ sessionId, granted }),
      });
      if (!res.ok) { setError("Hakuna mtandao. Jaribu tena."); setBusy(null); return; }
      router.push(granted ? `/mazungumzo/${sessionId}` : "/imekamilika?reason=declined");
    } catch {
      setError("Hakuna mtandao. Jaribu tena."); setBusy(null);
    }
  }

  return (
    <main style={{ display:"flex", flexDirection:"column", minHeight:"100%", paddingBottom:32 }}>
      <Header title="Ruhusa" back="/mama" />

      <div style={{ flex:1, padding:"20px 20px 0", display:"flex", flexDirection:"column", gap:20 }}>

        {/* ── Read-aloud script ─────────────────────────────────────── */}
        <div style={{
          background:"#F9FAFB", borderRadius:16,
          border:"1px solid #E5E7EB", padding:"16px 18px",
        }}>
          <p style={{
            fontSize:10, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase",
            color:"#9CA3AF", marginBottom:12,
          }}>
            Soma kwa sauti · Read aloud
          </p>
          {/* The script — large, for reading aloud in poor light */}
          <p style={{
            fontSize:17, fontWeight:500, lineHeight:1.65, color:"#111827",
            margin:"0 0 10px",
          }}>
            Ningependa tuongee jinsi umejisikiaje tangu ujifungue. Nitatumia simu hii kusikiliza na kuandika.{" "}
            <strong>Sauti yako itafutwa mara moja baada ya kuandikwa.</strong>{" "}
            Unaweza kusimamisha wakati wowote.
          </p>
          <p style={{ fontSize:13, color:"#9CA3AF", fontStyle:"italic", margin:0, lineHeight:1.5 }}>
            I&apos;d like to talk about how you&apos;ve been feeling since birth.
            Your voice is deleted immediately after transcription.
            You can stop at any time.
          </p>
        </div>

        {/* ── Key points — 3 lines max ──────────────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { sw: "Sauti hufutwa mara moja", en: "Audio deleted immediately" },
            { sw: "Maandishi yanaenda kwa kliniki peke yake", en: "Writing goes to the clinic only" },
            { sw: "Unaweza kuacha wakati wowote", en: "You can stop at any time" },
          ].map(p => (
            <div key={p.en} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
              <svg viewBox="0 0 14 14" fill="none" style={{ width:14, height:14, marginTop:2, flexShrink:0, color:"#7C3AED" }}>
                <path d="M2 7l3 3 7-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <p style={{ fontSize:14, fontWeight:600, color:"#111827", margin:0 }}>{p.sw}</p>
                <p style={{ fontSize:12, color:"#9CA3AF", margin:0 }}>{p.en}</p>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p style={{ fontSize:13, color:"#DC2626", textAlign:"center" }}>{error}</p>
        )}

        <div style={{ flex:1 }} />
      </div>

      {/* ── CTAs ─────────────────────────────────────────────────────── */}
      <div style={{ padding:"0 20px", display:"flex", flexDirection:"column", gap:10 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => resolve(true)}
          disabled={busy !== null}
        >
          {busy === "agree" ? "Inahifadhi..." : COPY.buttons.agreed.sw}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => resolve(false)}
          disabled={busy !== null}
        >
          {busy === "decline" ? "Inamaliza..." : COPY.buttons.declined.sw}
        </button>
      </div>
    </main>
  );
}

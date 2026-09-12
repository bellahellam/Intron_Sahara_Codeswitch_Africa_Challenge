"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { COPY } from "@/lib/copy";
import { Header } from "@/components/ui";

interface RecordData {
  motherName: string;
  chpCode: string;
  createdAt: string;
  handoverEn: string | null;
  withheld: boolean;
  scores: {
    phq9: number; phq9Band: string;
    gad7: number; gad7Band: string;
    phq2: number; gad2: number;
    coverage?: { phq9ItemsEvidenced: number };
  };
  referral: { tier: string; reason: string; incomplete?: boolean };
  risk: { flagged: boolean };
}

const BAND_LABEL: Record<string, string> = {
  minimal: "Minimal", mild: "Mild", moderate: "Moderate",
  moderately_severe: "Mod. Severe", severe: "Severe",
};

const TIER_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  facility_urgent:  { label: "Same-day facility",    color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
  facility_routine: { label: "Facility within 14d",  color: "#B45309", bg: "#FFFBEB", dot: "#F59E0B" },
  chp_followup:     { label: "CHP follow-up",        color: "#5B21B6", bg: "#F5F3FF", dot: "#7C3AED" },
};

export default function Handover({ params }: { params: Promise<{ recordId: string }> }) {
  const resolvedParams = use(params);
  const recordId = resolvedParams.recordId;

  const [data, setData]     = useState<RecordData | null>(null);
  const [loading, setLoad]  = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/record/${recordId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setData({
          motherName: d.motherName,
          chpCode:    d.chpCode,
          createdAt:  d.createdAt,
          handoverEn: d.handoverEn ?? null,
          withheld:   (d.disclaimers ?? []).includes("generated_text_withheld_by_safety_check"),
          scores:     d.scores ?? {},
          referral:   d.referral ?? {},
          risk:       d.risk ?? {},
        });
      })
      .catch(() => {})
      .finally(() => setLoad(false));
  }, [recordId]);

  async function copy() {
    const text = data?.handoverEn;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* unavailable */ }
  }

  async function share() {
    const text = data?.handoverEn;
    if (!text) return;
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else copy();
  }

  const tier = data ? TIER_CFG[data.referral.tier] ?? TIER_CFG.chp_followup : null;
  const ts   = data ? new Date(data.createdAt).toLocaleString("en-GB", { dateStyle:"short", timeStyle:"short" }) : "";

  return (
    <main style={{ display:"flex", flexDirection:"column", minHeight:"100%", paddingBottom:32 }}>
      <Header title="Rufaa" />

      <div style={{ flex:1, padding:"16px 20px 0", display:"flex", flexDirection:"column", gap:14 }}>

        {/* Success bar */}
        <div style={{
          display:"flex", alignItems:"center", gap:10,
          padding:"11px 16px", borderRadius:12,
          background:"#ECFDF5", border:"1px solid #A7F3D0",
        }}>
          <svg viewBox="0 0 16 16" fill="none" style={{ width:16, height:16, flexShrink:0 }}>
            <path d="M13 4L6 11l-3-3" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p style={{ fontSize:13, fontWeight:600, color:"#065F46", margin:0 }}>{COPY.success.sw}</p>
        </div>

        {/* Safety withheld */}
        {data?.withheld && (
          <div style={{
            padding:"10px 14px", borderRadius:10,
            background:"#FFFBEB", border:"1px solid #FDE68A",
          }}>
            <p style={{ fontSize:12, color:"#92400E", margin:0, lineHeight:1.5 }}>
              ! Muhtasari wa maandishi umesimamishwa (haukupita ukaguzi wa usalama).
              Alama na rufaa hazijabadilishwa.
            </p>
          </div>
        )}

        {loading && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"4px 0" }}>
            {[70,50,60].map((w,i) => (
              <div key={i} className="skeleton" style={{ height:12, width:`${w}%` }} />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* ── Structured handover card ─────────────────────────── */}
            <div style={{
              borderRadius:16, border:"1px solid #E5E7EB",
              background:"#ffffff", overflow:"hidden",
            }}>

              {/* Card header — meta */}
              <div style={{
                padding:"12px 16px", borderBottom:"1px solid #F3F4F6",
                background:"#F9FAFB",
                display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8,
              }}>
                <div>
                  <p style={{ fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"#9CA3AF", margin:"0 0 2px" }}>
                    MAMA-SAUTI · Clinical Handover
                  </p>
                  <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:0 }}>
                    {data.motherName}
                  </p>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <p style={{ fontSize:11, color:"#9CA3AF", margin:0, fontVariantNumeric:"tabular-nums" }}>{ts}</p>
                  <p style={{ fontSize:11, color:"#9CA3AF", margin:0 }}>{data.chpCode}</p>
                </div>
              </div>

              {/* Risk flag — only if flagged */}
              {data.risk.flagged && (
                <div style={{
                  padding:"10px 16px", borderBottom:"1px solid #FECDD3",
                  background:"#FFF1F2",
                  display:"flex", alignItems:"center", gap:8,
                }}>
                  <svg viewBox="0 0 14 14" fill="none" style={{ width:14, height:14, flexShrink:0, color:"#DC2626" }}>
                    <path d="M7 1L13 12H1L7 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M7 5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p style={{ fontSize:12, fontWeight:600, color:"#9B1C1C", margin:0 }}>
                    Safety escalation occurred in this session
                  </p>
                </div>
              )}

              {/* Scores row */}
              <div style={{
                display:"grid", gridTemplateColumns:"1fr 1fr",
                borderBottom:"1px solid #F3F4F6",
              }}>
                {[
                  { label:"PHQ-9", score: data.scores.phq9, band: data.scores.phq9Band },
                  { label:"GAD-7", score: data.scores.gad7, band: data.scores.gad7Band },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    padding:"14px 16px",
                    borderRight: i === 0 ? "1px solid #F3F4F6" : undefined,
                  }}>
                    <p style={{ fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"#9CA3AF", margin:"0 0 4px" }}>
                      {s.label}
                    </p>
                    <p style={{ fontSize:22, fontWeight:800, color:"#111827", margin:"0 0 2px", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>
                      {s.score ?? "—"}
                    </p>
                    <p style={{ fontSize:12, color:"#6B7280", margin:0 }}>
                      {BAND_LABEL[s.band] ?? s.band ?? "—"}
                    </p>
                  </div>
                ))}
              </div>

              {/* Sub-scores */}
              <div style={{
                padding:"10px 16px", borderBottom:"1px solid #F3F4F6",
                display:"flex", gap:16,
              }}>
                {[
                  { label:"PHQ-2", val: data.scores.phq2 },
                  { label:"GAD-2", val: data.scores.gad2 },
                  { label:"Threshold", val:"3 (IPMH)" },
                ].map(s => (
                  <div key={s.label} style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                    <span style={{ fontSize:10, fontWeight:600, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:".06em" }}>{s.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:"#374151", fontVariantNumeric:"tabular-nums" }}>{s.val ?? "—"}</span>
                  </div>
                ))}
              </div>

              {/* Referral tier */}
              {tier && (
                <div style={{
                  padding:"12px 16px", borderBottom:"1px solid #F3F4F6",
                  background: tier.bg,
                  display:"flex", alignItems:"center", gap:8,
                }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:tier.dot, flexShrink:0, display:"inline-block" }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:tier.color, margin:0 }}>
                      {tier.label}
                    </p>
                    <p style={{ fontSize:11, color:"#6B7280", margin:0, lineHeight:1.4 }}>
                      {data.referral.reason}
                    </p>
                  </div>
                </div>
              )}

              {/* Incomplete flag */}
              {(data.referral.incomplete || (data.scores.coverage?.phq9ItemsEvidenced ?? 9) < 6) && (
                <div style={{
                  padding:"8px 16px",
                  borderBottom:"1px solid #F3F4F6",
                  display:"flex", alignItems:"center", gap:6,
                }}>
                  <svg viewBox="0 0 12 12" fill="none" style={{ width:12, height:12, flexShrink:0, color:"#F59E0B" }}>
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M6 3v3M6 7.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p style={{ fontSize:11, color:"#92400E", margin:0, fontWeight:500 }}>
                    Screen incomplete — fewer than 6 PHQ-9 items evidenced
                  </p>
                </div>
              )}

              {/* Footer disclaimer */}
              <div style={{ padding:"10px 16px" }}>
                <p style={{ fontSize:10, color:"#9CA3AF", margin:0, lineHeight:1.55 }}>
                  Not a diagnosis · Instrument not validated in Kiswahili for perinatal populations
                </p>
              </div>
            </div>

            {/* ── AI narrative summary ────────────────────────────────── */}
            {data.handoverEn && !data.withheld && (
              <div style={{
                borderRadius:16, border:"1px solid #E5E7EB",
                background:"#ffffff", overflow:"hidden",
              }}>
                <div style={{
                  padding:"10px 16px", borderBottom:"1px solid #F3F4F6",
                  background:"#F9FAFB",
                  display:"flex", alignItems:"center", gap:6,
                }}>
                  <svg viewBox="0 0 14 14" fill="none" style={{ width:12, height:12, color:"#7C3AED" }}>
                    <path d="M1 3h12M1 7h8M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p style={{ fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"#9CA3AF", margin:0 }}>
                    Clinical Summary
                  </p>
                </div>
                <div style={{ padding:"14px 16px" }}>
                  {/* Parse the handover text into readable paragraphs */}
                  {data.handoverEn
                    .split(/\n+/)
                    .filter(line => line.trim())
                    .map((line, i) => {
                      // Lines starting with known prefixes get special treatment
                      const isWarning = /INCOMPLETE|ESCALAT|SAFETY/i.test(line);
                      const isLabel   = /^(PHQ|GAD|Referral:|Screen |Not a|This instrument)/i.test(line.trim());
                      return (
                        <p key={i} style={{
                          fontSize: isLabel ? 12 : 13,
                          fontWeight: isWarning ? 600 : 400,
                          color: isWarning ? "#B45309" : isLabel ? "#6B7280" : "#374151",
                          margin: "0 0 8px",
                          lineHeight: 1.6,
                        }}>
                          {line.trim()}
                        </p>
                      );
                    })
                  }
                </div>
              </div>
            )}

            {/* ── Copy / Share ────────────────────────────────────────── */}
            <div style={{ display:"flex", gap:8 }}>
              <button type="button" onClick={copy}
                style={{
                  flex:1, height:44, minHeight:44, borderRadius:10, cursor:"pointer",
                  background: copied ? "#ECFDF5" : "#ffffff",
                  border: copied ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                  color: copied ? "#059669" : "#374151",
                  fontSize:14, fontWeight:500,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  transition:"all 150ms",
                }}
              >
                {copied ? "✓ Copied" : COPY.buttons.copy.sw}
              </button>
              <button type="button" onClick={share}
                style={{
                  flex:1, height:44, minHeight:44, borderRadius:10, cursor:"pointer",
                  background:"#ffffff", border:"1px solid #E5E7EB",
                  color:"#374151", fontSize:14, fontWeight:500,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                }}
              >
                {COPY.buttons.share.sw}
              </button>
            </div>
          </>
        )}

        <div style={{ flex:1 }} />
      </div>

      <div style={{ padding:"0 20px" }}>
        <Link href="/" className="btn-primary" style={{ textDecoration:"none" }}>
          {COPY.buttons.home.sw}
        </Link>
      </div>
    </main>
  );
}

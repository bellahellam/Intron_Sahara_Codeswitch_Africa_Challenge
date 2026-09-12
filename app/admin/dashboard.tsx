/**
 * The live telemetry dashboard. Everything the CHP's screen deliberately hides.
 *
 * Aimed at whoever is evaluating whether the system works — a judge, a supervisor, a clinician
 * auditing the pipeline. It is in English, unlike every other screen, because it is not used in a
 * household.
 *
 * The section that matters most is the canaries: items the model produced and the code threw
 * away. A product that quotes a mother saying things she did not say fails silently unless someone
 * is counting, so the count is the first thing on the page after configuration.
 *
 * Pure presentation. Authentication and the query both happen once, server-side, in
 * app/admin/page.tsx — this component only renders what it is handed.
 */

import type { AdminOverview } from "@/lib/admin/get-admin-data";

export function AdminDashboard({ data }: { data: AdminOverview }) {
  const { config, canaries } = data;
  const liveTranscripts = data.turns.filter((t) => !t.transcriptPurged);

  return (
    <div className="space-y-6">
      {/* ---- Canaries first. These are what fail silently if nobody counts. ---- */}
      <section className="space-y-2">
        <p className="text-label m-0">Pipeline canaries</p>
        <p className="text-sm text-neutral-700">
          Items the model produced and the code threw away. A product that quotes a mother saying
          things she did not say fails silently unless someone is counting.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Hallucinated spans dropped" value={canaries.spanValidationFailures} danger />
          <Stat label="CHP's own words suppressed" value={canaries.knownPromptSuppressed} />
          <Stat label="Somatic backstop fired" value={canaries.somaticBackstopFired} />
          <Stat label="Extraction failed" value={canaries.extractionFailed} />
          <Stat label="Safety escalations" value={canaries.safetyHits} danger />
          <Stat label="Consent gate rejections" value={canaries.consentGateRejections} />
        </div>
      </section>

      {/* ---- Configuration ---- */}
      <section className="space-y-2">
        <p className="text-label m-0">Live configuration</p>
        <dl className="card space-y-1 text-sm">
          <Row k="ASR" v={`${config.asrProvider} · LLM corrections ${config.saharaCorrections}`} />
          <Row k="Extraction" v={`${config.llmProvider} · ${config.llmModel}`} />
          <Row
            k="Deletion floor"
            v={
              config.deletionFloor.derived
                ? `${config.deletionFloor.floor} chars/s (derived, n=${config.deletionFloor.n})`
                : `${config.deletionFloor.floor} chars/s — NOT DERIVED`
            }
            warn={!config.deletionFloor.derived}
          />
          <Row
            k="Safety lexicon"
            v={`${config.safetyLexicon.reviewed}/${config.safetyLexicon.total} clinician-reviewed`}
            warn={!config.safetyLexicon.allReviewed}
          />
        </dl>
        {config.asrProvider === "mock" && (
          <p className="rounded-md border-2 border-danger bg-white p-3 text-sm font-medium text-danger">
            ASR_PROVIDER is set to mock. Transcripts are FIXTURES, not real speech. Never demo in
            this state.
          </p>
        )}
      </section>

      {/* ---- Per-turn telemetry ---- */}
      <section className="space-y-2">
        <p className="text-label m-0">Per-turn telemetry</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-1 pr-3">turn</th>
                <th className="pr-3">model</th>
                <th className="pr-3">ASR ms</th>
                <th className="pr-3">cps</th>
                <th className="pr-3">items</th>
                <th className="pr-3">dropped</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.turns.slice(0, 25).map((t) => (
                <tr key={`${t.sessionId}-${t.idx}`} className="border-t border-neutral-200">
                  <td className="py-1 pr-3">{t.idx}</td>
                  <td className="pr-3">{t.asrModel ?? "—"}</td>
                  <td className="pr-3">{t.asrLatencyMs ?? "—"}</td>
                  <td className={`pr-3 ${t.deletionSuspected ? "font-semibold text-warning" : ""}`}>
                    {t.cps ?? "—"}
                  </td>
                  <td className="pr-3">{t.itemsProduced}</td>
                  <td className={`pr-3 ${t.itemsDropped > 0 ? "font-semibold text-danger" : ""}`}>
                    {t.itemsDropped > 0 ? `${t.itemsDropped} (${t.dropReasons.join(", ")})` : "0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Transcripts, with the retention boundary stated rather than hidden ---- */}
      <section className="space-y-2">
        <p className="text-label m-0">Transcripts</p>
        <p className="rounded-md bg-neutral-200 p-3 text-sm text-neutral-700">{data.transcriptPolicy}</p>
        <p className="text-sm text-neutral-700">
          <span className="tabular font-medium">{data.retentionCounts.retainedByConsent}</span> of{" "}
          <span className="tabular font-medium">{data.retentionCounts.totalSessions}</span> sessions
          opted in. A high rate is worth looking at — it would suggest the ask is not landing as
          optional.
        </p>
        {liveTranscripts.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No sessions in progress. Every completed session&apos;s transcripts have been destroyed —
            that is the designed behaviour, not missing data.
          </p>
        ) : (
          <div className="space-y-2">
            {liveTranscripts.map((t) => (
              <div key={`${t.sessionId}-${t.idx}`} className="card">
                <p className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span>
                    {t.sessionId.slice(0, 8)} · turn {t.idx} · {(t.durationMs / 1000).toFixed(1)}s
                  </span>
                  {t.retainedByConsent ? (
                    <span className="rounded bg-success/10 px-2 py-0.5 font-medium text-success">
                      retained — she agreed
                    </span>
                  ) : (
                    <span className="rounded bg-neutral-200 px-2 py-0.5 font-medium">
                      session in progress
                    </span>
                  )}
                </p>
                <p className="text-sm text-neutral-900">{t.transcript}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Sessions ---- */}
      <section className="space-y-2">
        <p className="text-label m-0">Sessions ({data.sessions.length})</p>
        <div className="space-y-1">
          {data.sessions.slice(0, 20).map((s) => (
            <div key={s.id} className="card flex items-center justify-between text-sm">
              <span>
                <span className="font-medium">{s.mother}</span>
                <span className="text-neutral-500">
                  {" "}
                  · {s.chpCode} · {s.turnCount} turns
                </span>
              </span>
              <span className="flex gap-2">
                {s.escalated && (
                  <span className="rounded bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                    escalated
                  </span>
                )}
                {!s.consentGranted && (
                  <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs">no consent</span>
                )}
                <span className="text-xs text-neutral-500">{s.status}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Records ---- */}
      <section className="space-y-2">
        <p className="text-label m-0">Screening records ({data.records.length})</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-1 pr-3">PHQ-9</th>
                <th className="pr-3">band</th>
                <th className="pr-3">GAD-7</th>
                <th className="pr-3">tier</th>
                <th className="pr-3">rule</th>
                <th className="pr-3">flags</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.records.slice(0, 20).map((r) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="py-1 pr-3">{r.scores.phq9 ?? "—"}</td>
                  <td className="pr-3">{r.scores.phq9Band ?? "—"}</td>
                  <td className="pr-3">{r.scores.gad7 ?? "—"}</td>
                  <td className="pr-3">{r.referral.tier ?? "—"}</td>
                  <td className="pr-3">{r.referral.ruleApplied ?? "—"}</td>
                  <td className="pr-3">
                    {r.risk.flagged && <span className="text-danger">risk </span>}
                    {r.referral.incomplete && <span className="text-warning">incomplete</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Audit ---- */}
      <section className="space-y-2">
        <p className="text-label m-0">Audit trail</p>
        <p className="text-sm text-neutral-700">
          Records what happened, never what she said. No transcript, quote, name or age enters an
          audit payload — <code>audit()</code> throws if one does.
        </p>
        <div className="card space-y-1 text-xs">
          {Object.entries(data.auditByKind)
            .sort((a, b) => b[1] - a[1])
            .map(([kind, count]) => (
              <div key={kind} className="flex justify-between">
                <span>{kind}</span>
                <span className="tabular font-medium">{count}</span>
              </div>
            ))}
        </div>
      </section>

      {/* ---- Anonymous counters ---- */}
      {data.anonymousCounters.length > 0 && (
        <section className="space-y-2">
          <p className="text-label m-0">Anonymous counters</p>
          <p className="text-sm text-neutral-700">
            No identifier, no content, no timestamp finer than the day. They exist so a pilot can
            detect whether the escalation screen is frightening people into withdrawing.
          </p>
          <div className="card space-y-1 text-xs">
            {data.anonymousCounters.map((c) => (
              <div key={`${c.kind}-${c.day}`} className="flex justify-between">
                <span>
                  {c.kind} · {c.day}
                </span>
                <span className="tabular font-medium">{c.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="card">
      <p className={`tabular text-2xl font-semibold ${danger && value > 0 ? "text-danger" : "text-neutral-900"}`}>
        {value}
      </p>
      <p className="text-xs text-neutral-700">{label}</p>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-700">{k}</dt>
      <dd className={`text-right font-medium ${warn ? "text-warning" : "text-neutral-900"}`}>{v}</dd>
    </div>
  );
}

"use client";

/**
 * The three post-visit steps (Kagua, Matokeo, Rufaa), named and visible, so `Maliza` does not
 * route through screens with no indication that more are coming.
 *
 * Step 3 only exists for a tier that needs a facility referral. For a CHP-followup tier there is
 * nothing to send, so it is shown struck through and dashed rather than silently omitted — the
 * CHP sees that a step was skipped on purpose, not that the app lost a screen.
 */

const STEPS = [
  { n: 1, label: "Kagua" },
  { n: 2, label: "Matokeo" },
  { n: 3, label: "Rufaa" },
] as const;

export function StepIndicator({ current, skipStep3 }: { current: 1 | 2 | 3; skipStep3?: boolean }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", padding:"13px 16px",
      borderBottom:"1px solid #F0ECF8", background:"#FCFBFF",
    }}>
      {STEPS.map((step, i) => {
        const skipped = step.n === 3 && skipStep3;
        const done = step.n < current && !skipped;
        const active = step.n === current;
        return (
          <div key={step.n} style={{ display:"contents" }}>
            {i > 0 && (
              <span aria-hidden style={{ flex:1, height:1, margin:"0 8px", background: skipped ? "#EFEAF8" : "#E0D8EF" }} />
            )}
            <span style={{
              display:"inline-flex", alignItems:"center", gap:6,
              font: `${active ? 700 : 600} 11px Inter, system-ui, sans-serif`,
              color: skipped ? "#CFC8DA" : active ? "#6D28D9" : done ? "#6D28D9" : "#A49BB5",
              textDecoration: skipped ? "line-through" : "none",
              opacity: skipped ? 0.7 : 1,
            }}>
              <span style={{
                display:"grid", placeItems:"center", width:19, height:19, borderRadius:"50%",
                fontSize:10, textDecoration:"none",
                background: active ? "#7C3AED" : done ? "#EDE9FE" : "transparent",
                color: active ? "#fff" : done ? "#6D28D9" : skipped ? "#DDD6E8" : "#A49BB5",
                border: active || done ? "none" : `1px ${skipped ? "dashed" : "solid"} ${skipped ? "#DDD6E8" : "#D5CCE5"}`,
              }}>
                {done ? "✓" : step.n}
              </span>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

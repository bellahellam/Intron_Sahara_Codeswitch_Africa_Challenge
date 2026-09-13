/**
 * Minimal, dependency-free chart primitives for the two English-only, admin-facing pages
 * (S9 admin telemetry, S10 the benchmark). No charting library: these are the two shapes the
 * data actually needs, built as plain SVG/HTML so they fit the same 360px-wide shell as
 * everything else.
 */

/**
 * A horizontal bar list: magnitude by category, one series. Sorted by the caller — this
 * component only draws what it's given, in that order.
 *
 * One entity can be highlighted (the product's own shipped configuration among a set of
 * comparison models), which replaces the categorical-palette problem entirely: rather than
 * finding N distinct CVD-safe hues for N models, every bar is muted except the one the reader
 * should actually compare against, in the product's own accent colour.
 */
export function BarList({
  items,
  format,
}: {
  items: Array<{ label: string; value: number; highlight?: boolean; sub?: string }>;
  format?: (value: number) => string;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-neutral-700">
              {item.label}
              {item.sub && <span className="ml-1.5 text-neutral-400">{item.sub}</span>}
            </span>
            <span className="tabular shrink-0 font-semibold text-neutral-900">
              {format ? format(item.value) : item.value}
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-neutral-100">
            <div
              className={`h-2 rounded-full ${item.highlight ? "bg-primary" : "bg-neutral-400"}`}
              style={{ width: `${Math.max(3, (Math.abs(item.value) / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A stat tile with an optional status edge — the "something to watch" signal is a colour
 *  bar, not a wall of red text, so a healthy dashboard reads calm at a glance. */
export function StatTile({
  label,
  value,
  status,
}: {
  label: string;
  value: number | string;
  /** "critical" and "warning" only render their colour when the value is truthy/non-zero;
   *  callers pass status conditionally rather than this component guessing at 0. */
  status?: "critical" | "warning" | "good" | "neutral";
}) {
  const edge =
    status === "critical" ? "bg-danger" : status === "warning" ? "bg-warning" : status === "good" ? "bg-success" : "bg-neutral-200";
  const text = status === "critical" ? "text-danger" : status === "warning" ? "text-warning" : "text-neutral-900";
  return (
    <div className="card relative overflow-hidden pl-4">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${edge}`} />
      <p className={`tabular text-2xl font-semibold ${text}`}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

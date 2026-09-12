import Link from "next/link";
import { Header } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

const controls = [
  { number: "01", title: "Consent gate", body: "Audio can only be processed after recorded consent. A declined or withdrawn session cannot continue." },
  { number: "02", title: "Safety escalation", body: "A deterministic scan runs on each raw transcript; an escalation is latched and cannot be lowered later." },
  { number: "03", title: "Evidence before score", body: "Only verbatim, validated evidence can inform a construct. Low-confidence content stays out of scoring." },
  { number: "04", title: "Data lifecycle", body: "Audio is request-scoped; completed-session transcripts are purged after the referral record is written." },
];

export const metadata = { title: "Administration — MAMA-SAUTI" };

export default async function AdminPage() {
  await requireAdmin();

  return (
    <main className="flex min-h-full flex-col pb-8">
      <Header title="Administration" back="/" />
      <div className="flex-1 space-y-5 px-4 pt-5">
        <section className="admin-hero">
          <p className="text-label m-0 text-primary">Administrator workspace</p>
          <h1>Operations, safety and quality controls.</h1>
          <p>This view is limited to administrators. Community health workers see only the screening tools and records required for care.</p>
        </section>

        <section className="card space-y-4">
          <div>
            <p className="text-label m-0">Under the hood</p>
            <p className="mt-2 mb-0 text-sm leading-relaxed text-neutral-700">The workflow is intentionally visible here so administrators can audit what the product does before, during and after a screening.</p>
          </div>
          <div className="admin-control-list">
            {controls.map((control) => (
              <article className="admin-control" key={control.number}>
                <span>{control.number}</span>
                <div>
                  <h2>{control.title}</h2>
                  <p>{control.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-benchmark">
          <div>
            <p className="text-label m-0 text-primary">Quality review</p>
            <h2>Benchmark comparisons</h2>
            <p>Inspect the decision-impact benchmark and its methodology without exposing it in the field-user workflow.</p>
          </div>
          <Link href="/sahara" className="btn-primary no-underline">Open benchmark comparison</Link>
        </section>
      </div>
    </main>
  );
}

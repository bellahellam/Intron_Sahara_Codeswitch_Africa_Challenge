"use client";

/**
 * S5 Hatari (Escalation) — §15.4, FR-25.
 *
 * Purpose: get Grace's attention off the phone and onto the person, fast. The instruction is to
 * attend to the person, not to the phone.
 *
 * This component renders ENTIRELY from bundled local data. Contacts, hours, costs and scripts are
 * in the bundle, not fetched — so it works with no network at all (§14.4a Tier 0). That is the
 * product's most concrete accessibility claim and it must not regress into a fetch.
 *
 * THE PRIVACY CONTROL AT STEP 2 IS NOT A SMALL POINT. §15.4 originally specified this screen as
 * the highest-contrast, largest-type object in the product, legible across a room — in a one-room
 * home with a husband, children and neighbours audible. As specified, the screen displaying her
 * verbatim suicide disclosure was the most legible object in the room to everyone except her.
 * The two-tap fix must not be cut.
 */

import { useState } from "react";
import { COPY } from "@/lib/copy";
import contactsData from "@/data/crisis_contacts.json";

export interface EscalationTrigger {
  /**
   * EVERY phrase that triggered, not just the first. Several lexicon entries routinely fire on
   * one disclosure (an explicit form and a hedged form in the same breath), and showing only one
   * would mean picking a "best" quote by heuristic. The CHP is the one who has to judge what she
   * just heard, so she sees all of it.
   */
  matchedTexts: string[];
  source: "deterministic_lexicon" | "llm_risk_flag" | "manual" | "item_9";
  failedClosed?: boolean;
}

interface Contact {
  order: number;
  id: string;
  service_sw: string;
  service_en: string;
  number: string | null;
  configurable_per_chu?: boolean;
  scope_sw: string;
  cost_sw: string;
  hours_sw: string;
  hours_24h: boolean;
  opens_hour: number;
  closes_hour: number;
  read_aloud: boolean;
  immediate_danger_only: boolean;
  caveat_sw?: string | null;
  alt_number?: string;
}

export function Escalation({
  trigger,
  onAcknowledge,
  onWithdraw,
  linkFacilityNumber,
}: {
  trigger: EscalationTrigger;
  onAcknowledge: (quoteSuppressed: boolean) => void;
  onWithdraw: () => void;
  linkFacilityNumber?: string | null;
}) {
  // Step 2 must be answered before anything else is revealed. `null` = not yet asked.
  const [othersCanSee, setOthersCanSee] = useState<boolean | null>(null);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const suppressQuote = othersCanSee === true;
  const contacts = (contactsData.contacts as Contact[]).slice().sort((a, b) => a.order - b.order);
  const hour = new Date().getHours();

  return (
    <div className="animate-escalate fixed inset-0 z-50 overflow-y-auto bg-escalation text-white">
      <div className="mx-auto min-h-full w-full max-w-md px-4 py-8 space-y-6">
        {/* 1. The instruction is to attend to the person, not to the phone. */}
        <div>
          <h1 className="text-3xl font-bold leading-tight">{COPY.states.escalated.sw}</h1>
          <p className="mt-1 text-base text-white/80">{COPY.states.escalated.en}</p>
        </div>

        {trigger.failedClosed && (
          <div className="rounded-lg border-2 border-white/60 p-3 text-base">
            Ukaguzi wa usalama haukukamilika, kwa hivyo tumeonyesha onyo hili kwa tahadhari.
            <span className="mt-1 block text-sm text-white/80">
              The safety scan did not complete, so this warning was raised as a precaution. A scan
              that did not finish is treated as a hit, never as a pass.
            </span>
          </div>
        )}

        {/* 2. A privacy control BEFORE anything else is revealed. */}
        {othersCanSee === null ? (
          <div className="rounded-lg border-2 border-white p-4 space-y-4">
            <p className="text-aloud text-white">Kuna mtu mwingine anaweza kuona skrini?</p>
            <p className="text-sm text-white/80">Can anyone else see the screen?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOthersCanSee(false)}
                className="h-14 flex-1 rounded-lg bg-white font-semibold text-escalation"
              >
                Hapana
              </button>
              <button
                type="button"
                onClick={() => setOthersCanSee(true)}
                className="h-14 flex-1 rounded-lg border-2 border-white font-semibold text-white"
              >
                Ndiyo
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 3. The matched verbatim quote, unless suppressed at step 2. */}
            <div className="rounded-lg bg-white/10 p-4">
              {suppressQuote ? (
                <p className="text-aloud text-white">Amesema jambo linalohitaji msaada wa haraka.</p>
              ) : trigger.matchedTexts.length > 0 ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-white/70">Aliyosema</p>
                  {dedupe(trigger.matchedTexts).map((text) => (
                    <p key={text} className="mt-1 border-l-4 border-white pl-3 text-aloud text-white">
                      {text}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-aloud text-white">
                  Hatukuweza kuthibitisha maneno kamili, lakini alama ya hatari inasimama.
                  <span className="mt-1 block text-sm text-white/80">
                    We could not verify the exact wording. The risk flag stands regardless.
                  </span>
                </p>
              )}
            </div>

            {/* 4. The CHP script, including the Kenya legal-status line. */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-white/70">Soma kwa sauti</p>
              <p className="text-aloud text-white">{COPY.escalationScript.sw}</p>
              <p className="text-sm text-white/70">{COPY.escalationScript.en}</p>
              <p className="text-aloud text-white">{COPY.safeguardingLine.sw}</p>
              <p className="text-sm text-white/70">{COPY.safeguardingLine.en}</p>
            </div>

            {/* 5–6. Contacts. Facility first, because rule 1 has just routed facility_urgent. */}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-white/70">Msaada</p>
              {contacts
                .filter((c) => !c.immediate_danger_only)
                .map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    hour={hour}
                    override={c.id === "link_facility" ? linkFacilityNumber ?? null : null}
                  />
                ))}

              <p className="pt-3 text-xs uppercase tracking-wide text-white/70">
                Kwa dharura ya papo hapo pekee
              </p>
              {contacts
                .filter((c) => c.immediate_danger_only)
                .map((c) => (
                  <ContactRow key={c.id} contact={c} hour={hour} override={null} />
                ))}
            </div>

            {/* 7. Acknowledge. Deliberately not the only control on the screen — a single-control
                   screen produces reflex taps (§21.7), which is why step 2 sits above it. */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => onAcknowledge(suppressQuote)}
                className="h-14 w-full rounded-lg bg-white font-semibold text-escalation"
              >
                {COPY.buttons.spokenWithHer.sw}
              </button>

              {/* FR-27. Withdrawal wins on data, and it is offered AFTER the safeguarding line
                  above has told her that Grace's obligation does not live in the database. */}
              {confirmingWithdraw ? (
                <div className="rounded-lg border-2 border-white p-4 space-y-3">
                  <p className="text-base">{COPY.withdrawalConfirm.sw}</p>
                  <p className="text-sm text-white/80">{COPY.withdrawalConfirm.en}</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={onWithdraw}
                      className="h-14 flex-1 rounded-lg border-2 border-white font-semibold text-white"
                    >
                      {COPY.buttons.deleteEverything.sw}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingWithdraw(false)}
                      className="h-14 flex-1 rounded-lg bg-white font-semibold text-escalation"
                    >
                      Hapana
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingWithdraw(true)}
                  className="h-12 w-full text-sm text-white/80 underline"
                >
                  {COPY.buttons.deleteEverything.sw} <span className="not-italic">(she asks us to stop)</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Drop duplicates and any quote wholly contained in a longer one, so the CHP reads each
 *  triggering phrase once rather than three overlapping versions of the same sentence. */
function dedupe(texts: string[]): string[] {
  const unique = [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
  return unique
    .filter((t) => !unique.some((other) => other !== t && other.includes(t)))
    .slice(0, 4);
}

/**
 * Each row shows the number, the service, its operating hours AND its cost — because a CHP who
 * taps an 08:00–22:00 line at 22:30 reaches nothing at the worst possible moment, and because
 * §4.1 establishes that her airtime is prepaid and rationed.
 */
function ContactRow({ contact, hour, override }: { contact: Contact; hour: number; override: string | null }) {
  const number = override ?? contact.number;
  const open = contact.hours_24h || (hour >= contact.opens_hour && hour < contact.closes_hour);

  if (!number) {
    // The link facility is configured per CHU. Saying so is better than showing a dead row.
    return (
      <div className="rounded-lg border border-white/40 p-3 text-sm text-white/70">
        <span className="block font-semibold text-white">{contact.service_sw}</span>
        Nambari haijawekwa kwa eneo hili. Uliza msimamizi wako.
        <span className="block text-xs">This CHU&apos;s facility number has not been configured.</span>
      </div>
    );
  }

  return (
    <a
      href={`tel:${number}`}
      className={[
        "flex items-center justify-between rounded-lg border-2 p-3",
        open ? "border-white bg-white/10" : "border-white/30 bg-transparent opacity-60",
      ].join(" ")}
    >
      <span>
        <span className="block text-xl font-bold tabular">{number}</span>
        <span className="block text-sm">{contact.service_sw}</span>
        <span className="block text-xs text-white/70">{contact.scope_sw}</span>
        {contact.caveat_sw && <span className="block text-xs text-white/90">! {contact.caveat_sw}</span>}
      </span>
      <span className="text-right text-xs text-white/80">
        <span className="block">{contact.cost_sw}</span>
        <span className="block">{contact.hours_sw}</span>
        {!open && <span className="block font-semibold">Imefungwa sasa</span>}
      </span>
    </a>
  );
}

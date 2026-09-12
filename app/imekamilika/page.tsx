"use client";

/**
 * S9 Imekamilika (Ended / declined) — §15.3.
 *
 * A clean exit. The whole point of this screen is to state plainly what was NOT kept, because
 * every promise on the consent screen was about deletion and a silent exit would leave the CHP
 * unable to tell the mother what happened.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { COPY } from "@/lib/copy";

function Ended() {
  const reason = useSearchParams().get("reason");

  const message =
    reason === "withdrawn"
      ? {
          sw: "Kila kitu cha kikao hiki kimefutwa. Hakuna kilichohifadhiwa.",
          en: "Everything from this session has been deleted. Nothing was kept.",
        }
      : reason === "declined"
        ? {
            sw: "Hakuna kilichohifadhiwa. Asante kwa kumuuliza.",
            en: "Nothing was stored. Thank you for asking her.",
          }
        : { sw: "Kikao kimekamilika.", en: "The session has ended." };

  return (
    <main className="flex min-h-screen flex-col justify-between px-4 py-10">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-neutral-900">{message.sw}</h1>
        <p className="gloss not-italic">{message.en}</p>
        {reason === "withdrawn" && (
          <div className="card mt-6 space-y-2">
            {/* The CHP's obligation is not deleted, because it was never a database row. */}
            <p className="aloud">{COPY.safeguardingLine.sw}</p>
            <p className="gloss">{COPY.safeguardingLine.en}</p>
          </div>
        )}
      </div>
      <Link href="/" className="btn-primary flex items-center justify-center">
        {COPY.buttons.home.sw}
      </Link>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="p-4">...</main>}>
      <Ended />
    </Suspense>
  );
}

/**
 * Quote selection for the two generated surfaces.
 *
 * One rule, and it exists because of a live observation: a mother's sentence appeared in the
 * handover twice — once as "na mawazo mengi sana" and once inside the longer clause that contains
 * it — because two constructs were evidenced by overlapping spans and dedupe was exact-match only.
 *
 * To a clinician skimming in fifteen seconds that reads as two separate disclosures. In the
 * back-read it is worse: she hears her own sentence said back to her twice, which sounds like the
 * tool misheard her, and costs exactly the trust the back-read exists to build.
 */

export interface Quote {
  construct: string;
  span: string;
}

/**
 * Drop any quote wholly contained in a longer one, then any exact duplicate. The longest form
 * survives because it is the most complete thing she actually said.
 */
export function dedupeQuotes(quotes: Quote[], limit = 6): Quote[] {
  const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

  // Longest first, so a contained shorter span is always the one dropped.
  const sorted = quotes.slice().sort((a, b) => b.span.length - a.span.length);
  const kept: Quote[] = [];

  for (const quote of sorted) {
    const candidate = norm(quote.span);
    if (!candidate) continue;
    if (kept.some((k) => norm(k.span).includes(candidate))) continue;
    kept.push(quote);
  }

  // Restore the original order: her words should reach the reader in the order she said them.
  const order = new Map(quotes.map((q, i) => [q.span, i]));
  return kept.sort((a, b) => (order.get(a.span) ?? 0) - (order.get(b.span) ?? 0)).slice(0, limit);
}

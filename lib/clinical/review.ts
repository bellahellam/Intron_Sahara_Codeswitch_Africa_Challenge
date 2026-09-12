/**
 * Human review of extraction — contested-construct resolution and the scored item set.
 *
 * Coverage latches CONTESTED and will not un-latch itself. The CHP choosing which quote
 * stands (or neither) is the only path that clears it, and it runs here, before scoring.
 */

import { isConstructId, type ConstructId } from "./constructs";
import {
  applyContestedResolutions,
  bandForConfidence,
  contestedResolutionsFromItems,
  type ContestedResolution,
  type CoverageMap,
  type ReviewItemState,
} from "./coverage";
import type { ScoredItem } from "./score";

export interface StoredEvidence {
  construct: string;
  evidence_span: string;
  severity_estimate: number;
  confidence: number;
  somatic_only: boolean;
}

export function prepareReviewScoring(input: {
  coverage: CoverageMap;
  stored: readonly StoredEvidence[];
  clientItems: readonly ReviewItemState[];
}): {
  coverage: CoverageMap;
  scored: ScoredItem[];
  stillContested: ConstructId[];
  resolutions: ContestedResolution[];
  quoteSpans: Array<{ construct: string; span: string }>;
} {
  const resolutions = contestedResolutionsFromItems(input.coverage, input.clientItems, input.stored);
  const coverage = applyContestedResolutions(input.coverage, resolutions);
  const standing = new Map(resolutions.map((r) => [r.construct, r.standingSpan] as const));
  const clientState = new Map(input.clientItems.map((s) => [`${s.construct}::${s.evidence_span}`, s]));

  const scored: ScoredItem[] = [];
  const quoteSpans: Array<{ construct: string; span: string }> = [];

  for (const item of input.stored) {
    if (!isConstructId(item.construct)) continue;
    if (item.somatic_only) continue;
    const band = bandForConfidence(item.confidence);
    if (band === "low") continue;
    if (coverage[item.construct] === "CONTESTED") continue;

    if (standing.has(item.construct)) {
      const span = standing.get(item.construct);
      if (span == null || item.evidence_span !== span) continue;
      scored.push({
        construct: item.construct,
        severity: item.severity_estimate,
        confirmedByChp: true,
        motherDisputed: false,
      });
      quoteSpans.push({ construct: item.construct, span: item.evidence_span });
      continue;
    }

    const state = clientState.get(`${item.construct}::${item.evidence_span}`);
    const motherDisputed = state?.disputed === true;
    scored.push({
      construct: item.construct,
      severity: item.severity_estimate,
      confirmedByChp: band === "high" ? true : state?.confirmed === true,
      motherDisputed,
    });
    if (!motherDisputed) quoteSpans.push({ construct: item.construct, span: item.evidence_span });
  }

  const stillContested = (Object.entries(coverage) as Array<[ConstructId, (typeof coverage)[ConstructId]]>)
    .filter(([, state]) => state === "CONTESTED")
    .map(([id]) => id);

  return { coverage, scored, stillContested, resolutions, quoteSpans };
}

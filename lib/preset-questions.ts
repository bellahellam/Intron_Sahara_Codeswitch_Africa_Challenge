/**
 * Five evidence-based preset questions for the MVP interview.
 *
 * Grounded in:
 *   - PHQ-9 (Kroenke & Spitzer 2001) — items 1-2, 6, 9 adapted
 *   - Edinburgh Postnatal Depression Scale (Cox et al. 1987) — items 1, 3
 *   - Perinatal Mental Health clinical interview guidance (WHO mhGAP 2016)
 *
 * Phrased in colloquial Kenyan Kiswahili, not formal sanifu.
 * ⚠️ Pending native Kenyan Kiswahili review before submission (see LIMITATIONS.md).
 *
 * These replace LLM-generated probes for the MVP. The full agentic probe
 * generation (lib/agent/probe.ts) is retained and can be re-enabled later.
 */

export interface PresetQuestion {
  /** Sequential index, 0-based. */
  index: number;
  sw: string;
  en: string;
  /** Which PHQ-9/GAD-7 domain this primarily covers — for logging only, not shown to CHP. */
  domain: string;
}

export const PRESET_QUESTIONS: PresetQuestion[] = [
  {
    index: 0,
    sw: "Tangu ujifungue, umekuwa ukijisikiaje? Niambie tu vile mambo yamekuwa.",
    en: "Since you gave birth, how have you been feeling? Just tell me how things have been.",
    domain: "opening",
  },
  {
    index: 1,
    sw: "Je, umekuwa ukijisikia huzuni au kukata tamaa — kama hakuna kitu kinachokufurahisha tena?",
    en: "Have you been feeling sad or hopeless — like nothing brings you joy anymore?",
    domain: "phq9_depressed_mood",
  },
  {
    index: 2,
    sw: "Je, umelala vizuri? Umekuwa ukiamka usiku au kulala sana — zaidi ya kawaida?",
    en: "Have you been sleeping well? Have you been waking at night or sleeping too much — more than usual?",
    domain: "phq9_sleep",
  },
  {
    index: 3,
    sw: "Je, umekuwa ukijihisi na nguvu za kujali mtoto na mambo ya nyumbani, au umechoka sana?",
    en: "Have you had the energy to care for your baby and manage things at home, or have you been very tired?",
    domain: "phq9_fatigue",
  },
  {
    index: 4,
    sw: "Wakati mwingine akina mama wanafikiri wangehangaika au kujidhuru. Je, umewahi kupata mawazo kama hayo?",
    en: "Sometimes mothers have thoughts of harming themselves or not wanting to be here. Have you had any thoughts like that?",
    domain: "phq9_item9",
  },
];

export const TOTAL_QUESTIONS = PRESET_QUESTIONS.length;

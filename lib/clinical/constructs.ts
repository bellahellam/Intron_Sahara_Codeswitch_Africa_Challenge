/**
 * The fixed construct set. Part of Contract 2 (docs/contracts.md): `construct` values are an
 * enumeration, not free text, so extraction output can never invent a clinical target.
 *
 * PHQ-9 and GAD-7 are free to use: verified at https://www.phqscreeners.com/terms —
 * "Content found at the PHQ Screeners site is expressly exempted from Pfizer's general
 * copyright restrictions ... free for download and use." No fee, no permission (§20.5).
 */

export type Instrument = "PHQ9" | "GAD7";

/** Shape check for the table below. Kept separate from `ConstructDef` so that `ConstructId`,
 *  which is derived FROM the table, does not circularly reference the type that describes it. */
interface ConstructDefShape {
  id: string;
  instrument: Instrument;
  /** 1-based item number within its instrument. */
  itemNumber: number;
  /** Machine name, matches the spec's `construct` field examples. */
  construct: string;
  /** Kiswahili label shown on evidence cards and coverage pips. Never a clinical label (§10.9). */
  labelSw: string;
  labelEn: string;
  /** True for the PHQ-2 / GAD-2 stem items, which gate everything (§11.6). */
  isStem: boolean;
}

export const CONSTRUCTS = [
  { id: "phq9_1", instrument: "PHQ9", itemNumber: 1, construct: "anhedonia", labelSw: "Kukosa furaha", labelEn: "Little interest or pleasure", isStem: true },
  { id: "phq9_2", instrument: "PHQ9", itemNumber: 2, construct: "depressed_mood", labelSw: "Kusikitika", labelEn: "Feeling down", isStem: true },
  { id: "phq9_3", instrument: "PHQ9", itemNumber: 3, construct: "sleep_disturbance", labelSw: "Usingizi", labelEn: "Sleep", isStem: false },
  { id: "phq9_4", instrument: "PHQ9", itemNumber: 4, construct: "fatigue", labelSw: "Nguvu na uchovu", labelEn: "Energy and fatigue", isStem: false },
  { id: "phq9_5", instrument: "PHQ9", itemNumber: 5, construct: "appetite", labelSw: "Hamu ya kula", labelEn: "Appetite", isStem: false },
  { id: "phq9_6", instrument: "PHQ9", itemNumber: 6, construct: "self_worth", labelSw: "Kujiona vibaya", labelEn: "Feeling bad about yourself", isStem: false },
  { id: "phq9_7", instrument: "PHQ9", itemNumber: 7, construct: "concentration", labelSw: "Kuzingatia", labelEn: "Concentration", isStem: false },
  { id: "phq9_8", instrument: "PHQ9", itemNumber: 8, construct: "psychomotor", labelSw: "Kusonga polepole au kutotulia", labelEn: "Moving slowly or restlessness", isStem: false },
  { id: "phq9_9", instrument: "PHQ9", itemNumber: 9, construct: "self_harm_ideation", labelSw: "Mawazo ya kujidhuru", labelEn: "Thoughts of self-harm", isStem: false },
  { id: "gad7_1", instrument: "GAD7", itemNumber: 1, construct: "nervousness", labelSw: "Wasiwasi", labelEn: "Feeling nervous or on edge", isStem: true },
  { id: "gad7_2", instrument: "GAD7", itemNumber: 2, construct: "uncontrollable_worry", labelSw: "Kushindwa kuacha kuwaza", labelEn: "Not being able to stop worrying", isStem: true },
  { id: "gad7_3", instrument: "GAD7", itemNumber: 3, construct: "excessive_worry", labelSw: "Kuwaza mambo mengi", labelEn: "Worrying about many things", isStem: false },
  { id: "gad7_4", instrument: "GAD7", itemNumber: 4, construct: "trouble_relaxing", labelSw: "Kushindwa kupumzika", labelEn: "Trouble relaxing", isStem: false },
  { id: "gad7_5", instrument: "GAD7", itemNumber: 5, construct: "restlessness", labelSw: "Kutotulia", labelEn: "Restlessness", isStem: false },
  { id: "gad7_6", instrument: "GAD7", itemNumber: 6, construct: "irritability", labelSw: "Kukasirika haraka", labelEn: "Easily annoyed", isStem: false },
  { id: "gad7_7", instrument: "GAD7", itemNumber: 7, construct: "apprehension", labelSw: "Kuhofia kitu kibaya", labelEn: "Feeling afraid something awful might happen", isStem: false },
] as const satisfies readonly ConstructDefShape[];

export type ConstructId = (typeof CONSTRUCTS)[number]["id"];

/** The public shape, with `id` narrowed to the enumeration derived from the table above. */
export interface ConstructDef extends ConstructDefShape {
  id: ConstructId;
}

export const CONSTRUCT_IDS: readonly ConstructId[] = CONSTRUCTS.map((c: ConstructDef) => c.id);

const BY_ID = new Map<string, ConstructDef>(CONSTRUCTS.map((c: ConstructDef) => [c.id, c]));

export function getConstruct(id: string): ConstructDef | undefined {
  return BY_ID.get(id);
}

export function isConstructId(id: string): id is ConstructId {
  return BY_ID.has(id);
}

/** PHQ-2 is items 1 and 2. GAD-2 is items 1 and 2. Both gate everything (§11.6). */
export const PHQ2_IDS = ["phq9_1", "phq9_2"] as const satisfies readonly ConstructId[];
export const GAD2_IDS = ["gad7_1", "gad7_2"] as const satisfies readonly ConstructId[];

/** The item the gate in `decide()` exists for. Never ranked, always a precondition (§11.6). */
export const ITEM_9: ConstructId = "phq9_9";

export const PHQ9_IDS: readonly ConstructId[] = CONSTRUCTS.filter((c: ConstructDef) => c.instrument === "PHQ9").map((c: ConstructDef) => c.id);
export const GAD7_IDS: readonly ConstructId[] = CONSTRUCTS.filter((c: ConstructDef) => c.instrument === "GAD7").map((c: ConstructDef) => c.id);

/**
 * Probe priority order, highest clinical value per turn first (§11.6).
 * Item 9 does NOT appear here: it is handled by the gate above `decide()`'s priority list,
 * because suicidal ideation is not conditional on a positive depression screen.
 * Tier 3 (somatic-only constructs) is computed at runtime, not listed statically.
 */
export const PROBE_PRIORITY: readonly ConstructId[] = [
  // 1. PHQ-2 stems
  "phq9_1",
  "phq9_2",
  // 2. GAD-2 stems
  "gad7_1",
  "gad7_2",
  // 4. Remaining PHQ-9, function-first
  "phq9_3",
  "phq9_4",
  "phq9_5",
  "phq9_6",
  "phq9_7",
  "phq9_8",
  // 5. Remaining GAD-7
  "gad7_3",
  "gad7_4",
  "gad7_5",
  "gad7_6",
  "gad7_7",
];

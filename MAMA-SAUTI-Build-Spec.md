# MAMA-SAUTI

## Product Description and Build Specification Document

**Version** 1.0 · **Date** 11 September 2026 · **Status** Implementation-ready · **Owner** Team of 2
**Submission target** Intron Sahara CodeSwitch Africa Challenge, Health track, final submission **15 September 2026**
**Build window** Two people, compressed to a single overnight push. Planned in elapsed hours from T+0, target T+34 to a submittable package (§24)

> This document is the single source of truth. Where it conflicts with a diagram, a chat message, or an earlier draft, this document wins. Every requirement below traces to one of three justifications, marked inline: **[UV]** user value, **[CR]** competition requirement, **[SC]** measurable success criterion.

### Epistemic conventions used throughout

| Tag | Meaning |
|---|---|
| **FACT** | Verified against a primary source, cited inline. Safe to repeat to a judge. |
| **ASSUMPTION** | Inferred to keep momentum. Labelled, falsifiable, and listed in §29.3 so it can be overturned cheaply. |
| **RECOMMENDATION** | Our expert judgement where more than one defensible option exists. Trade-offs shown, one option chosen, used consistently thereafter. |
| ⚠️ **UNVERIFIED** | We could not confirm this. Do not assert it in the submission without checking first. |

---

# 1. Executive Summary

## 1.1 The product in one sentence

**MAMA-SAUTI** is a Community Health Promoter's conversational screening assistant that listens to a Kenyan mother describe how she has been feeling since giving birth, in her own natural mix of Kiswahili and English, and turns that unstructured conversation into a completed, evidence-linked PHQ-9 / GAD-7 screening record with a routed referral, without ever asking her to answer a translated questionnaire item.

## 1.2 Why this problem

**FACT.** In the EPInA stepped-wedge trial across 127 public primary care facilities in Kilifi County covering 5.3 million consultations, baseline depression detection was **1.41 cases per 100,000 consultations** (Bitta et al. 2026, *PLoS One* 21(8):e0352643, [doi:10.1371/journal.pone.0352643](https://doi.org/10.1371/journal.pone.0352643)). Pooled postpartum depression prevalence in sub-Saharan Africa is **22.1% (95% CI 18.5–26.2)** (Nweke et al. 2024, [doi:10.17159/sajs.2024/14197](https://doi.org/10.17159/sajs.2024/14197)).

⚠️ **These two figures are not a ratio and must never be presented as one** (different denominators, different populations, different geographies). §3.3a sets out why in full and gives the wording to use instead. What they jointly support, without arithmetic, is narrower and still damning: **a condition affecting a substantial minority of mothers is being detected at a rate indistinguishable from zero in Kenyan primary care.**

**FACT.** Kenya reports **0.184 psychiatrists per 100,000 population** to the WHO Global Health Observatory (indicator MH_6, 2016), roughly 104 psychiatrists for a population of 56.4 million. Kenya has not reported psychologist, mental-health-nurse or social-worker density to WHO at all.

**FACT.** Kenya's ANC coverage is **97.9% for at least one visit** (WHO GHO, 2022) against roughly **1.5 million live births per year** (derived: World Bank SP.POP.TOTL 56,432,944 × SP.DYN.CBRT.IN 26.968/1,000). Kenya has **~107,000 Community Health Promoters** with government-issued smartphones (MOH, 2023 digital kit distribution). The contact points already exist. The screening does not happen at them.

## 1.3 Why voice, specifically

Three findings, in order of how much weight they carry.

**FACT, and this is the strongest argument in the whole document.** In a Kenyan cohort of 572 women on Jacaranda Health's SMS platform, 32.9% screened EPDS ≥10, and *"women with antenatal or persistent perinatal depressive symptoms sent FEWER SMS messages"* (Hummel et al. 2022, [doi:10.1186/s12884-022-05039-6](https://doi.org/10.1186/s12884-022-05039-6)). **The text channel systematically loses exactly the women it most needs to find.** Depression reduces the effort a person will spend composing a message. Speech costs less effort than typing, and costs nothing at all in literacy.

**FACT.** Cognitive testing of the PHQ-9 with Kenyan pregnant and postpartum women in Thika found that **most participants could not distinguish "several days" from "more than half the days"** (Velloza et al. 2020, *BMC Psychiatry* 20:31, [doi:10.1186/s12888-020-2435-6](https://doi.org/10.1186/s12888-020-2435-6)). They also flagged double-barrelled items ("poor appetite *or* overeating") and irrelevant ones ("watching television"). 52% preferred Kiswahili. A form asks a question the respondent cannot parse. A conversation lets her describe her week and lets the system do the mapping.

**FACT.** Jacaranda Health's own randomised trial states: *"At the time of our study, PROMPTS was solely a text-based platform and did not offer audio support for low-literacy or sight-impaired women"* (Vatsa et al. 2025, *PLoS Med* 22(2):e1004527). The region's flagship maternal platform, reaching ~3 million mothers, has published its own gap statement.

## 1.4 Why code-switching is intrinsic, not decorative

**FACT.** Owidi et al. 2025 ([PMC12680144](https://europepmc.org/articles/PMC12680144)) documents young Kenyan women describing distress in a single utterance set that mixes registers: *"niko na stress"* (Sheng), *"kufikiria sana"* (Kiswahili), *"kitu inanisumbua"*, *"mawazo mengi"*, *"sifeel poa"* (Sheng), *"siko sawa"*. The affective vocabulary is code-switched by default.

**FACT.** Swahili is the most switch-dense language in Intron's own AfriSwitch benchmark: **10.29 switch points per utterance**, the highest of all 14 language pairs, CMI 25.72. In AfriSwitchCare (clinical), Swahili-English shows **96.4 average switch points per conversation and CMI 37.4**, again the highest in the set.

**FACT, and this is our central technical thesis.** The dominant failure mode of ASR on code-switched African speech is **switch-boundary deletion**: the model emits fluent monolingual Kiswahili and silently drops the embedded English. Because embedded English is a token minority, **aggregate WER cannot see this failure**. For a perinatal mental health screener, the words that vanish are precisely `stress`, `depressed`, `anxious`, `overwhelmed`, `I feel low`. The deletion is not uniformly distributed across the vocabulary. It is concentrated on the clinical signal.

That gives MAMA-SAUTI a benchmark contribution nobody else in this competition is positioned to make: **we measure recall on embedded-English spans and on a documented Swahili distress-idiom lexicon, and then we measure whether the resulting PHQ-9 risk band flips.** See §18.

## 1.5 What makes this agentic rather than a transcription demo

The system does not stop at a transcript. Per turn it: scans deterministically for risk language; extracts PHQ-9 and GAD-7 construct evidence with mandatory verbatim quotation; maintains a coverage state of which constructs remain unevidenced; **decides what to ask next and phrases that probe in the mother's own idiom register rather than a translated Likert item**; and on completion produces a structured screening record, a risk band (never a diagnosis), and a referral routed to the correct tier of the Kenyan health system. It chooses between three actions each turn: probe, escalate, or complete. **[CR]**

## 1.6 The five things a judge should remember

1. A named, quantified detection failure (fewer than 2 per 100,000 consultations, in a 5.3-million-consultation sample) at a contact point that already exists, staffed by the system's most numerous cadre (19.8 CHPs per facility against 5.1 clinical officers). ⚠️ Do not pair this with a prevalence rate as a ratio; §3.3a explains why.
2. A published finding that the incumbent channel loses depressed women (Hummel 2022). Voice is not a stylistic preference here.
3. A benchmark metric (Embedded-English Span Recall) that exposes a failure aggregate WER structurally cannot see, computed directly from Intron's own `transcription_tagged` field.
4. A downstream measurement (**PHQ-9 band-flip rate**) that answers the question "does ASR quality actually change the clinical decision?" rather than reporting WER and hoping.
5. A safety layer that is deterministic, runs on the raw transcript rather than on model output, and fails open to a human.

## 1.7 Honest limitations, stated up front

We would rather a judge hear these from us than find them.

- **No criterion-validated Swahili PHQ-9 exists for a perinatal population.** The one Swahili criterion validation is Zanzibari, non-perinatal, and reports AUC 0.69 (Ceccolini et al. 2025, [doi:10.1186/s40359-025-03584-1](https://doi.org/10.1186/s40359-025-03584-1)). That is our psychometric ceiling *before* any ASR error is added. We report against it rather than around it.
- **This is a roughly 34-hour competition build by two people.** It is a working vertical slice with a reproducible benchmark, not a deployed system. §17.10 states exactly what a real pilot would additionally require.
- **The MVP calls a cloud ASR API.** Kenya's Digital Health Act 2023 s.47 restricts offshore transfer of personal health information. Our demo uses only licensed benchmark data and team-recorded synthetic audio, never real patient audio, and §20.3 specifies the in-country deployment path a pilot would need.

---

# 2. Competition Requirements → Product Implications

## 2.1 Source and status of the requirements

**FACT.** Requirements below are taken from [intron.io/compete](https://www.intron.io/compete/) and the 4 August 2026 launch coverage. Judging is on five dimensions: Real-world Impact, Code-switching, Product Quality, Technical Execution, Ethics & Safety.

⚠️ **UNVERIFIED: no judging weights are published.** No rubric or point allocation exists on the site, in the press release, or in any aggregator. **RECOMMENDATION:** treat the five as equally weighted and refuse to under-invest in any one of them. The single published tiebreaker signal is *"Bonus points will be given to solutions addressing a real problem for a meaningful population size"* (§1.2 is written to answer exactly this).

⚠️ **UNVERIFIED, and it affects the model count.** The page contradicts itself: the Challenge Task section says "at least three speech models, including an Intron Sahara API, and at least two others" (= 3 total), while the What to Submit list says "comparing Sahara against **at least three other** speech models" (= 4 total). **RECOMMENDATION: benchmark 4 models (Sahara + 3).** This satisfies both readings at a marginal cost of roughly two hours of harness time. Locked in §18.

**FACT, verified directly on [intron.io/compete](https://www.intron.io/compete/) on 11 Sep 2026: the page contradicts itself on the registration cutoff.** The hero block reads "⏳ Registration closes 15 September 2026"; the Phase 2 timeline reads "14 August 2026 EOI closes. Registration and Expression of Interest deadline." The team is registered, so this is moot for us, but it is the reason not to treat that page as authoritative on process.

**FACT: no submission time-of-day or timezone is published for 15 September.** The Phase 2 entry reads only "Completed solutions and supporting materials are due." Phase 1 by contrast specified "6 August · 1pm WAT", so the omission is a genuine gap rather than an oversight in our reading.

**FACT: no submission portal is named anywhere on the page.** The only form linked is the registration Google Form, which collects team metadata and has no upload fields. **How to submit is therefore an open question, not a formality.**

**ACTION, today.** Ask via both available channels, because neither is a competition-specific address:
- **voice@intron.io** ⚠️ **This is the voice API support address**, published at [docs.voice.intron.io](https://docs.voice.intron.io/docs/index/introduction) ("our support team is available at voice@intron.io"). It is the right channel for API credit and quota questions. It is not advertised as a competitions channel, so do not assume a competition query reaches the right person.
- **[intron.io/contact](https://www.intron.io/contact/)**, the site's general contact form. No competition-specific email address is published anywhere on the challenge page.

Ask three things: how to submit, the deadline timezone, and the participant API credit allowance.

## 2.2 Requirement → implication matrix

| # | Competition Requirement | Product Requirement | Design Implication | Technical Requirement | Evidence Needed in Submission | Risk of Failing It |
|---|---|---|---|---|---|---|
| C1 | Voice is the primary interaction mechanism | The CHP never types clinical content. Speech is the only input carrying screening evidence. | One dominant record control. Typing exists solely for correcting a name or a number, never for entering a symptom. | `MediaRecorder` → WebM/Opus → server proxy → Sahara. No text-entry path into the screening record. | Demo video showing a full screen completed by speech alone. | Building a form with a mic icon bolted on. Judges see this instantly. |
| C2 | Voice must complete a **downstream task**, not stop at transcription | Output is a structured, evidence-linked screening record + risk band + routed referral, persisted and handed over. | The transcript is *not* the hero of any screen. The record is. | JSON schema `ScreeningRecord` v1, persisted to Postgres, rendered as a handover card. | Show the record and the referral, not the transcript, as the demo's climax. | Ending the demo on a transcript. This is the single most common way to lose this competition. |
| C3 | Agentic behaviour | System maintains coverage state and decides each turn between probe / escalate / complete. | A visible "constructs covered" affordance so the CHP sees the agent reasoning. | Turn loop in §11.6 with an explicit decision function, state machine in §17.7, and three terminal actions. | Demo must show the agent generating an unscripted follow-up probe based on what is still missing. | A linear script. If the questions are fixed, it is a form, not an agent. |
| C4 | Code-switching capability | Swahili ⇄ English ⇄ Sheng within a single utterance is the expected input, not an edge case. | No language selector at any point. Selecting a language is the anti-pattern this competition exists to kill. | Sahara `use_language_asr_input="sw"` (the code-switched Swahili-English pair). Extraction prompt is explicitly bilingual and idiom-aware. | Benchmark table + at least one demo utterance with ≥3 switch points. | Registering a language at session start. Every incumbent tool in the region does this (§3.6). |
| C5 | African language support | Kiswahili (Kenyan register) and Sheng, not standard Tanzanian Kiswahili. | Microcopy in both languages. Mother's words are never shown translated-only. | Idiom lexicon carries a `register` column: `kiswahili_sanifu` / `kenyan_colloquial` / `sheng`. | The lexicon itself, released as a CSV with provenance. | Using Google-translated Swahili in the UI. Native speakers spot it in one screen. |
| C6 | Real-world usability | Works on a mid-range Android in a noisy household with one hand free. | Thumb-reachable controls, 48px minimum targets, high contrast, no reliance on colour alone. | Responsive web app, tested at 360×640. Audio pipeline tolerant of 8–16 kHz input. | Screenshot or clip at real phone width, not desktop. | Demoing on a laptop only. |
| C7 | Model benchmarking, ≥3 models incl. Sahara | A reproducible harness, not hand-copied numbers. | Benchmark results surfaced *in the product* as a model-choice rationale page, not only in a PDF. | Python harness, HF `datasets`, `jiwer`, custom EESR/CIR/SPR metrics. | Benchmark report + runnable notebook + raw per-sample CSVs. | Reporting WER only. §18.4 explains why that is a weak submission. |
| C8 | Product quality | Feels like a tool a CHP would actually carry. | Real visual system (§16), real empty/loading/error states, real microcopy. | Next.js + Tailwind. Not Gradio, not Streamlit. | The demo video's production quality is part of this score. | Shipping a research notebook UI. |
| C9 | Responsible AI note | Consent, safety, and refusal behaviours are product features with UI, not a paragraph in a README. | Consent screen is a real screen with a spoken script. Escalation is a real interrupt. | Deterministic safety lexicon; audio deleted by default; no diagnosis emitted. | `RESPONSIBLE-AI.md` + the consent screen + the escalation card on video. | Writing the note and not building the controls. |
| C10 | Working prototype (short video demo) | Live, runnable, end-to-end. | Demo scripted as a story (§23), not a feature tour. | Deployed to a public URL before recording. | The video. No length is published; **RECOMMENDATION: 3 minutes.** | Recording a demo of a localhost that then breaks. |
| C11 | Code **or** technical documentation | Public repo with a README a stranger can run from. | n/a | `README.md` with setup, `.env.example`, one-command benchmark. | Repo link. | Private repo. |
| C12 | Submit test audio + metadata where permitted | A small first-party field set with the exact metadata schema requested. | n/a | 24 team-recorded clips, metadata CSV per §19.3. | The CSV + audio. | Submitting AfriSwitchCare audio, which is **CC BY-NC-SA and gated**. Redistribute the metadata and our own recordings only. |
| C13 | Specific vertical | Health. Perinatal mental health screening at community level in Kenya. | n/a | n/a | Stated in the first line of the submission. | Being a general assistant. |

## 2.3 The requirement most likely to sink good projects

**C2.** Intron states the rule explicitly: not "speech → text → stop." The failure is subtle, because a team can build a genuinely impressive transcription pipeline and then present it as the product. **Design rule adopted throughout this document: at no point in the UI or the demo is a raw transcript the primary object on screen.** The transcript is available on demand, as provenance, underneath the extracted evidence. This constraint is enforced in §15 screen specs and §23 demo beats.

---

# 3. Problem Definition

## 3.1 What is the exact problem?

A Kenyan mother in the year after childbirth who is depressed or severely anxious will, with high probability, be seen by the health system several times and be asked nothing about her mental state. If she volunteers distress, she will very likely express it somatically and in mixed language: *mawazo mengi*, *kuchoka moyo*, *niko na stress*, *sina ladha ya kula chakula*. Those expressions are not currently captured by any instrument, any form, or any digital tool operating in Kenya. The encounter ends. Nothing is recorded. No referral is made.

The problem has three layers, and a solution must address all three or it changes nothing:

1. **Nobody asks.** No national MOH form carries a maternal mental health field (§3.5). No national KHIS indicator exists for it.
2. **When someone asks, the instrument does not fit the language.** Translated Likert items are not parseable by the respondent (Velloza 2020); the Swahili instruments are unvalidated or licence-encumbered (§8.6).
3. **When distress is expressed spontaneously, it is expressed in a register no system captures.** Somatic, idiomatic, code-switched.

## 3.2 Who experiences it?

**Directly:** postpartum and pregnant women in Kenya, disproportionately young, low-income, peri-urban and rural, with lower literacy and lower English fluency. Adolescent mothers are the sharpest case: 43.1% screened PHQ-9 ≥10 among Nairobi pregnant adolescents (Tele et al. 2022, and note the authors state the instrument was not locally validated).

**Also directly, and this matters for who our user is:** Community Health Promoters, who are the most numerous cadre in the system (**mean 19.8 CHPs per facility**, versus 10.1 nurses and 5.1 clinical officers; Neema et al. 2026, [doi:10.1371/journal.pgph.0005191](https://doi.org/10.1371/journal.pgph.0005191)) and who currently have no instrument, no script, and no permitted vocabulary for this conversation.

## 3.3 How often does it occur?

**Derived estimate, flagged as arithmetic on cited inputs.** ~1.52M live births/year × 97.9% ANC1 coverage ≈ **1.5 million women reachable at a first ANC contact annually**. At a pooled SSA prevalence of 22.1%, that implies on the order of **330,000 women per year in Kenya** with perinatal depressive symptoms passing through a contact point where nothing is asked.

⚠️ **Do not quote the Kenya-specific prevalence point estimate as fact.** Nweke's Kenya figure of 24.4% rests on ~4 studies with a 95% CI of 12.9–41.4% and I² ≈ 89–98%. **Say "roughly one in five, with wide uncertainty."** A judge who checks will respect the caveat more than the number.

## 3.3a Three ways the obvious impact claim is wrong, and what to say instead

**Say this in the submission before a judge raises it.** The rhetorically powerful version of our impact case does not survive scrutiny, and we would rather retire it ourselves.

**Problem 1: the ratio is not a ratio.** "1.41 per 100,000 against a 22% prevalence" compares detections per **consultation** to prevalence among **women**. One woman generates many consultations, so the two rates have different denominators and cannot be divided. The populations differ too: the EPInA figure is *general* depression detection in *general* primary care in *one county* (Kilifi, 127 facilities); the prevalence figure is *perinatal* depression *pooled across sub-Saharan Africa*. Neither is the other's baseline.
**Say instead:** *"In the largest published Kenyan primary-care sample, 5.3 million consultations across 127 facilities, fewer than two depression cases were detected per 100,000 consultations."* The point (detection is effectively absent) survives intact, and it is defensible.

**Problem 2: the reach figure describes a contact we do not use.** §1.2 cites 97.9% ANC1 coverage. **ANC is antenatal and facility-based; MAMA-SAUTI runs at postnatal household visits.** Worse, applying a *postpartum* prevalence to an *antenatal* contact double-counts a population that Mwita 2025 (below) shows is moving. ⚠️ **We do not have a reliable CHP postnatal household coverage figure**, and we say so rather than substituting the ANC one.
**Say instead:** ANC coverage demonstrates that Kenyan mothers *are reachable by the health system*, which is context; the product's own reach is the CHP household visit, and quantifying that is pilot work.

**Problem 3: our own chosen instrument would find far fewer than one in five.** **FACT, and it is in our own §8.6:** at six weeks postpartum in Kenya, n=3,605, the same women screened **CESD-10 13%, EPDS 9%, PHQ-2 5%, PHQ-9 3%** (Larsen et al. 2023). We screen at six-week postnatal visits using PHQ-2 and PHQ-9. **Our instrument, at our timepoint, would flag roughly 3 to 5 percent, not 22.** Quoting 22% alongside a PHQ-9 product is an inflation the document's own evidence refutes.
**Say instead:** *"Pooled prevalence estimates for postpartum depression in sub-Saharan Africa cluster around one in five, but measured prevalence varies roughly fourfold with the instrument and cut-off used. We therefore do not claim a case-finding yield. We claim that a contact which currently produces no screening data produces a structured, evidence-linked screening record."*

**This is the §6.6 claim, and it is the one to lead with.** It is smaller, it is true, and it is measurable in a pilot. The 22% figure belongs in §3.1 as context for why the topic matters, and nowhere in the impact argument.

**FACT with a design consequence.** Point prevalence *falls* across the perinatal window while *incidence rises*: in a Tanzanian cohort of 533 adolescent mothers, depressive symptoms fell from 20.64% (2nd trimester) to 9.90% (3 months postpartum) while incidence rose from 9.00% to 11.89% (Mwita et al. 2025, [doi:10.1186/s13034-025-00983-5](https://doi.org/10.1186/s13034-025-00983-5)). **A single-timepoint screen at any one visit systematically misses a moving population.** MAMA-SAUTI therefore models screening as a repeatable event attached to a mother record, not a one-shot (see FR-19).

## 3.4 What currently happens?

The realistic version, drawn from Neema et al. 2026 across 20 MCH facilities in Western Kenya:

- Only **8 of 20 facilities (40%)** screened with any validated scale.
- **19 of 20 (95%) reported making mental health "diagnoses"; only 53% documented them.**
- **No facility used a manualised evidence-based psychological therapy**, despite 40–70% initially claiming CBT / PM+ / IPT.
- Prescribing was first-generation: amitriptyline 50%, diazepam 75%. **Sertraline, the standard perinatal antidepressant, was entirely absent.**

At community level: a CHP conducts a household visit, records on MOH 513 (Household Register) and MOH 514 (Service Delivery Log Book), and increasingly on eCHIS (Medic's Community Health Toolkit, Android, syncing to KHIS/DHIS2 via FHIR). None of these instruments contains a mental health field.

## 3.5 What is painful about the current workflow

| Dimension | The specific pain |
|---|---|
| **Instrument absence** | No national MOH form carries a maternal mental health field. MOH's own *National Handbook Guide for Integration of Mental Health Services into MCH for Pregnant Adolescents* (Jan 2025) recommends fixing exactly this: *"Incorporate the psychometric screening tools into the MOH 216 (Mother child handbook)."* **This is an MOH-acknowledged gap and it is our strongest policy argument.** |
| **Language** | Kilifi's mhGAP contextualisation named *"difficulty in translating the guide to Kiswahili language"* as an explicit barrier (Bitta et al. 2020, [doi:10.1017/gmh.2020.6](https://doi.org/10.1017/gmh.2020.6)). |
| **Cognitive burden on the respondent** | Most Kenyan perinatal women in cognitive testing could not distinguish PHQ-9's response anchors (Velloza 2020). The instrument's failure is at the point of comprehension, before any clinical question is reached. |
| **Cognitive burden on the CHP** | A CHP holding a paper register cannot simultaneously conduct an empathic conversation, remember nine PHQ-9 constructs, and score them. |
| **Literacy and channel** | The dominant digital channel is SMS, and depressed women use it less (Hummel 2022). |
| **Trust and stigma** | Women were specifically hesitant to endorse suicidal ideation and items touching duties as wife and mother (Velloza 2020). Under-endorsement, not over-endorsement, is the expected failure. |
| **Legal chill** | Kenya's High Court declared attempted suicide unconstitutional on 9 January 2025 (*KNCHR & 2 others v AG*, Petition E045 of 2022, [2025] KEHC 6), **but Penal Code s.226 is still printed pending repeal.** Many women still believe disclosure is criminal. |
| **Administrative dead end** | KHIS carries only three undisaggregated MNS indicators nationally: "mental disorder", "alcohol use", "epilepsy" (Mwanga et al. 2024, [doi:10.1371/journal.pdig.0000646](https://doi.org/10.1371/journal.pdig.0000646)). Nairobi County built a parallel Kobo/R-Shiny tool because the national tools could not capture perinatal mental health data. |

## 3.6 Why hasn't this been solved?

| Barrier | Detail |
|---|---|
| **Language technology** | No public Swahili-English **code-switched ASR training corpus** exists. Every deployed tool in the region treats language as a registration-time toggle. Jacaranda's PROMPTS asks the mother to select English or Kiswahili at enrolment. Azure's continuous LID documentation states it *"doesn't support changing languages within the same sentence."* Google's Chirp resolves to "most prevalent language." **Nobody handles intra-sentential Swahili switching.** |
| **Benchmark illusion** | Common Voice read-speech Swahili yields 3–16% WER; real code-switched Swahili yields **34.12% WER** on AfriSwitch's best system and **WER 0.34 / CER 0.19** on Kenyan code-switched mental health session audio (shamiriAI: Lilan, Mochama, Osborn et al. 2026, *JMIR AI* 5:e95063, [doi:10.2196/95063](https://doi.org/10.2196/95063)). **Benchmarking on the wrong corpus makes the problem look solved.** |
| **Instrument validation** | There is no criterion-validated Swahili EPDS. The one validated Kenyan EPDS is in **Kamba** (Mutiso et al. 2023: AUC 0.867, cut-off ≥11, sens 81.0%, spec 82.6%, **PPV 44.1%**). Note that PPV: at this prevalence, most screen-positives are false positives, which is why the output must be a referral, never a label. |
| **Legal ambiguity** | No Kenyan statute defines "screening" or draws the line between a CHP "monitoring health status" (authorised, PHC Act s.11(2)(c)) and "diagnosis" (reserved, Mental Health Act Cap 248 s.2). Builders avoid the space. |
| **Data localisation** | Digital Health Act 2023 **s.47**: *"Personal health information may only be shared to any person outside Kenya for the purposes of health tourism."* Read literally, this bars offshore cloud or LLM processing of identifiable Kenyan health data. Most global voice stacks are therefore non-compliant by default. |
| **Downstream void** | Detecting cases without a treatment pathway is worse than useless. This is the strongest objection to the entire product category and §7.5 answers it directly. |

## 3.7 Why voice, and why not the alternatives

**RECOMMENDATION with the counter-case stated.** We do not assume voice is the answer. We rejected four alternatives on evidence:

| Alternative | Why it loses here |
|---|---|
| **Typed form / app** | Hummel 2022: depressed women disengage from text. Velloza 2020: the items are not parseable as written. The failure is upstream of the interface. |
| **SMS** | Same finding, plus a documented effect size ceiling: PROMPTS achieved **0.06–0.09 SD** on its outcomes with **no mental health outcomes measured at all**, and 95% of enrolled women could already read English or Kiswahili. The tail that SMS excludes is our target population. |
| **Text chatbot** | Inherits every literacy and disengagement problem of SMS, and adds a stigma problem: disclosure of self-harm to an unsupervised bot with no human present is a safety design failure, not a feature. |
| **IVR / phone call** | Genuinely viable at scale, and Jacaranda ran a real pilot (2,883 calls, Nov–Dec 2025, 91.7% completion). **But their failures concentrated at the speech-to-text stage** (noise, quiet speech, phone quality), and 8 kHz telephony would degrade every model in our benchmark, confounding the code-switching finding we are trying to isolate. Also: US IVR postpartum depression screening reached only **39% of invited mothers, and non-callers were higher-risk** ([doi:10.1007/s10995-011-0817-6](https://doi.org/10.1007/s10995-011-0817-6)). Self-selection defeats the purpose. **Correct as a v2 channel, wrong as the v1 modality.** |
| **Human clinician** | 0.184 psychiatrists per 100,000. This is the constraint, not the solution. |

**The positive case for CHP-mediated voice specifically:** it costs the mother no literacy and no typing; it lets her use her own idiom rather than a translated anchor; it keeps a trained human physically present when self-harm surfaces; it produces consent face-to-face; and it rides on a cadre that already exists in the required numbers with the required devices.

---

# 4. User Personas

## 4.1 Primary User: the Community Health Promoter

**Grace Wanjiru, 41. CHP, Kawangware Community Health Unit, Nairobi County.**

**Identity.** Nine years as a CHV, converted to CHP by operation of law under the Primary Health Care Act 2023 s.22(3). Form Four education. Covers ~110 households in her CHU (a CHU is ≤1,000 households, supervised by one CHA/CHO per ~10 CHPs). Registered at county level. **She is not a "mental health practitioner" under Mental Health Act Cap 248 s.2 and cannot become one without registering in one of six named cadres.** Receives a stipend under the Ksh 3bn programme launched February 2024.

**Environment.** Household visits on foot, 6 to 12 per day. One-room homes, corrugated iron roofs, radio on, children present, neighbours audible. She holds a government-issued Android in one hand and often a baby-weighing sling or a register in the other. Data is prepaid and rationed. Network drops.

**Goal.** Complete her household visits, record what she is required to record, and not miss something that later becomes a tragedy she is blamed for.

**Pain points.** She can tell when a mother is not right. She has no words the system accepts for that, no form field, and no confidence that a referral will be actioned. She has watched the "diagnosis" of mental illness be treated as above her station, which it legally is.

**Language behaviour.** Fluent Kiswahili and Kikuyu, functional English. She code-switches constantly and unconsciously: Kiswahili as matrix language, English for anything clinical or administrative (`register`, `referral`, `pressure`, `checkup`, `appointment`), Sheng with younger mothers to build rapport. She switches *toward* English when she is being official and *away* from it when she is being kind.

**Technology behaviour.** Confident with WhatsApp voice notes. Uses eCHIS. Types slowly and dislikes long forms. Has never used a voice assistant. Will not read an onboarding tutorial.

**Trust requirements.** She must be able to see, in the mother's own words, why the system said what it said. If the system produces a conclusion she cannot trace to something the mother actually said, she will stop using it and she will be right to.

**Failure sensitivity.** Very high, asymmetric. A false negative that precedes a suicide is career-ending and life-ending. A false positive costs a referral and a mother's afternoon. **The product must be tuned accordingly: sensitivity over specificity, and escalation must never be suppressible by a confidence threshold.**

## 4.2 Secondary User (beneficiary): the mother

**Amina Hassan, 22. Seven weeks postpartum, first child. Kawangware.**

**Identity.** Class 8 education. Reads Kiswahili slowly, English with difficulty. Husband works irregular construction shifts. Her mother is upcountry. She is alone most of the day.

**Environment.** One room. The baby is on her lap or on her back throughout the conversation. She is tired in a way she has stopped mentioning.

**Goal.** She is not seeking mental health care. She would not use those words. She wants the baby to be fine and she wants to sleep.

**Pain points.** She has told a nurse she has *maumivu ya kichwa* and *mwili unauma* and was given painkillers. Nobody asked a follow-up question. She has concluded that this is not something the clinic deals with.

**Language behaviour. This is the design centre of the entire product.** Kiswahili matrix with heavy Sheng and English insertion. Her affective vocabulary is the code-switched part:

- *"Mimi huwa na* **mawazo mengi** *usiku, siwezi lala"*
- *"Niko na* **stress** *sana lakini sijui ya nini"*
- *"Moyo wangu unachoka"* / *"* **kuchoka moyo** *"*
- *"* **Sifeel poa** *, lakini nikienda hospitali wananiambia niko sawa"*
- *"Sina ladha ya kula chakula"*
- *"* **Siko sawa** *"*

She will almost never say *"nina huzuni"* about ordinary sadness. ⚠️ Kilifi participants reported **huzuni is reserved for severe events such as death** and recommended *kusikitika* for milder sadness (Wahid et al. 2025, [doi:10.1017/gmh.2025.8](https://doi.org/10.1017/gmh.2025.8)). She will essentially never say *"nina depression"* unless a health worker has said it to her first, though **the English words "stress" and "depression" have been adopted into Kiswahili discourse and may carry new meaning** (Mendenhall et al. 2019, [doi:10.1177/1363461518824431](https://doi.org/10.1177/1363461518824431)).

**Technology behaviour.** Feature phone plus occasional access to her husband's smartphone. WhatsApp voice notes yes, typed messages rarely. **She is not the operator of MAMA-SAUTI. She never touches the device.**

**Trust requirements.** She must know who will hear this, what happens to the recording, and that saying something will not bring the police or take her baby. She must be able to stop at any moment without explaining why.

**Failure sensitivity.** If the system mishears her and Grace reads back something she did not say, she disengages permanently and tells other mothers. **Mandatory back-read in her own language is a trust requirement, not a nicety.**

## 4.3 Operational User: the facility clinician

**Clinical Officer Peter Otieno, 33. Level 3 health centre, the CHU's link facility.**

**Identity.** Clinical officer with express statutory diagnostic authority (Clinical Officers Act CAP 253E s.20(9)). Has done Kenya-adapted mhGAP training. **He is the effective floor for diagnosis in primary care.**

**Environment.** 40 to 70 outpatients a day. Two to four minutes per patient. He will not open an app. He will read a printed or WhatsApp-delivered summary, in English, in under thirty seconds.

**Goal.** Decide in seconds whether this referral needs him today, next week, or not at all.

**Pain points.** Community referrals arrive as a scrawled MOH 100 with no structure and no evidence. He cannot tell an anxious first-time mother from an emergency.

**What he needs from us.** An English summary; a risk band with the instrument and cut-off named; **the mother's verbatim quotes preserved untranslated with a gloss**, because the idiom is clinical information he can act on; the flag reason if escalated; and the timestamp and CHP identity. Nothing else.

**Failure sensitivity.** If we send him noise, he stops reading our referrals within a week and the whole pathway dies.

## 4.4 Supervisory User (out of MVP scope, specified for completeness)

**CHA/CHO supervisor.** Statutory term is "community health officer" (⚠️ note: "community health assistant" appears once in the PHC Act and is never defined; "CHA" is policy language, "CHO" is statutory). Supervises ~10 CHPs. Needs aggregate counts for monthly reporting on MOH 515. **Explicitly out of MVP scope** (§8.4, §27).

---

# 5. Code-Switching Environment

## 5.1 Languages and varieties

| Variety | Role | Notes |
|---|---|---|
| **Kiswahili (Kenyan colloquial)** | Matrix language in ~70–85% of mother turns | Not Tanzanian *Kiswahili sanifu*. Kenyan phonology and lexicon. |
| **English** | Embedded, high clinical density | Carries administrative and, critically, **affective** vocabulary. |
| **Sheng** | Present in the data, **out of scope for MVP claims** | Nairobi urban youth variety, common with mothers under ~28: `sifeel poa`, `siko sawa`, `poa`. ⚠️ **Scope decision: Sheng is accepted as input and recorded when it appears, but MAMA-SAUTI makes no performance claim about it, sets no target for it, and does not lead with it.** It is in no model's training distribution, so any result would be an artefact of that absence rather than a finding about this product. **It is a first-class research question (§29.5), not an MVP capability.** |
| **Kikuyu / Dholuo / Kamba** | Occasional insertion | ⚠️ **Out of MVP scope.** Sahara's code-switched pair is Swahili-English (`sw`). If a mother inserts a third language, the system must degrade gracefully (§21) rather than fail, and this limitation must be stated in the submission. |

**Sahara configuration:** `use_language_asr_input="sw"`. **FACT:** in Sahara's API, the code-switched pair *is* the language code. `sw` = Swahili-English code-switched. There is no separate "enable code-switching" flag.

## 5.2 Direction and density of switching

**FACT (AfriSwitch / AfriSwitchCare, Intron Health):**

| Corpus | Swahili-English volume | CMI | Switch points |
|---|---|---|---|
| **AfriSwitchCare** (clinical, doctor-patient) | 12 conversations, **1.54 h**, mean ~7.7 min each | **37.4** | **96.4 per conversation** (highest of 8 languages) |
| **AfriSwitch** (in-the-wild conversational) | 650 utterances, **3.89 h** | 25.72 | **10.29 per utterance** (highest of 14 languages) |

Dominant directions, in expected order of frequency:

1. **Kiswahili → English → Kiswahili** (insertional; single English word or short phrase inside a Kiswahili clause). This is the overwhelming majority and the hardest for ASR.
2. **Kiswahili → Sheng → Kiswahili** (register shift for intimacy or hedging).
3. **English → Kiswahili** at clause boundaries (alternational), more common in the CHP's speech than the mother's.
4. **Multiple switches within one clause**: *"Nikiamka asubuhi naskia* **body** *yangu ni* **heavy** *, sina* **energy** *ya kufanya kitu."*

## 5.3 Natural code-switched example utterances

**These are the reference utterances for prompt design, test fixtures, and the demo script.** They are constructed by us in the documented register (§5.4 provenance), not lifted from any dataset.

**Rumination / "thinking too much" (PHQ-9 items 2, 3; GAD-7 items 1, 3)**
> *"Usiku sipati usingizi. Nakuwa na* **mawazo mengi** *sana, nafikiria kuhusu pesa, nafikiria kuhusu mtoto, mpaka asubuhi. Niko na* **stress** *lakini sijui ni ya nini."*

**Somatic presentation (PHQ-9 items 4, 5, and the classic misattribution)**
> *"Kichwa inauma kila siku. Nikaenda hospitali wakanipa* **painkillers** *. Lakini* **sifeel poa** *, sio ile maumivu ya kawaida. Ni kama* **kuchoka moyo** *."*

**Anhedonia and maternal-role guilt (PHQ-9 items 1, 6)**
> *"Hata mtoto akicheka, mimi sifurahi. Nasikia mimi ni* **bad mother** *. Nashindwa* **kuconnect** *na yeye."*

**Appetite (PHQ-9 item 5)**
> *"Sina ladha ya kula chakula. Nakula tu kwa sababu ya kunyonyesha, sio kwa sababu nataka."*

**Sleep, disentangled from infant care (PHQ-9 item 3, the confounder that matters clinically)**
> *"Mtoto akilala mimi sikulali. Nabaki tu nimekaa, naangalia dari."*

**Psychomotor / energy (PHQ-9 items 4, 8)**
> *"Kuamka tu asubuhi ni* **struggle** *. Mwili wote ni* **heavy** *."*

**Emotional, informal, hedged (the register a CHP actually hears)**
> *"Nikuambie ukweli? Mimi* **siko sawa** *. Lakini usiambie mtu, sitaki watu wa hapa wajue."*

**Numbers, dates, names (the highest-risk entity classes)**
> *"Nilijifungua tarehe* **fifteen June** *, saa* **nne** *usiku, pale* **Kenyatta** *. Mtoto anaitwa Baraka."*
> Note: mixed numeral systems in one utterance (English "fifteen June", Swahili clock "saa nne" = 10 p.m., not 4 o'clock). **Swahili time is offset six hours from English clock time. Any date/time extraction that does not handle this will be wrong by six hours.** This is a real trap and a good demo detail.

**Risk disclosure, hedged and indirect (the utterance the safety layer exists for)**
> *"Kuna siku nafikiria ingekuwa poa kama singekuwepo. Sio kwamba nataka* **kujiua** *... lakini nimechoka."*

**Explicit risk (Swahili idiom)**
> *"Nilifikiria* **kujitia kitanzi** *."* (lit. "to put a noose on oneself"; documented as the Swahili term for suicide in Panneh 2022, [PMC9685887](https://europepmc.org/articles/PMC9685887))

## 5.4 Documented distress idiom lexicon (v1)

**FACT.** Every entry below is attested in peer-reviewed literature. This lexicon is a first-class product artifact: it is released as `data/idiom_lexicon.csv`, it drives the extraction prompt, and it is scored as a benchmark metric (CIR, §18.4). Columns: `id, phrase, register, gloss, phq9_gad7_mapping, source, doi_or_pmcid, confidence`.

| Phrase | Register | Documented gloss | Maps to | Source |
|---|---|---|---|---|
| **kufikiria sana** / **kufikiri sana** | Kiswahili | "thinking too much"; excessive rumination | PHQ-9 #2/#3, GAD-7 #1/#3 | Mendenhall 2019; Panneh 2022; Owidi 2025; Nyongesa/Kumar 2022 |
| **mawazo mengi** | Kiswahili | "many thoughts" | PHQ-9 #3, GAD-7 #1 | Owidi 2025; Angwenyi 2024 ([PMC11684234](https://europepmc.org/articles/PMC11684234)) |
| **msongo wa mawazo** | Kiswahili | how participants named "depression" (lit. crowding/pressure of thoughts) | PHQ-9 global | Panneh 2022 (n=17) |
| **dhiki** | Kiswahili | stress / agony | GAD-7 global | Mendenhall 2019; Panneh 2022 (n=23) |
| **huzuni** | Kiswahili | sadness / grief. ⚠️ **reserved for severe events such as death**; *kusikitika* for milder sadness | PHQ-9 #2 (high severity) | Mendenhall 2019; Wahid 2025 |
| **kuchoka moyo** | Kiswahili | "having a tired heart", expanded by participants as *"ni kama nina mzigo mzito"* ("as if carrying a heavy burden") | PHQ-9 #1/#4 | Swahili BDI-II adaptation, [PMC4892521](https://europepmc.org/articles/PMC4892521) |
| **majeraha ya moyo** | Kiswahili | "heart wounds" (trauma sequelae) | Trauma flag, not PHQ-9 | Wen et al. 2023 ([PMC10623154](https://europepmc.org/articles/PMC10623154)) |
| **kusumbuka akili** | Kiswahili | "mentally disturbed" | PHQ-9 global | Panneh 2022 |
| **kitu inanisumbua** | Kiswahili | "something is disturbing me" | GAD-7 #1 | Owidi 2025 |
| **siko sawa** | Kiswahili/Sheng | "I am not okay" | PHQ-9 global, low specificity | Owidi 2025 |
| **niko na stress** | Sheng (code-switched) | "I have stress" | GAD-7 global | Owidi 2025 |
| **sifeel poa** | Sheng (code-switched) | "I don't feel fine" | PHQ-9 global, low specificity | Owidi 2025 |
| **sina ladha ya kula chakula** | Kiswahili | "I do not feel the taste of food"; **proposed as a comprehensible replacement for the standard appetite item** | PHQ-9 #5 | Nyongesa/Kumar 2022 ([PMC9754261](https://europepmc.org/articles/PMC9754261)) |
| **pagawa** | Kiswahili | insanity | Severe MH flag | Panneh 2022 (n=16) |
| **kujitia kitanzi** | Kiswahili | suicide (lit. "to put a noose on oneself") | **SAFETY LEXICON** | Panneh 2022 (n=6) |

**Theoretical anchor.** Kaiser BN, Haroz EE, Kohrt BA, Bolton PA, Bass JK, Hinton DE. *"Thinking too much": A systematic review of a common idiom of distress.* **Soc Sci Med 2015;147:170–183**, [doi:10.1016/j.socscimed.2015.10.044](https://doi.org/10.1016/j.socscimed.2015.10.044). 138 publications. Two conclusions we build on directly: recommendation 1 is to **incorporate the idiom into measurement and screening to improve validity of case identification**; and, equally important, *"'thinking too much' should not be interpreted as a gloss for psychiatric disorder."* **We therefore map idioms to construct *evidence*, never to a diagnosis, and never at full weight on their own.**

**Model to copy:** the Sierra Leone Perinatal Psychological Distress Scale, built from perinatal idioms of distress (Ager et al. 2025, [doi:10.3389/fpsyt.2025.1419448](https://doi.org/10.3389/fpsyt.2025.1419448)). This is the shape of the research follow-on in §29.5.

## 5.5 ⚠️ Idioms we will NOT claim

Intellectual honesty here is cheap and protects the whole submission:

- **"kichwa kinauma"** ("my head hurts"): **zero hits in Europe PMC as a documented idiom of distress.** It is clinically plausible and appears in our example utterances as *naturalistic speech*, but we do not cite it as an attested idiom and it does not enter the lexicon with a source.
- **"ugonjwa wa mawazo"**: zero direct hits.
- **"nimechoka"**: appears only inside SMS message content in Angwenyi 2024, never as an analysed idiom.
- **Literature-search trap:** searching bare **"mawazo"** in Europe PMC returns 69 hits, essentially all of which are the Tanzanian author surname "Mawazo A." Any automated evidence pipeline will be poisoned by this. Do not build one naively.

The Swahili idiom literature is genuinely thinner than the Shona (*kufungisisa*) or Haitian (*reflechi twòp*) equivalents. **"mawazo mengi" appears in only 4 papers in all of Europe PMC.** Saying so is a strength.

## 5.6 Accent and environmental conditions

**Accent.** Kenyan Kiswahili (coastal vs upcountry vs Nairobi), Kikuyu / Luo / Kamba / Kalenjin L1 influence on both Kiswahili and English, urban vs rural, and age-graded Sheng density. **Design consequence:** never assume a canonical pronunciation for lexicon matching. Idiom matching must be fuzzy (§11.4).

**Environment, in expected frequency order for a household visit:** one-room home with radio or TV; children and infant vocalisation (constant, and acoustically overlapping with speech); neighbours and courtyard noise; corrugated iron roof under rain (broadband, severe); matatu and street noise near the road; occasional quiet room. Multiple speakers are the norm, not the exception.

**Device.** Mid-range Android, built-in mic, held 20–50 cm away, often at a bad angle because the CHP is also holding something else.

**Design consequences, all of which become requirements:**
- Audio quality feedback must be *pre-emptive* (before the mother has spoken for two minutes into a useless recording), not post-hoc.
- ⚠️ Note the corroborating evidence: Jacaranda's IVR pilot failures **concentrated at the STT stage** on noise, quiet speech and phone quality. This is the predictable failure and we design for it (FR-05, §21.1).
- **AfriSwitchCare Swahili has no speaker markers at all** (`num_turns` is null; the card states Swahili transcripts carry no `[Speaker N]` labels). We therefore **do not build diarization** (§27) and we design the extraction to work on undiarized two-party audio.

## 5.7 Product implications of code-switching

| Situation | Required product behaviour |
|---|---|
| **Mixed-language transcript** | Display verbatim, mixed, **untranslated**. Never normalise to one language on screen. Provide an English gloss *alongside*, never *instead*. |
| **Suspected switch-boundary deletion** | Run the **deletion-signature detector** (§11.5): if `transcript_chars / audio_seconds` falls below a threshold calibrated on the benchmark set, surface *"Tunaweza kuwa tumekosa sehemu ya aliyosema"* and offer re-record. This is the benchmark finding wired directly into the product. |
| **Low ASR confidence on a clinical span** | Do not populate the construct. Convert it into a probe target instead. Silence beats a guess. |
| **Names** | Never inferred from audio alone. Typed once by the CHP at session start, or confirmed character-by-character. Names are the single worst ASR entity class in this setting. |
| **Numbers and dates** | Always confirmed explicitly. **Swahili clock time is offset 6 hours** (*saa nne usiku* = 10 p.m.). Extraction must apply the offset and then show the converted value for confirmation. |
| **Domain terminology** | Idiom matching is fuzzy and lexicon-driven, with the matched lexicon `id` recorded so a reviewer can audit it. |
| **Interruptions (infant crying, a neighbour entering)** | The CHP taps pause. Session state survives. Nothing is lost. |
| **Third language inserted (Kikuyu, Dholuo)** | Degrade gracefully: mark the span `unrecognised_language`, do not extract from it, prompt the CHP to ask the mother to repeat in Kiswahili or English. **Do not silently hallucinate a Swahili reading.** |
| **Ambiguity between somatic and psychological** | This is the product's whole reason for existing. Somatic-only evidence never scores a construct alone; it raises a **probe** for that construct. See §12.4. |

---

# 6. Product Vision

## 6.1 One-sentence product description

MAMA-SAUTI turns a natural, code-switched conversation between a Community Health Promoter and a new mother into a completed, evidence-linked mental health screening record with a routed referral.

## 6.2 Elevator pitch (94 words)

One in five Kenyan mothers experiences perinatal depression. Public primary care detects roughly one in seventy thousand. The mothers who are struggling do not say "I am depressed"; they say *mawazo mengi*, *kuchoka moyo*, *niko na stress*, switching between Kiswahili, English and Sheng inside a single sentence, and every speech system deployed in the region makes them pick one language at registration. MAMA-SAUTI listens to how she actually speaks, using Intron Sahara's code-switched Swahili-English model, and hands her Community Health Promoter a completed PHQ-9 and GAD-7 screen with every score traced to the mother's own words.

## 6.3 Product vision statement

Within three years, a Kenyan mother should be able to describe how she is feeling, in whatever mixture of languages she actually thinks in, to the community health worker who already visits her home, and have that description become a real clinical record that reaches a real clinician. Not a translated questionnaire she cannot parse. Not an SMS she is too depressed to answer. Her own words, preserved, understood, and acted on.

The measure of success is not that MAMA-SAUTI is widely used. It is that maternal mental health becomes a field on a Kenyan MOH form, backed by an instrument the mother can actually answer.

## 6.4 Core value proposition

> **For** Community Health Promoters in Kenya conducting routine postnatal household visits,
> **who** can see that a mother is struggling but have no instrument, no script, and no permitted vocabulary to record it,
> **MAMA-SAUTI**
> **is a** voice-first screening assistant
> **that helps them** complete a validated mental health screen and route a referral without interrupting the conversation to fill in a form,
> **by** listening to the mother's natural code-switched Kiswahili-English speech, mapping her own somatic idioms onto PHQ-9 and GAD-7 constructs, and quoting her verbatim as the evidence for every score.
>
> **Unlike** SMS platforms, which depressed women demonstrably use less, and unlike every existing voice tool in the region, which makes the speaker choose one language at registration,
> **it** treats mid-sentence code-switching as the normal case and refuses to emit any score it cannot trace to something the mother actually said.

## 6.5 Positioning against the actual landscape

**FACT.** The gap analysis, verified against published sources:

| Capability | Who does this in East Africa today |
|---|---|
| Voice input for maternal health | Partially. Jacaranda IVR pilot (2025, no MH screening); Zuri Health (advertises a voice screen, **zero published evidence**); CCPF in Malawi (Chichewa, not Swahili) |
| Kiswahili support | Yes. Ada Health (first AI health app in Swahili, 2019), PROMPTS, UlizaLlama |
| **Code-switched Kiswahili-English** | **Nobody.** Language is a registration-time toggle in every deployed tool |
| **Perinatal mental health screening, digital** | **Essentially nobody.** PROMPTS offers reactive referral with no instrument attached |
| **All three combined** | **Does not exist anywhere in Africa** |

**RECOMMENDATION for the post-competition phase, not for this build.** **Jacaranda Health** is the natural first conversation once there is something to show. They have ~3 million mothers, county-level public-sector integration, a Swahili LLM (UlizaLlama), a working IVR stack, a published admission of no audio support, and a postpartum-depression referral pathway **with no screener attached to it**. They are either the obvious pilot partner or the obvious competitor.

⚠️ **Do not contact them during the build, and do not name them in the submission as a partner.** There is no time to have the conversation properly, an unanswered email is not a partnership, and implying a relationship that does not exist is the endorsement failure §27 warns about. Their published gap statement is citable as *evidence of the problem* (§6.5 table, Vatsa et al. 2025), which is a different and entirely legitimate use. **Partnership outreach belongs in the research and pilot phase (§29.5), once there is a working artefact and a benchmark to show them.**

## 6.6 Effect-size honesty

**FACT, and state this in the submission before a judge raises it.** The two at-scale RCTs in this region-class achieved small effects: PROMPTS (SMS, Kenya) **0.06–0.09 SD**; Viamo 3-2-1 (IVR, Uganda) **0.07 SD**. Digital maternal health interventions in this setting do not produce large effects. **MAMA-SAUTI's claim is therefore not "we will reduce depression."** It is narrower and far more defensible: *we convert a contact that currently generates zero screening data into a structured, evidence-linked screening record and a routed referral.* That is a process outcome we can actually measure in a pilot, and it is the necessary precondition for any clinical outcome at all.

---

# 7. Jobs to Be Done

## 7.1 The CHP's job (primary)

> **When I am** sitting in a mother's home at a six-week postnatal visit and I can tell something is wrong,
> **I want to** ask her about it in a way she will actually answer, and have what she tells me become a real record that a clinician will read,
> **so that** I have done my job properly and it is not just me privately worrying about her.

**Functional job.** Complete a valid mental health screen and generate a referral, inside a visit I am already making, without a paper form and without stopping the conversation.

**Emotional job.** Stop carrying unrecorded worry. Grace can currently *see* the problem and has no legitimate channel for it. Relief of that specific burden is the emotional payload.

**Social job.** Be seen by the facility, by her CHO supervisor, and by the mothers in her unit as someone whose referrals are credible and worth acting on. Status among CHPs runs on whether the facility takes her referrals seriously.

## 7.2 The mother's job (secondary)

> **When I am** exhausted and not myself and I have already been given painkillers twice,
> **I want to** describe what is actually happening to me in my own words without being told it is normal,
> **so that** somebody takes it seriously and I find out whether something can be done.

**Functional.** Be understood, once, accurately.
**Emotional.** Be believed. Not be told *"ni kawaida"* ("it's normal").
**Social.** Not be labelled *mwendawazimu*. This is why she hedges, and why **an unsupervised app is the wrong container for this disclosure**: she is choosing to tell a specific trusted person, not to broadcast.

## 7.3 The clinician's job (operational)

> **When I am** thirty patients into a clinic day and a community referral arrives,
> **I want to** know in fifteen seconds whether this needs me now,
> **so that** I can triage without reading a paragraph.

## 7.4 Current solution → desired outcome → opportunity

| | Current | Desired | Where voice AI creates the value |
|---|---|---|---|
| **CHP** | Notices, says nothing, records nothing | Screen completed during the visit, referral routed | Removes the form entirely from the interaction. The conversation *is* the data entry. This is the only mechanism that makes screening free at the point of care in terms of the CHP's attention. |
| **Mother** | Somatic complaint → painkillers → disengagement | Idiom heard as clinical evidence, referred | Preserves her register instead of forcing translation. Mapping happens in the system, not in her head. |
| **Clinician** | Illegible MOH 100, no structure | Structured summary, banded, quoted, timestamped | Structured extraction from unstructured speech, with provenance. |
| **System** | Zero perinatal MH data in KHIS | A countable, auditable screening event | Creates the indicator that does not currently exist. |

## 7.5 The hardest objection to this JTBD, answered

**"This will detect cases and have nowhere to send them. Kenya has ~104 psychiatrists."**

This is the strongest objection to the entire product category and it must be answered with evidence, not optimism.

**FACT.** Task-shared, lay-delivered psychosocial care works in sub-Saharan Africa. A 2026 meta-analysis of 16 studies found CHW-led preventive psychosocial interventions reduced risk of depressed mood by **35% at 3 months (RR 0.65, 95% CI 0.46–0.92)** and 32% at 6 months, with therapeutic interventions at **SMD −0.71 (−0.84 to −0.59)** (Feyissa et al. 2026, [doi:10.1093/heapol/czaf084](https://doi.org/10.1093/heapol/czaf084); evidence quality low to moderate, and we say so).

**FACT.** The Friendship Bench: 24 clinics, N=573, 86.4% women, six sessions of problem-solving therapy delivered by trained lay health workers; SSQ-14 adjusted mean difference **−4.86 (95% CI −5.63 to −4.10)**; depression 13.7% vs 49.9% (Chibanda et al., *JAMA* 2016;316(24):2618–2626, [doi:10.1001/jama.2016.19102](https://doi.org/10.1001/jama.2016.19102)). ⚠️ Note: the organisation's "grandmothers" framing is public-facing; the literature describes **government-employed lay health promoters**, structurally the same cadre as Kenya's CHPs. ⚠️ No peer-reviewed Kenyan adaptation exists.

**FACT, and this is the closest precedent to our exact workflow.** Kumar et al. 2026, *JAMA Netw Open* 9(6):e2618255, [doi:10.1001/jamanetworkopen.2026.18255](https://doi.org/10.1001/jamanetworkopen.2026.18255): group IPT for perinatal adolescents in Nairobi, where *"trained nurses screened participants and supervised group sessions delivered by community health promoters collaboratively with psychologists."* Full IPT-G reached PHQ-9 β = −5.79 post-intervention, attenuating to −2.22 at 6 months. ⚠️ **Report honestly that the 4-session version was not significant at 6 months.**

**FACT.** The stepped-care design to slot into already exists and is running: the IPMH cluster RCT in Western Kenya (Karume et al. 2026, *PLoS One* 21(6):e0349732, NCT06456307), 20 facilities, **N=2,970**, universal screening → PM+ by lay providers → telepsychiatry, with eligibility thresholds of **PHQ-2 ≥3 and/or GAD-2 ≥3** and screening timepoints aligned to routine well-baby visits.

⚠️ **Report the failures too.** The peer-delivered Thinking Healthy Programme trial in Pakistan was **null on both primary outcomes** (*Lancet Psychiatry* 2019, [doi:10.1016/S2215-0366(18)30467-X](https://doi.org/10.1016/S2215-0366(18)30467-X)); the India replication was mixed. Task-sharing is not magic.

**Our position.** MAMA-SAUTI does not create a treatment pathway. It **feeds one that Kenyan researchers and MOH are already building**, and it fills the specific step those programmes currently perform with unvalidated translated instruments administered by nurses who do not have time. We use the **same thresholds** (PHQ-2 ≥3, GAD-2 ≥3) as the IPMH trial so that our output is directly consumable by the pathway that exists.

---

# 8. Product Scope

## 8.1 Prioritisation rule

Every feature below justifies itself against at least one of: **user value [UV]**, **competition requirement [CR]**, **product differentiation [PD]**, **technical credibility [TC]**, **demo value [DV]**, **safety requirement [SR]**. Anything that justifies against none of these is in §27, the anti-feature list, with a reason.

**Hard constraint governing all of it: two people, roughly 34 elapsed hours, MVP functionally complete at T+24** (§24.1). Scope is cut to fit, not aspired to.

## 8.2 MUST HAVE (the MVP; absence means no credible submission)

| ID | Feature | Justification |
|---|---|---|
| M1 | Spoken consent capture with an explicit "she declined" path that ends the session cleanly | [SR][CR] Ethics & Safety is a named judging dimension. |
| M2 | Push-to-record turn capture, CHP-controlled, with visible recording state and a level meter | [UV][CR] |
| M3 | Sahara v2.5 code-switched transcription, `use_language_asr_input="sw"` | [CR] Mandatory. |
| M4 | Verbatim mixed-language transcript display, untranslated, with English gloss alongside | [UV][PD] |
| M5 | Idiom-aware extraction onto PHQ-9 + GAD-7 constructs, **with a mandatory verbatim `evidence_span` for every populated construct** | [UV][PD][TC] The core mechanism and the anti-hallucination control. |
| M6 | Coverage state: which constructs are evidenced, which are not | [CR] The agent's memory. Without it there is no agent. |
| M7 | Agent-generated next probe, phrased in the mother's own register, for the highest-value uncovered construct | [CR][PD] **This is the agentic requirement.** |
| M8 | Deterministic safety layer on the raw transcript with bilingual risk lexicon → escalation interrupt | [SR][CR][DV] |
| M9 | Structured `ScreeningRecord` with PHQ-9 / GAD-7 scores, risk band, per-item provenance | [CR] **The downstream task.** |
| M10 | Referral routing to a tier (CHP follow-up / facility clinical officer / urgent), with the reason stated | [UV][CR] Makes the task consequential. |
| M11 | CHP confirmation step before the record is written; medium-confidence items must be confirmed | [SR][UV] |
| M12 | Back-read to the mother in her own language mix before submission | [SR][UV][PD] Trust requirement from §4.2. |
| M13 | Handover summary in English for the facility, with verbatim quotes preserved + glossed | [UV] Clinician's 15-second job. |
| M14 | Persist records; list past screens for a mother | [UV][CR] Screening is repeatable (§3.3). |
| M15 | 4-model benchmark harness with WER/CER + **EESR + CIR + SPR + band-flip** | [CR][TC][PD] |
| M16 | In-product "Why Sahara" page showing benchmark results | [CR][DV] Puts the benchmark in the product, not just a PDF. |
| M17 | Mobile-responsive layout verified at 360×640 | [CR][UV] |
| M18 | Audio deleted after transcription by default; retention is opt-in per session | [SR][CR] |

## 8.3 SHOULD HAVE (build only if the MVP is complete ahead of T+24)

| ID | Feature | Justification |
|---|---|---|
| SH1 | **Deletion-signature detector** (chars/second below calibrated floor → prompt re-record) | [PD][TC] Highest-value should-have: it is the benchmark finding operating inside the product. **Promote to Must if time allows; this is the single most differentiating small feature in the spec.** |
| SH2 | Inline correction of a single extracted item by re-recording just that item | [UV] |
| SH3 | Printable / WhatsApp-shareable referral card | [UV][DV] |
| SH4 | Offline queueing of a completed record for later sync | [UV] Real connectivity. Genuinely time-expensive; see §27. |
| SH5 | Session pause and resume across an interruption | [UV] |
| SH6 | Per-construct confidence surfaced as a visual band on the record | [TC][UV] |
| **SH7** | **Sahara speaker diarization via `use_diarization=TRUE`** | [TC][UV] **Gated on the T+24 milestone being met, and on the compatibility test in §11.3a passing.** One form field if it works; silently re-breaks the safety architecture if it does not. **Do not attempt before T+24.** |

## 8.4 COULD HAVE (post-competition)

CH1 CHO supervisor aggregate view · CH2 eCHIS / CHT integration via FHIR · CH3 EPDS as a second instrument, **contingent on written RCPsych clearance** (§20.5) · CH4 Additional language pairs from Sahara's other 11 code-switched codes · CH5 TTS back-read using Sahara's Swahili voice · CH6 Longitudinal trajectory view across screens · CH7 IVR channel for mothers without a CHP visit.

## 8.5 WON'T HAVE (explicitly excluded, with reasons)

| Excluded | Why |
|---|---|
| **Any diagnosis, DSM/ICD code, or diagnostic label** | **Legally prohibited in this context.** Mental Health Act Cap 248 s.2 constitutes mental illness by diagnosis by a registered practitioner; a CHP is not one. Output is a risk band and a referral. Non-negotiable. |
| **Any treatment or medication recommendation** | Same statutory basis. Also clinically wrong at this tier. |
| **Mother-facing self-serve app** | Removes the human from a self-harm disclosure. Rejected on safety grounds in §4.2. |
| **A language selector** | This is the anti-pattern the competition exists to eliminate. Its absence is a positioning statement. |
| **Speaker diarization** | **Not excluded on cost. See §11.3a, which sets out the real reasoning, the cheaper mitigation that replaces it, and the one test that could change this decision.** |
| **Conversational TTS agent that interviews the mother** | A synthetic voice asking a mother about self-harm is worse than a trained human asking. It also burns the latency budget. The CHP is the interface. |
| **Real patient audio in the MVP** | Digital Health Act s.47 + no IRB. Benchmark data and team-recorded synthetic audio only. |
| **User accounts, password auth, RBAC** | A CHP code is sufficient for a competition demo. Real auth is pilot work. |
| **Analytics dashboard with charts** | Zero judging value, high build cost. |

## 8.6 The instrument decision, recorded

**DECISION: PHQ-2 → PHQ-9 plus GAD-2 → GAD-7. EPDS is excluded from the MVP.** Decision recorded here so it does not get reopened.

| Instrument | Licence | Swahili evidence | Verdict |
|---|---|---|---|
| **PHQ-9 / PHQ-2** | **FACT, verified at [phqscreeners.com/terms](https://www.phqscreeners.com/terms):** *"Content found at the PHQ Screeners site is expressly exempted from Pfizer's general copyright restrictions; content found on the PHQ Screeners site is free for download and use."* No fee, no permission. | Translated (Omoro 2006, ICC 0.71, α 0.80, **no sens/spec**). Only criterion validation is Zanzibari and non-perinatal: cut-off ≥5, sens 69%, spec 63%, **AUC 0.69** (Ceccolini 2025). PHQ-2 ≥3: sens 85%, spec 95%, AUC 0.97 in western Kenya (Monahan 2009, non-perinatal). **Swahili/English measurement invariance confirmed under telephone administration**, n=3,934 across all 47 counties (Odero et al. 2023, [doi:10.3389/fpsyt.2023.1123839](https://doi.org/10.3389/fpsyt.2023.1123839)). | **CHOSEN.** Free, aligned with MOH's own January 2025 perinatal handbook (which tells adolescents to "self screen using PHQ2 and PHQ9"), and Odero 2023 is the closest psychometric evidence to a voice product that exists anywhere. ⚠️ **"Aligned with", not "endorsed by". MOH has not endorsed PHQ-9 as a national instrument and we must not imply it has** (§27 bans exactly this). |
| **GAD-7 / GAD-2** | Free, same Pfizer terms. | Swahili psychometrics from the same Zanzibar study. ⚠️ **We could not retrieve the GAD-7 Swahili cut-offs. Do not state them.** GAD-2 ≥3 is the threshold used by the Kenyan IPMH trial. | **CHOSEN** at GAD-2 ≥3, matching IPMH. |
| **EPDS** | ⚠️ **Genuinely unresolved for electronic use.** The 1987 free-reproduction notice (Cox, Holden & Sagovsky, *Br J Psychiatry* 150:782–786) is stated by a peer-reviewed platform paper to have been *"superseded by a different set of permissions that prohibit unrestricted electronic reproduction"* (Cardinal et al., *Front Psychiatry* 2021, [PMC8635805](https://europepmc.org/articles/PMC8635805)). **The sole authority for that restriction is an unpublished 2013 personal communication from the Royal College of Psychiatrists.** A voice tool reads items aloud, which is arguably reproduction, so the question cannot be dodged. | **No criterion-validated Swahili version exists.** The validated Kenyan EPDS is in **Kamba** (Mutiso 2023). | **EXCLUDED from MVP.** Better perinatal specificity, but a live licensing question plus no Swahili validation is the wrong risk to carry into a 4-day build. Revisit for the paper with written RCPsych clearance. |
| **SRQ-20** | Free (WHO 1994, [iris.who.int/handle/10665/61113](https://iris.who.int/handle/10665/61113)). ⚠️ Predates WHO's CC scheme; no explicit open-licence field. | No Swahili validation found. | Excluded. |

**Important consequence to state in the submission.** **FACT:** instrument choice changes measured prevalence roughly fourfold in the same Kenyan women. At 6 weeks postpartum, n=3,605: CESD-10 13%, EPDS 9%, PHQ-2 5%, PHQ-9 3% (Larsen et al. 2023, [doi:10.1016/j.jad.2022.12.101](https://doi.org/10.1016/j.jad.2022.12.101)). **Any prevalence number MAMA-SAUTI produces is an artefact of instrument and cut-off as much as of burden, and the product must say so on screen** (see §15 microcopy and FR-24).

---

# 9. End-to-End User Journey

## 9.1 Flow overview

```
CHP opens MAMA-SAUTI on her Android
        ↓
[S1] Home / today's visits          → taps "Anza uchunguzi" (Start screening)
        ↓
[S2] Mother identity                → types name + age, or picks an existing mother
        ↓
[S3] Consent                        → reads spoken script; taps Yes / No
        ↓                                              └─ No → [S9] Ended, nothing stored
[S4] Conversation (loop)            → PTT record → transcript → extraction → probe
        ↓                                              └─ risk hit → [S5] Escalation (interrupt)
        ↓  (agent decides: probe → loop  |  escalate → S5  |  complete → S6)
[S6] Review & confirm               → CHP confirms amber items, corrects, back-reads to mother
        ↓
[S7] Result & referral              → band, score, routed tier, reason
        ↓
[S8] Handover                       → English facility summary; record persisted; audio deleted
        ↓
[S1] Home (record appears in list)
```

## 9.2 Step-by-step specification

### Step 1: Discovery and launch

| | |
|---|---|
| **User action** | CHP opens the web app from a home-screen shortcut. |
| **System action** | Loads shell, restores CHP code from `localStorage`, lists today's screenings. |
| **AI action** | None. |
| **Data created** | Session start timestamp. |
| **UI state** | `[S1] Home`, populated or empty. |
| **Possible failure** | No network on cold load. |
| **Recovery** | Cached shell renders; a banner states screening requires network for this version; past records readable from cache. |
| **Success condition** | Usable interface in <3 s on a mid-range Android over 3G. |

### Step 2: Understanding what the tool does

| | |
|---|---|
| **User action** | Reads a two-line purpose statement on the home screen. |
| **System action** | Static. |
| **AI action** | None. |
| **UI state** | Purpose line always visible on `[S1]`, never behind a menu. |
| **Copy (SW)** | *"MAMA-SAUTI inasikiliza mazungumzo yenu na kuandaa uchunguzi wa afya ya akili. Haitoi utambuzi wa ugonjwa."* |
| **Copy (EN)** | *"MAMA-SAUTI listens to your conversation and prepares a mental health screening. It does not diagnose."* |
| **Success condition** | The non-diagnosis statement is visible before any recording is possible. **[SR]** |

### Step 3: Mother identity

| | |
|---|---|
| **User action** | Types the mother's name and age, or selects an existing mother. |
| **System action** | Creates or retrieves `mother_id`. |
| **AI action** | None. **Names are never derived from audio.** (§5.7: names are the worst ASR entity class in this setting.) |
| **Data created** | `mother { id, display_name, age, chp_code, created_at }` |
| **UI state** | `[S2]`, two fields, large targets. |
| **Possible failure** | Mother declines to give a name. |
| **Recovery** | An "Anonymous" toggle produces an initials-only local reference. Screening proceeds. |
| **Success condition** | ≤20 s, ≤2 fields. |

### Step 4: Consent

| | |
|---|---|
| **User action** | CHP reads the on-screen script aloud in Kiswahili, then taps `Amekubali` (she agreed) or `Amekataa` (she declined). |
| **System action** | On agree: writes a consent record and enables recording. On decline: terminates, writes nothing except an anonymous declined-count. |
| **AI action** | None. Consent is never inferred from speech. **[SR]** |
| **Data created** | `consent { session_id, granted: bool, granted_at, script_version, audio_retention_opt_in: false }` |
| **UI state** | `[S3]`, recording controls disabled until resolved. |
| **Possible failure** | CHP taps agree without reading the script. |
| **Recovery** | Unavoidable in software; mitigated by keeping the script to four short sentences and by CHP training. **Documented as residual risk in §20.6.** |
| **Success condition** | No audio can be captured before `granted == true`. Enforced server-side, not only in the UI. |

**Consent script v1 (Kiswahili, with English gloss shown to the CHP):**
> *"Ningependa tuongee kuhusu jinsi umekuwa ukijisikia tangu ujifungue. Nitatumia simu hii kusikiliza na kuandika. Sauti yako itafutwa mara moja baada ya kuandikwa. Maandishi yataenda kwa daktari wa kliniki peke yake. Unaweza kusimamisha wakati wowote, na hakuna lazima."*
>
> "I'd like us to talk about how you have been feeling since you gave birth. I will use this phone to listen and write it down. Your voice will be deleted immediately after it is written. The writing goes only to the clinic health worker. You can stop at any time, and there is no obligation."

Four things this script does deliberately: names the purpose without the word "mental"; discloses recording; states deletion; states the recipient; and gives an unconditional exit. Note the deliberate absence of *"afya ya akili"* in the opening line, because leading with it triggers the stigma response documented in §4.2. The full purpose is on screen (§9.2 Step 2) and the CHP names it if the mother asks.

### Step 5: Conversation turn, the mother speaks

| | |
|---|---|
| **User action** | CHP asks an opening question, holds/taps record, holds the phone toward the mother. Mother speaks freely, 20–120 s. |
| **System action** | `MediaRecorder` captures WebM/Opus, mono, 16 kHz target. Live level meter. Hard cap at **110 s** with a 10 s warning (Sahara's sync endpoint caps at 120 s). |
| **AI action** | None during capture. **No live transcription.** (Rationale in §10.4.) |
| **Data created** | `turn { id, session_id, index, audio_blob (transient), duration_ms, started_at }` |
| **UI state** | `[S4-recording]`: large pulsing control, elapsed timer, live level meter, `Simamisha` (stop). |
| **Possible failure** | Mic permission denied · silence · overwhelming noise · >110 s. |
| **Recovery** | Permission: explicit instruction card with the Android path. Silence (level below floor for >5 s of a >8 s recording): non-blocking amber hint. Noise: pre-emptive warning at capture time, not after. Overlength: auto-stop at 110 s, turn preserved, prompt to continue in a new turn. |
| **Success condition** | Audio captured and uploaded, or a specific, actionable error. Never a silent failure. |

**Opening question, v1 (deliberately open, deliberately not clinical):**
> *"Tangu ujifungue, umekuwa ukijisikiaje? Niambie tu vile mambo yamekuwa."*
> ("Since you gave birth, how have you been feeling? Just tell me how things have been.")

### Step 6: Speech processing

| | |
|---|---|
| **User action** | Waits. |
| **System action** | Server proxy POSTs to `https://infer.voice.intron.io/file/v1/upload/sync` with `use_language_asr_input="sw"`, Bearer auth. On 503-with-`file_id`, falls back to polling `/file/v1/status/{file_id}`. |
| **AI action** | Sahara v2.5 code-switched ASR. |
| **Data created** | `transcript { turn_id, text, model: "sahara-v2.5", asr_latency_ms, chars_per_second }` |
| **UI state** | `[S4-processing]`: *"Inasikiliza..."* with a determinate-feeling progress treatment. |
| **Possible failure** | Network drop · 429 rate limit (30/min on sync) · `QUOTA_EXCEEDED` / insufficient credits · `INSUFFICIENT_AUDIO_ACTIVITY` · timeout. |
| **Recovery** | Retry with exponential backoff honouring `Retry-After`. Audio held in memory so retry costs the mother nothing. On quota exhaustion, a specific message, not "something went wrong". |
| **Success condition** | Transcript returned. **p95 ≤ 6 s for a 60 s turn.** |

### Step 7: Code-switch handling and deletion check

| | |
|---|---|
| **System action** | Token-level language tagging of the transcript; compute `chars_per_second`; run the deletion-signature detector (SH1). |
| **AI action** | Language tagging. |
| **Data created** | `transcript.language_spans[]`, `transcript.deletion_suspected: bool` |
| **UI state** | If suspected: amber strip, *"Tunaweza kuwa tumekosa sehemu ya aliyosema. Rekodi tena?"* ("We may have missed part of what she said. Record again?") Non-blocking. |
| **Possible failure** | False positive on a genuinely terse answer. |
| **Recovery** | Always dismissible. Never blocks. Never auto-discards a turn. |
| **Success condition** | Deletion suspicion surfaced before extraction runs on a truncated transcript. |

### Step 8: Safety scan (runs before extraction, always)

| | |
|---|---|
| **System action** | **Deterministic** regex + fuzzy match of the bilingual risk lexicon against the **raw transcript**, not the LLM output. |
| **AI action** | None. This step contains no model. **[SR]** |
| **Data created** | `safety_hit { turn_id, matched_phrase, lexicon_id, span, severity }` |
| **UI state** | On hit: **immediate full-screen interrupt** `[S5]`. Everything else pauses. |
| **Possible failure** | Miss (false negative). This is the P0 failure of the entire system. |
| **Recovery** | Layered: (a) lexicon includes hedged and indirect forms, not only explicit ones; (b) the extraction LLM independently sets `risk_flag` and **either source triggers escalation**; (c) an explicit CHP-initiated `Alama ya hatari` (raise risk flag) button is present on every conversation screen so the human is never dependent on the machine. |
| **Success condition** | **SPR = 1.00 on the safety test set.** Any miss is a release blocker (§26.11). |

### Step 9: Extraction and reasoning

| | |
|---|---|
| **System action** | Sends transcript + accumulated coverage state + idiom lexicon to the extraction LLM with a strict JSON schema. |
| **AI action** | For each PHQ-9 and GAD-7 construct: is there evidence? Returns `evidence_span` (**verbatim, must be a literal substring of the transcript**), `span_language`, `idiom_id`, `severity_estimate`, `confidence`, `reasoning`. |
| **Data created** | `extraction { turn_id, items[], model, latency_ms }` |
| **UI state** | `[S4-extracted]`: evidence cards, each quoting the mother, with a construct label and a confidence band. **The transcript is collapsed below, available on tap.** **[CR-C2]** |
| **Possible failure** | Hallucinated evidence span · over-extraction from a somatic-only statement · schema violation. |
| **Recovery** | **Hard validation: any `evidence_span` that is not a literal substring of the transcript causes that item to be dropped and logged.** Not repaired, not fuzzy-matched. Dropped. Somatic-only statements are structurally prevented from scoring alone (§12.4). Schema violation → one retry, then the turn is marked extraction-failed and becomes a manual probe. |
| **Success condition** | Every populated construct carries a span that provably exists in the transcript. |

### Step 10: Agent decision

| | |
|---|---|
| **System action** | Updates coverage state; selects one of three actions: `PROBE`, `ESCALATE`, `COMPLETE`. |
| **AI action** | If `PROBE`: generates **one** follow-up question targeting the highest-value uncovered construct, phrased in the mother's dominant register using her own vocabulary. |
| **Data created** | `agent_decision { turn_index, action, target_construct, generated_probe, rationale }` |
| **UI state** | Probe shown as a **suggestion card** to the CHP with `Uliza` (ask) and `Ruka` (skip). It is never auto-spoken. |
| **Possible failure** | Probe is clinically clumsy, leading, or repeats a covered construct. |
| **Recovery** | CHP can always skip. Covered constructs are excluded from targeting by construction. Turn budget caps the loop at 6 turns. |
| **Success condition** | The probe references something the mother actually said. **This is the agentic proof point and it must be visible in the demo.** **[CR-C3]** |

### Step 11: Completion, scoring and verification

| | |
|---|---|
| **User action** | Reviews the record. Confirms or corrects amber items. Reads the back-read to the mother. |
| **System action** | Computes PHQ-9 total (0–27), GAD-7 total (0–21), PHQ-2 and GAD-2 sub-scores, assigns a band, determines referral tier. |
| **AI action** | Generates the Kiswahili back-read and the English facility summary. |
| **Data created** | `ScreeningRecord` v1 (schema in §11.8). |
| **UI state** | `[S6]` review → `[S7]` result. |
| **Possible failure** | CHP confirms without reading; mother disputes a quote. |
| **Recovery** | Amber items require an explicit per-item tap, not a single bulk confirm. A `Amekanusha` (she disagrees) control on each evidence card removes the item and records the disagreement. |
| **Success condition** | No record is written containing an unconfirmed medium-confidence item. |

### Step 12: Downstream action and handover

| | |
|---|---|
| **System action** | Persists the record. **Deletes the audio.** Generates the referral. Renders the English handover summary. |
| **AI action** | Summary generation, constrained to quoting only spans already in the record. |
| **Data created** | `referral { record_id, tier, reason, generated_at }`; audio blobs destroyed. |
| **UI state** | `[S8]` handover card, copyable / shareable. |
| **Possible failure** | Write fails. |
| **Recovery** | Record held in `localStorage` and retried. **The success screen is never shown before the write is confirmed.** **[SR]** (See §12.6: never pretend success.) |
| **Success condition** | Record persisted, audio deleted, referral rendered, and the CHP knows which of the three tiers it went to and why. |

## 9.3 The escalation branch

Triggered from any turn by any of: deterministic lexicon hit, LLM `risk_flag`, PHQ-9 item 9 evidence at any severity, or the CHP's manual button.

1. Recording stops. All other UI is suppressed.
2. `[S5]` shows: *"Simama. Ongea naye sasa."* ("Stop. Talk with her now.") The instruction is to attend to the person, not to the phone.
3. The matched verbatim quote is shown so the CHP knows what triggered it.
4. **A short spoken script** for the CHP, including the legal-status line: *"Kufikiria kujiua sio kosa la jinai nchini Kenya"* ("Thinking about suicide is not a criminal offence in Kenya"), reflecting *KNCHR & 2 others v AG* [2025] KEHC 6, 9 January 2025.
5. **Verified crisis contacts** (tiering and caveats in §20.4).
6. `Nimeongea naye` (I have spoken with her) → the session continues or ends, but the escalation is written to the record **regardless of what happens next and cannot be removed.**

**Design rule: escalation is never suppressed by a confidence threshold, never batched to the end, and never reversible by an edit.**

### Escalation versus withdrawal of consent, resolved

These two requirements appear to collide, and the collision is real rather than a drafting error: FR-25 says an escalation is written irreversibly, and FR-27 says a mother who withdraws consent has everything deleted. The foreseeable case is not hypothetical: **a mother discloses, the crimson screen frightens her, and she asks to stop.**

**The resolution: withdrawal wins on data. Her duty of care does not live in the database.**

1. **Withdrawal deletes everything**, including the escalation record and the quote. There is no clinical-override exception, and building one would mean the consent promise on S3 is conditional in a way the mother was never told about. A screening tool that keeps a suicide disclosure against the discloser's explicit wish is a surveillance tool.
2. **"Irreversible" is scoped precisely: an escalation cannot be undone by an *edit* within a continuing session.** Removing the item, correcting the transcription, or recomputing the score cannot lower the tier (§11.8 rule 1). Only withdrawal of the whole session removes it, and that removes the session too.
3. **A single anonymous counter survives**, incremented on withdrawal-after-escalation. No identifier, no timestamp finer than the day, no content. It exists so that a pilot can detect if this is happening often, which would mean the escalation UI is frightening people into withdrawing.
4. **The CHP's obligation is not deleted, because it was never a database row.** S5 states this in the script before the withdrawal option is offered: *"Hata akikataa tuendelee, wewe umeshasikia. Ongea naye, na mjulishe msimamizi wako leo."* ("Even if she asks us to stop, you have already heard it. Talk with her, and tell your supervisor today.") This is a human safeguarding pathway, and it is the correct place for it. ⚠️ **It requires the CHP escalation protocol to exist outside the app; a pilot must write it and MOH must sign it off (§17.10 item 7).**

**Update FR-25 and FR-27 accordingly: neither is unconditional; both are scoped as above.**

---

# 10. Voice UX Specification

## 10.1 Voice entry point

**Options considered:**

| Option | Trade-off |
|---|---|
| Hold-to-talk | Physically impossible. Grace is holding a phone, a baby sling, and sometimes a register. A held finger for 90 seconds is not available. |
| **Tap-to-start / tap-to-stop** | Frees the hand. CHP controls boundaries. Explicit, visible state. Matches the WhatsApp voice-note mental model she already has. |
| Continuous / always-listening | Consent nightmare, captures third parties in a shared room, and burns credits. Ruled out on ethics before performance. |
| Voice-activated wake word | Fails in a noisy household. Adds a dependency for no user benefit. |

**RECOMMENDATION: tap-to-start / tap-to-stop, turn-based.** Rationale: hand availability is the binding physical constraint; explicit boundaries make consent legible to the mother (she can *see* when it is recording); and turn boundaries give us clean units for the agent loop and for the benchmark. **Locked.**

## 10.2 Listening state

Large circular control, filled, gently pulsing at ~0.8 Hz. **A live amplitude meter, not a decorative waveform**, because it is doing a real job: it tells Grace whether the phone is picking the mother up before ninety seconds are wasted. Elapsed timer in `MM:SS`. Amber at 100 s, auto-stop at 110 s. One `Simamisha` control. **Nothing else on screen.**

## 10.3 Processing state

*"Inasikiliza..."* then *"Inaelewa..."* ("Listening" → "Understanding"). Two named phases, because a single indeterminate spinner over a 6-second wait reads as a hang on a slow connection. Cancel is available throughout. **Never show a fake progress percentage.**

## 10.4 Transcription state: no live transcription

**RECOMMENDATION, and this one is counter-intuitive so the reasoning is recorded.** We do **not** stream live transcription, despite Sahara offering a streaming WSS endpoint.

Four reasons: (1) **Ethnographic.** Live text scrolling on a phone screen pulls Grace's eyes off the mother during a disclosure about self-harm. The interface must not compete with the human moment. (2) **Trust.** Partial hypotheses on a code-switched utterance are frequently and visibly wrong, and each visible error costs credibility with the mother watching the screen. (3) **Cost.** Streaming adds real complexity for a 4-day build with a two-person team. (4) **Evaluation parity.** The file endpoint is what our benchmark measures, so product and benchmark stay comparable.

The transcript appears **after** the turn, below the extracted evidence, collapsed by default. **Post-turn, verbatim, mixed-language, untranslated.**

## 10.5 Confirmation state and confidence thresholds

Confirmation costs the CHP's attention and the mother's patience. We spend it only where it changes something.

| Band | Threshold | Behaviour |
|---|---|---|
| **High** | `confidence ≥ 0.85` | Populate. Shown green. **No confirmation.** |
| **Medium** | `0.60 ≤ confidence < 0.85` | Populate. Shown amber. **Requires a per-item tap before the record is written.** |
| **Low** | `confidence < 0.60` | **Do not populate.** Becomes a probe target. Silence beats a guess. |
| **Safety** | any confidence | **Escalate immediately. Thresholds do not apply.** |
| **Numbers, dates, names** | any confidence | **Always confirmed.** Highest ASR error class; Swahili clock offset applies. |

Always confirm: any item feeding the risk band; the final score before submission; the referral tier. Never confirm: individual word choices; the transcript itself; anything green.

## 10.6 Correction

| What | How |
|---|---|
| **A whole extracted item** | Tap the evidence card → `Sahihisha` (correct) → re-record just that item, or set severity manually. Original is retained in provenance, not overwritten. |
| **The mother disputes a quote** | `Amekanusha` on the card → item removed, disagreement recorded. **The mother's disagreement is itself data and must survive into the record.** |
| **A number or date** | Numeric stepper, never free text. Swahili↔English clock conversion shown explicitly: *"saa nne usiku = 10:00 PM"*. |
| **A name** | Typed. Never audio-derived. |
| **The intent of a whole turn** | Discard the turn and re-record. Coverage state rolls back. |

## 10.7 Interruption

The CHP can stop recording at any point with one tap. She can pause a session (baby crying, neighbour arrives, mother needs a moment) and resume with state intact (SH5). She can end a session at any time and choose whether to keep the partial record. **The mother's withdrawal of consent mid-session deletes everything already captured in that session**, and this is a one-tap action for the CHP, not a settings-menu action. **[SR]**

## 10.8 Error recovery

| Failure | Behaviour |
|---|---|
| Audio unclear / low activity | *"Sauti haikusikika vizuri. Sogeza simu karibu kidogo."* ("The voice wasn't clear. Move the phone a bit closer.") Re-record, same turn index. |
| Low ASR confidence | Do not extract. Convert to a probe. Never guess a clinical construct. |
| Deletion suspected | Amber strip, offer re-record, non-blocking. |
| Third language detected | Mark span `unrecognised_language`, do not extract from it, suggest asking her to repeat in Kiswahili or English. **Never hallucinate a Swahili reading.** |
| Intent unclear | Agent probes with a clarifying question rather than resolving the ambiguity on its own. |
| Network fails | Turn audio is retained; retry with backoff; if the session is completed offline, the record is queued (SH4, should-have) and the UI **states plainly that it has not been sent yet.** |
| Sahara returns 429 / quota exceeded | Named, specific message with what to do. Not a generic error. |
| Extraction LLM fails | One retry, then the turn is marked extraction-failed and the CHP is given a manual entry path for that construct. The screening is not lost. |

## 10.9 Voice and copy personality

MAMA-SAUTI has no synthesised voice (§8.5). Its "voice" is the microcopy Grace reads and the probes it suggests.

| Dimension | Setting |
|---|---|
| **Formality** | Warm-professional Kiswahili. Not textbook *sanifu*, not slangy. The register a respected senior CHP uses. |
| **Warmth** | Present but not performed. No emoji, no exclamation marks, no cheerfulness about a depression screen. |
| **Brevity** | Probes ≤ 20 words. Instructions ≤ 12 words. Grace is reading this while conducting a conversation. |
| **Assertiveness** | Assertive only about safety and about its own limits. Never assertive about a clinical conclusion. |
| **Empathy** | Expressed by preserving her words, not by adding sympathetic phrases. **The system never says "pole sana" on its own behalf.** Sympathy is Grace's job; she is the human in the room. |
| **Professionalism** | Never uses a diagnostic label. Never says "depression" as a conclusion. Says "screening", "referral", "band". |
| **Cultural appropriateness** | Never leads with *afya ya akili*. Never uses *mwendawazimu* or *pagawa* in output copy (they are recognition-lexicon entries only). Uses *kusikitika* rather than *huzuni* for ordinary low mood, per Wahid 2025. |

## 10.10 Language behaviour rules (exact)

These are implementation rules, not guidance.

1. **Never ask the user to choose a language.** No selector exists anywhere in the product.
2. **Compute the mother's language mix per session** as the token-weighted proportion of Swahili vs English vs Sheng across her turns. Store as `session.language_profile`.
3. **Mirror the matrix language.** Probes are generated in her dominant matrix language, with English or Sheng insertions preserved **where and only where she used them**.
4. **Never translate her idiom back at her.** If she said *mawazo mengi*, the probe says *mawazo mengi*. It never says *"mawazo mengi (excessive rumination)"* and never substitutes a clinical Kiswahili coinage.
5. **Never introduce clinical English she did not use.** If she has not said "depression", no probe contains it.
6. **The facility handover summary is in English**, because that is what the clinical officer reads and what MOH forms use, **with her quotes preserved verbatim and untranslated, each followed by a bracketed gloss.**
7. **The back-read to the mother is in her own mix**, at her measured proportions.
8. **Mixed-language transcripts are displayed as spoken.** Normalising to one language on screen is prohibited.
9. **If her mix is majority-English, the product does not switch to English-only.** Kiswahili scaffolding remains, because the CHP's reading register is not necessarily the mother's speaking register.

---

# 11. Agentic Workflow Specification

## 11.1 The loop

```
        ┌──────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      │
  [1] VOICE INPUT           CHP taps record, mother speaks      │
        ↓                                                       │
  [2] SPEECH RECOGNITION    Sahara v2.5, use_language_asr_input="sw"
        ↓                                                       │
  [3] CODE-SWITCH HANDLING  token LID, CMI, deletion-signature check
        ↓                                                       │
  [4] SAFETY SCAN           deterministic lexicon, NO MODEL ──→ ESCALATE
        ↓                                                       │
  [5] EXTRACTION            PHQ-9/GAD-7 evidence + verbatim spans
        ↓                                                       │
  [6] VALIDATION            span-is-substring check; drop violations
        ↓                                                       │
  [7] STATE UPDATE          coverage map, confidence, language profile
        ↓                                                       │
  [8] DECISION              PROBE ──────────────────────────────┘
        ↓                   ESCALATE → §9.3
        ↓                   COMPLETE ↓
  [9] SCORING               PHQ-9, GAD-7, PHQ-2, GAD-2, band
        ↓
 [10] VERIFICATION          amber items confirmed; back-read to mother
        ↓
 [11] ACTION                persist record, delete audio, route referral
        ↓
 [12] CONFIRMATION          English handover to facility; CHP sees tier + reason
```

## 11.2 Input

Turn audio (WebM/Opus, mono, 20–110 s) plus session context: `mother_id`, turn index, accumulated coverage state, and `language_profile`. **No PII beyond a display name enters any model prompt.**

## 11.3 Understanding: what the AI extracts

Per turn, a strict JSON object. **Every field is required. There are no optional clinical fields.**

```jsonc
{
  "turn_index": 3,
  "language_profile": { "sw": 0.71, "en": 0.19, "sheng": 0.10, "unknown": 0.00 },
  "risk_flag": false,
  "risk_evidence": null,
  "items": [
    {
      "instrument": "PHQ9",
      "item_number": 3,                       // sleep
      "construct": "sleep_disturbance",
      "evidence_span": "Mtoto akilala mimi sikulali. Nabaki tu nimekaa, naangalia dari.",
      "span_language": "sw",
      "idiom_id": null,
      "severity_estimate": 2,                 // 0-3, PHQ-9 scale
      "severity_basis": "reported most nights, not attributable to infant waking",
      "confidence": 0.88,
      "somatic_only": false,
      "reasoning": "Explicitly distinguishes her own wakefulness from the infant's; frequency implied by 'akilala' as habitual."
    }
  ],
  "constructs_addressed_but_negative": ["phq9_5_appetite"],
  "unrecognised_language_spans": []
}
```

**Non-negotiable extraction rules, enforced in the prompt and again in code:**

1. `evidence_span` **must be a literal substring of the transcript.** Validated post-hoc. Violations drop the item and log an alert. Not repaired.
2. **Never infer severity from tone, pace, or anything not in the text.** The model receives text only, so any claim about affect in the voice is a hallucination by construction.
3. **`somatic_only: true` caps `severity_estimate` at 1 and `confidence` at 0.59**, which forces it below the population threshold and converts it into a probe. See §12.4.
4. **An item the mother explicitly denied goes into `constructs_addressed_but_negative`**, not into `items` with severity 0. Denial and absence are different states and the coverage map must distinguish them.
5. **`risk_flag` is set on any expression of self-harm, hopelessness about existing, or wishing not to be alive**, including hedged forms. **Bias toward false positives. The cost asymmetry is not close.**
6. **Known-prompt suppression.** Any `evidence_span` that substantially matches the probe text issued for that turn is **dropped, not scored**. See §11.3a; this is the rule that replaces diarization.

## 11.3a Diarization: why it is out, and what replaces it

**The real risk is not "we do not know who spoke." It is narrower and worse: the CHP's own words become the mother's clinical evidence.** The CHP reads a probe aloud containing the phrase *mawazo mengi*; the recording catches it; extraction quotes it back as evidence that the mother reported rumination. That is a false positive manufactured by the system's own question, on the exact construct the product exists to measure.

**Diarization is cheap to obtain and was wrongly excluded on cost.** **FACT, verified on [docs.voice.intron.io](https://docs.voice.intron.io/docs/stt/file-upload-sync):** the file-sync endpoint accepts `use_diarization` (`TRUE | FALSE`) as a form field. It is one line, not a Python service. Any cost-based argument against it is wrong and has been removed from §8.5.

**Three reasons it stays out anyway, in ascending order of importance.**

1. **Latency.** It is post-processing on a round trip, inside a budget (§14.1) that is already tight enough to have needed revision once.

2. **It cannot be measured.** ⚠️ AfriSwitchCare Swahili carries **no speaker markers at all** (`num_turns` is null; the card states Swahili transcripts have no `[Speaker N]` labels). So the primary in-domain benchmark set cannot score diarization accuracy. **In a competition judged on Technical Execution, an unmeasured component is worth less than a measured, explained absence.**

3. **⚠️ It probably conflicts with the safety architecture, and this is the decisive one.** `use_diarization` is listed under **"Post processing options"**, which strongly suggests it is produced by Sahara's LLM post-processor rather than by an acoustic model. The product deliberately runs `use_disable_llm_corrections=TRUE` (corrections **off**) precisely so that the deterministic safety scan reads raw output and the verbatim quotes are genuinely hers (§17.5). **If diarization requires the post-processor, enabling it silently re-breaks both guarantees**: a correcting LLM returns upstream of the safety scan, and the quotes read back to the mother stop being literally what she said.

**When to revisit, and it is not now.** Diarization is a **stretch item gated on the T+24 milestone**: attempt it only if the MVP is functionally complete on time, every §25.4 Agent Done box is ticked, and Milestone 5's polish box is not at risk. It is never a reason to extend T+24. If that gate is met, run the test below; if it is not, the decision stands and `LIMITATIONS.md` says so.

**The test itself takes five minutes.** Call the endpoint with `use_diarization=TRUE` **and** `use_disable_llm_corrections=TRUE` together, on a two-speaker clip. Three possible outcomes:
- **Speaker labels returned and corrections still off** → diarization is acoustic and independent. Reason 3 evaporates and only the measurement gap remains. **Add it as SH7 and ship it**, since at that point it is one form field and it strengthens the third-party story.
- **Labels returned but the transcript is visibly smoothed** → the flag re-enables the post-processor. **Leave it off.** The safety guarantee outranks the attribution improvement.
- **Flags are mutually exclusive, or labels are absent** → decision stands, and the result is worth one line in `BENCHMARK.md` because nobody else will have tested the interaction.

**What replaces it, at roughly thirty minutes of work.**

**(a) The turn boundary already is the diarization.** Push-to-talk means the CHP asks her question, *then* records (§10.1). Speaker separation is achieved by the UI affordance rather than by a model. Leakage happens only at the edges, when the CHP keeps recording while saying *"mmh, endelea"* or prompts mid-turn.

**(b) Known-prompt suppression closes the dominant edge case.** The system **generated the probe**, so it knows exactly what the CHP was about to say. At span-validation time:

```
probe = state.probe_issued_for_turn(turn_index)      # may be null on turn 1
if probe and token_overlap(normalise(span), normalise(probe)) >= 0.6:
    drop(item); log("known_prompt_suppressed", item.construct)
```

No new dependency, no latency, no model. It catches the precise failure where the product quotes its own question back as her answer. **This is a better fit than diarization because it targets the actual risk rather than the general problem.**

**(c) The third-party case is flagged, not solved.** A husband answering for her (§21.1) is a genuine harm and known-prompt suppression does not touch it. Full diarization would help, and the honest position is that **MVP mitigates this with a weak heuristic and says so in `LIMITATIONS.md`** rather than claiming coverage it does not have.

## 11.4 Idiom matching

Fuzzy, lexicon-driven, and auditable. Given accent and orthographic variation (§5.6), exact matching would fail constantly.

- Normalise: NFC → lowercase → strip punctuation. **Do not strip diacritics** (see §18.7 for why Intron's own harness does, and why that is wrong for a lexicon).
- Match: token-level fuzzy match, Levenshtein ratio ≥ 0.85 on the phrase, plus a stem-based variant set per lexicon entry (`kufikiria` / `kufikiri` / `nafikiria` / `anafikiria`).
- **Record the matched `idiom_id` on the item so a reviewer can audit which lexicon entry fired.** An idiom match raises confidence by at most +0.10 and never sets severity on its own.

## 11.4a The safety lexicon (`data/safety_lexicon.csv`)

This is the most safety-critical artifact in the product and it therefore gets a specification rather than a filename.

**Schema:** `id, phrase, language, register, form, severity, source, clinician_reviewed (bool), added_at`
`form` ∈ `explicit | idiomatic | hedged | passive | third_person`.
`severity` ∈ `active_intent | ideation | passive_ideation | hopelessness`. **All four escalate. Severity is recorded for the clinician, never used as a threshold.**

**Minimum coverage before release, by form.** The lexicon must contain entries in every cell of this grid, in Kiswahili, English and Sheng:

| Form | Kiswahili example | English example |
|---|---|---|
| **explicit** | *kujiua*, *kujidhuru* | "kill myself", "hurt myself" |
| **idiomatic** | *kujitia kitanzi* (attested, Panneh 2022) | "end it" |
| **hedged** | *ingekuwa poa kama singekuwepo* | "better off without me" |
| **passive** | *nimechoka na maisha*, *sitaki kuamka* | "don't want to wake up", "can't go on" |
| **third_person** | *mtoto atakuwa sawa bila mimi* | "the baby would be fine without me" |

**Three engineering rules that follow from the product's own thesis.**

1. **Match on tokens, not on whole phrases.** FR-09's `≥0.85` Levenshtein ratio is computed **per content token**, not across the full phrase. The document's central claim is that ASR *deletes words*; a phrase-level ratio would drop below threshold on exactly the deletion this product exists to catch. A hit on any two content tokens of a multi-token entry, in order, escalates.
2. **Match the raw transcript, before any normalisation that strips negation.** Swahili negation is morphological (*si-*, *ha-*), so a normaliser that strips prefixes can turn a denial into an affirmation or vice versa. The safety scan runs before normalisation.
3. **Fail closed.** If the scan throws, times out, or cannot run, **escalate**. A scan that did not complete is treated as a hit, not as a pass. §14.2's earlier claim that "there is no failure mode where a transcript is produced and the scan is skipped" is replaced by this rule, which is achievable.

⚠️ **`clinician_reviewed` must be `true` for every row before the demo is recorded.** This is the one artifact in the MVP that a software engineer should not author alone. If no clinician is reachable in time, say so in `LIMITATIONS.md` rather than implying review that did not happen.

## 11.4b Deterministic backstop on the somatic-only rule

§12.4's somatic-only rule is the product's central behavioural claim. As originally specified it was enforced by `somatic_only`, a **boolean the extraction model sets about its own output**, which means the model polices itself. That is not enforcement, and a judge who asks "what sets `somatic_only`?" deserves a better answer.

**The backstop, which runs in code after extraction:**

```
somatic_terms   = lexicon of bodily-complaint terms (sw/en/sheng):
                  kichwa, mgongo, tumbo, mwili, maumivu, kuuma, homa, kizunguzungu,
                  "headache", "pain", "body", "tired", "dizzy", "ache", ...
psych_markers   = idiom_lexicon phrases ∪ affective terms:
                  mawazo, fikiria, moyo, huzuni, stress, worry, sad, alone, hopeless, ...

for item in extraction.items:
    span = normalise(item.evidence_span)
    if span ∩ somatic_terms ≠ ∅ and span ∩ psych_markers = ∅:
        item.somatic_only = True          # forced, overriding the model
        item.severity_estimate = min(item.severity_estimate, 1)
        item.confidence        = min(item.confidence, 0.59)
        log("somatic_backstop_fired", item.construct)
```

**The model may set `somatic_only = true`. It may not set it to `false` against the backstop.** The override is one-directional, which is the correct asymmetry: over-caution costs a probe, under-caution costs a false positive on the exact error the product exists to prevent.

**Honest limit, stated rather than glossed:** this is a lexicon, so it catches the clear cases and misses novel somatic phrasing. It reduces the failure from "the model decides" to "the model decides, unless the obvious case is present." The `somatic_backstop_fired` counter should be watched during testing; if it never fires, either the lexicon is too narrow or the model is already conservative, and it matters which.

## 11.5 Deletion-signature detector (SH1, promote to Must if time allows)

The clearest bridge between the benchmark and the product.

```
cps = len(transcript.strip()) / audio_duration_seconds
if cps < FLOOR:  →  deletion_suspected = true
```

`FLOOR` is calibrated on the AfriSwitchCare Swahili config: compute `cps` on gold transcripts, take the 5th percentile, subtract a safety margin. **Do not hardcode a guess. Derive it from the benchmark run and record the derived value in the repo.** This is a small feature with a large story: it converts *"we found that models delete embedded English"* into *"and here is the product behaviour that catches it in the field."*

## 11.6 Reasoning and the decision function

Coverage state per construct: `COVERED_HIGH` (≥0.85), `COVERED_MEDIUM` (0.60–0.85), `DENIED`, `PROBED_NO_ANSWER`, `UNCOVERED`.

```
decide(state) →
  if safety_hit or risk_flag                  → ESCALATE
  if turn_index >= MAX_TURNS (6)              → COMPLETE (flag: incomplete_coverage)

  # ---- THE ITEM-9 GATE. Evaluated before every completion path. ----
  if PHQ9_9 not in {COVERED_HIGH, COVERED_MEDIUM, DENIED, PROBED_NO_ANSWER}
                                              → PROBE (the fixed item-9 probe, §11.6a)
  # -----------------------------------------------------------------

  if PHQ2 covered and PHQ2_score < 3
     and GAD2 covered and GAD2_score < 3      → COMPLETE (short path, negative screen)
  if any core construct UNCOVERED             → PROBE (highest priority uncovered)
  if any construct COVERED_MEDIUM
     and turn_index < 6                       → PROBE (disambiguate)
  else                                        → COMPLETE
```

**Why the item-9 gate sits above the short path, and not inside the priority list.** An earlier draft of this decision function placed the negative short path first, which meant that a mother who screened negative on PHQ-2 and GAD-2 would complete the session **without ever being asked about self-harm**. That is exactly backwards: suicidal ideation is not conditional on a positive depression screen, and a low-scoring screen is the population where an unasked question is most dangerous. The gate is therefore a hard precondition on completion, not a priority-ranked preference. **Unit test: assert that no path through `decide()` returns `COMPLETE` while `PHQ9_9` is `UNCOVERED`.**

**Probe priority order** (clinical value per turn, highest first). Note that item 9 no longer appears here, because it is handled by the gate above rather than by ranking:
1. PHQ-2 stems: #1 anhedonia, #2 depressed mood. These gate everything.
2. GAD-2 stems: #1 nervousness, #2 uncontrollable worry.
3. Constructs with `somatic_only` evidence (the psychologising probe: this is where the product earns its thesis).
4. Remaining PHQ-9 items, function-first (#3 sleep, #4 energy, #5 appetite, #6 self-worth, #7 concentration, #8 psychomotor).
5. Remaining GAD-7 items.

**Probe generation constraints:**
- Exactly one question. Never a stacked pair.
- ≤ 20 words.
- Must reference something she already said, using her own words, when any evidence exists.
- Must not be leading (no *"Je, unahisi huzuni?"* / "Do you feel sad?"). Prefer open-then-anchor.
- Must not contain a clinical label.
- **Presented to the CHP as a suggestion with `Uliza` / `Ruka`. Never auto-spoken. The human decides what is asked in the room.**

**Worked example.** Mother said: *"Kichwa inauma kila siku... sifeel poa... ni kama kuchoka moyo."* Extraction yields `somatic_only: true` for PHQ-9 #4 (energy/fatigue), capped at confidence 0.59, so it does not populate. Priority rule 4 fires. Generated probe:

> *"Umesema unaskia* **kuchoka moyo** *. Hiyo hisia ya kuchoka, iko zaidi kwa mwili ama pia kwa mawazo?"*
> ("You said you feel *kuchoka moyo*. That tiredness, is it more in the body or also in your thoughts?")

Note what this does: it uses her exact idiom, it does not translate it, it does not name a diagnosis, and it asks the one question that separates a somatic complaint from a psychological one. It belongs in the demo.

## 11.6a The item-9 probe is fixed, not generated

**Every other probe in this product is generated at runtime. This one is not.**

The reasoning: the item-9 probe is the single highest-stakes utterance the system produces. It is read aloud, verbatim, to a woman who may be suicidal, by a health worker who is not a mental health practitioner, under time pressure, on the sixth visit of her day. An LLM generating that sentence fresh each time, under four simultaneous constraints (≤20 words, not leading, no clinical label, must reference her own words), is an unnecessary and unmanageable risk for a benefit that does not exist. Runtime variation buys nothing here.

**Fixed text, v1, to be reviewed by a Kenyan mental health clinician before use:**
> *"Wakati mwingine mama wanapopitia haya, huwa wanafikiria kujidhuru au kwamba maisha hayana maana. Wewe umewahi kufikiria hivyo?"*
> ("Sometimes when mothers go through these things, they think about harming themselves or that life has no meaning. Have you ever thought that way?")

Three things this wording does deliberately: it **normalises** before it asks, which is the standard clinical technique for reducing the under-endorsement documented in §4.2; it offers two doors (self-harm, or meaninglessness), because the second is easier to walk through first; and it asks about having *ever* thought it rather than about frequency, because a frequency question invites a minimising answer.

**Rules.** The text is stored in `data/probes/phq9_item9.<lang>.txt`, not in a prompt. It is presented with `Uliza` and `Ruka` like any other probe, so **the CHP may still skip it** if her judgement in the room says to. The *agent* may not skip it (§11.6). If the CHP skips, the construct is recorded as `PROBED_NO_ANSWER` and the record says so, rather than being silently absent.

⚠️ **Add this file to the never-cut list in §24.11.**

## 11.7 Tools available to the agent

| Tool | Purpose | Called by |
|---|---|---|
| `transcribe(audio, lang="sw")` | Sahara v2.5 file-sync ASR | Orchestrator, every turn |
| `safety_scan(transcript)` | Deterministic lexicon match | Orchestrator, every turn, **before extraction** |
| `extract(transcript, state, lexicon)` | Structured clinical extraction | Orchestrator, if no escalation |
| `validate_spans(extraction, transcript)` | Substring enforcement | Orchestrator, always |
| `update_coverage(state, extraction)` | Pure state transition | Orchestrator |
| `generate_probe(state, profile)` | One targeted question | Agent, on `PROBE` |
| `score(state)` | PHQ-9 / GAD-7 / PHQ-2 / GAD-2 totals and band | Agent, on `COMPLETE` |
| `route_referral(scores, flags)` | Deterministic tier assignment (§11.8) | Agent, on `COMPLETE` |
| `persist(record)` | DB write | Orchestrator, after confirmation |
| `purge_audio(session_id)` | Destroy blobs | Orchestrator, after persist |

**Note: `score` and `route_referral` contain no model.** They are deterministic functions of the confirmed item set. A clinical score produced by an LLM is not defensible and would not survive a judge's question.

## 11.8 Action: the downstream task

**The system produces:**

```jsonc
// ScreeningRecord v1
{
  "record_id": "uuid", "mother_id": "uuid", "chp_code": "KWG-014",
  "screened_at": "2026-09-13T10:42:00+03:00",
  "instrument_version": "PHQ9-GAD7-sw-v1",
  "consent": { "granted": true, "granted_at": "...", "script_version": "v1",
               "audio_retained": false },
  "language_profile": { "sw": 0.71, "en": 0.19, "sheng": 0.10 },
  "scores": {
    "phq2": 4, "phq9": 14, "gad2": 3, "gad7": 11,
    "phq9_band": "moderate",          // 14 is moderate, not moderately severe. See the band table below.
    "coverage": { "phq9_items_evidenced": 8, "gad7_items_evidenced": 6 }
  },
  "items": [ /* each with verbatim evidence_span, idiom_id, confidence,
                confirmed_by_chp: bool, mother_disputed: bool */ ],
  "risk": { "flagged": true, "source": "deterministic_lexicon",
            "matched_phrase": "ingekuwa poa kama singekuwepo",
            "escalated_at": "...", "chp_acknowledged": true },
  "referral": { "tier": "facility_urgent", "reason": "PHQ-9 item 9 evidence present",
                "routed_to": "Kawangware Health Centre", "generated_at": "..." },
  "asr": { "model": "sahara-v2.5", "lang_code": "sw",
           "turns": 5, "deletion_suspected_turns": [2],
           "mean_asr_latency_ms": 4120 },
  "disclaimers": ["not_a_diagnosis", "instrument_not_criterion_validated_in_swahili"]
}
```

**The band function** (standard PHQ-9 and GAD-7 severity bands; pure lookup, no model, unit-tested at every boundary):

| PHQ-9 total | `phq9_band` | Kiswahili label | GAD-7 total | `gad7_band` |
|---|---|---|---|---|
| 0–4 | `minimal` | *Kidogo sana* | 0–4 | `minimal` |
| 5–9 | `mild` | *Kidogo* | 5–9 | `mild` |
| **10–14** | **`moderate`** | *Wastani* | 10–14 | `moderate` |
| 15–19 | `moderately_severe` | *Juu ya wastani* | 15–21 | `severe` |
| 20–27 | `severe` | *Kali* | n/a | n/a |

**Referral routing (deterministic, no model). Rules are evaluated top-down and the first match wins; evaluation stops there.**

| # | Condition | Tier | Action |
|---|---|---|---|
| 1 | **An escalation event exists for this session** (safety hit, LLM `risk_flag`, PHQ-9 #9 evidence at any severity, or the CHP's manual flag) | **`facility_urgent`** | Same-day facility contact. Escalation card already shown. |
| 2 | PHQ-9 ≥ 15 or GAD-7 ≥ 15 | `facility_routine` | Referral to clinical officer within 7 days. |
| 3 | PHQ-2 ≥ 3 or GAD-2 ≥ 3 (matching IPMH trial thresholds, §7.5) | `facility_routine` | Referral within 14 days. |
| 4 | PHQ-9 ≥ 5 | `chp_followup` | CHP re-screens in 2 weeks. Repeat screening, per §3.3. |
| 5 | Otherwise | `chp_followup` | Routine re-screen at next scheduled visit. |
| n/a | Fewer than 6 PHQ-9 items evidenced **and the session did not terminate on the negative short path** | adds flag `incomplete` to whichever tier matched | Record states plainly that the screen was not completed. |

**Rule 1 is latched, not derived.** The condition is the existence of an `escalation` audit event, **not** the current contents of the item list. This closes a real hole: FR-18 lets the CHP remove a disputed item and §26.5 recomputes the score, so a routing rule that read "PHQ-9 #9 evidence is present" could be un-triggered by removing the card that triggered it. **Once a session escalates, `facility_urgent` cannot be lowered by any subsequent edit.** It can only be raised by a human.

**A note on rule 4 and the negative short path.** A short-path completion evidences only PHQ-2 and GAD-2, so it will always have fewer than 6 PHQ-9 items. It is a *deliberately* short screen, not an incomplete one, and the `incomplete` flag is suppressed for it. The record still carries `termination: short_path_negative` so a reviewer can see which it was.

**Note there is no `no_action` tier.** Given the fourfold instrument-dependence of measured prevalence (Larsen 2023) and the 44.1% PPV of even the validated Kenyan EPDS, a negative screen is not evidence of absence. Everyone gets at least a routine re-screen.

## 11.9 Verification

Three independent layers, and this is what makes the pipeline defensible:

1. **Mechanical.** Every `evidence_span` is verified to be a literal substring of the transcript. Failures drop the item and are logged. **One explicit exception: a failed span on the top-level `risk_flag` suppresses the quote, never the flag.** The escalation proceeds with "we could not verify the exact wording" in place of the quote. Validation exists to stop the system asserting things she did not say; it must never be a path by which a risk signal disappears.
2. **Human.** Every amber item requires an explicit per-item tap from the CHP. Bulk-confirm is deliberately not implemented.
3. **Source.** The back-read to the mother in her own language, before submission. She is the ground truth for what she said and she gets the last word. Her disagreement is recorded, not silently discarded.

## 11.10 Confirmation to the user

Grace sees: the band, the score, the tier, the reason, and the count of evidenced constructs. The mother hears: the back-read, and what is being sent where. The clinician receives: the English summary with quotes.

## 11.11 Escalation to a human

**Escalate always on:** any safety hit; PHQ-9 #9 evidence; the CHP's manual flag; three consecutive extraction failures; and `deletion_suspected` on more than half the turns in a session (because at that point we do not trust our own input).

**Escalate never on:** a low score alone, or an incomplete screen alone. Those flag the record; they do not summon a human.

---

# 12. AI Behavioral Specification

## 12.1 Communication style

Concise over detailed. Conversational over formal, but never casual about clinical content. Simple over technical: no MAMA-SAUTI copy contains the words "confidence interval", "extraction", "model", or "LLM". Reactive over proactive: it suggests exactly one probe at a time and does not volunteer clinical opinions.

## 12.2 Reasoning behaviour

**The AI must:** identify ambiguity and probe it rather than resolving it silently; ask for clarification only when the answer changes a construct; use accumulated session context so it never re-asks something covered; verify anything feeding the risk band; and communicate uncertainty by declining to populate rather than by hedging in prose.

**The AI must not:** infer a construct from a somatic statement alone; infer severity from anything outside the transcript text; produce a diagnostic label; produce a treatment recommendation; produce a prognosis; or generate an `evidence_span` that is not verbatim.

## 12.3 Confidence behaviour

As §10.5. One addition worth stating explicitly, because it is unusual and it is correct: **there is no confidence threshold on the safety path.** A 0.3-confidence risk signal escalates exactly as hard as a 0.95 one. The cost asymmetry between a false escalation (one uncomfortable conversation) and a false negative (a preventable death) is not within an order of magnitude of being close.

## 12.4 Challenging behaviour: the somatic-only rule

The single most important behavioural rule in the product, and the one that operationalises the problem this product exists to address.

**When the mother reports a physical symptom with no explicit psychological content, the system must not score a psychological construct. It must probe.**

```
if evidence is somatic_only:
    severity_estimate = min(severity_estimate, 1)
    confidence        = min(confidence, 0.59)   # forced below population threshold
    → item does not populate
    → construct enters PROBE priority tier 4
```

This is a deliberate refusal to over-read, and it cuts *against* the product's own interest in finding cases. It is grounded in Kaiser et al. 2015's explicit warning that *"'thinking too much' should not be interpreted as a gloss for psychiatric disorder"* and that these idioms have **variable, not equivalent, overlap** with depression, anxiety and PTSD. A system that maps *kichwa inauma* → depression is committing the mirror-image error of the clinician who maps it → painkillers. **Both are failures to ask a second question. Our product's contribution is that it asks the second question.**

**Other challenge cases:**

| Situation | Behaviour |
|---|---|
| Contradiction across turns ("silali kabisa" then "nalala vizuri") | Surface both quotes side by side, ask the CHP to clarify with her. **Never silently pick one.** |
| Under-endorsement suspected (flat denial of everything alongside strong somatic content) | Do not override her. Flag `possible_under_endorsement` on the record and note it in the handover. Velloza 2020 documents under-endorsement as the expected failure mode; the clinician should know we suspected it. |
| Request outside scope (medication, custody, diagnosis) | Refuse plainly and route: *"Hii ni swali la daktari. Tuandike kwenye rufaa."* ("This is a question for the clinician. Let's write it in the referral.") |
| Third party speaking (husband answering for her) | Flag `third_party_speech_suspected`. Do not extract confidently from it. Prompt the CHP to seek a private moment if possible. |

## 12.5 Memory behaviour

| | |
|---|---|
| **Remembered within a session** | Coverage state, language profile, extracted items with spans, turn count, risk flags. |
| **Remembered across sessions** | Mother display name, age, CHP code, prior `ScreeningRecord`s. Nothing else. |
| **Never stored** | Raw audio after transcription (deleted by default). Free-form CHP impressions. Anything the mother disputed **as an active item** (the disagreement itself is kept as an audit event). Third-party speech content. Household or GPS location. |
| **Expires** | Session working state expires at completion or after 24 h of inactivity. |
| **Requires explicit consent** | Any audio retention at all (default off, per-session opt-in, and it must be explained in the same breath). Any use of a recording for model improvement (**not offered in MVP at all**). |

## 12.6 Error behaviour: never pretend success

Hard rules, each of which maps to a real way products lie:

1. If the DB write fails, **the success screen is not shown.** The record stays local, the UI says it has not been sent, and it retries.
2. If ASR fails, we say ASR failed. We do not present an empty or partial transcript as a complete one.
3. If extraction fails, the construct is marked unevidenced. **We do not fill it with a plausible guess.**
4. If coverage is incomplete, the record says `incomplete` and the handover says so in the first line.
5. If the referral could not be routed, the CHP is told to route it manually and given the reason.
6. **No error message says "something went wrong."** Every one names what failed and what to do next.

---

# 13. Functional Requirements

Priority: **M** = Must (MVP), **S** = Should, **C** = Could. Every requirement carries its justification tag.

| ID | Requirement | Pri | User | Acceptance Criteria |
|---|---|---|---|---|
| **FR-01** | CHP can identify herself with a CHP code | M | CHP | Code persists in `localStorage`; appears on every record; changeable; no password in MVP **[TC]** |
| **FR-02** | CHP can create or select a mother record | M | CHP | Name + age; anonymous option; duplicate-name disambiguation by age; ≤20 s **[UV]** |
| **FR-03** | Consent must be captured before any audio is recorded | M | Mother | Script displayed in SW+EN; explicit agree/decline; **server rejects any audio upload for a session without `consent.granted == true`**; decline stores nothing but an anonymous counter **[SR][CR]** |
| **FR-04** | CHP can start and stop a recording turn | M | CHP | Tap start / tap stop; state visibly distinct; elapsed timer; amber at 100 s; auto-stop at 110 s; mic-permission denial produces a specific instruction card **[UV][CR]** |
| **FR-05** | System gives live audio-quality feedback during capture | M | CHP | Live amplitude meter; low-level hint after 5 s below floor in a >8 s recording; non-blocking **[UV]** |
| **FR-06** | Audio is transcribed by Sahara v2.5 in code-switched mode | M | System | POST to `/file/v1/upload/sync`, `use_language_asr_input="sw"`; 503-with-`file_id` falls back to status polling; retries honour `Retry-After`; **p95 ≤ 6 s for a 60 s turn** **[CR]** |
| **FR-07** | Transcript is displayed verbatim and mixed-language | M | CHP | No normalisation to one language; English gloss shown alongside, never instead; collapsed below evidence by default **[UV][PD][CR-C2]** |
| **FR-08** | Token-level language tagging and CMI computed per turn | M | System | `language_spans[]` populated; session `language_profile` updated; CMI stored **[CR][TC]** |
| **FR-09** | Deterministic safety scan runs on every raw transcript before extraction | M | Mother | Bilingual lexicon; fuzzy match ≥0.85; **contains no model**; a hit triggers `[S5]` within 500 ms of transcript receipt; **SPR = 1.00 on the safety test set is a release blocker** **[SR][CR]** |
| **FR-10** | Extraction maps transcript to PHQ-9 and GAD-7 constructs | M | System | Strict JSON schema; every populated item has `evidence_span`, `confidence`, `severity_estimate`, `idiom_id`, `somatic_only` **[UV][PD]** |
| **FR-11** | Every evidence span is validated as a literal substring of the transcript | M | System | Non-substring spans **drop the item and log**; never repaired; unit-tested with adversarial fixtures **[SR][TC]** |
| **FR-11a** | **Known-prompt suppression: a span matching the probe issued for that turn is dropped** | M | Mother | Token overlap ≥0.6 against the normalised probe text drops the item and logs `known_prompt_suppressed`. Closes the case where the CHP reads a probe aloud, the recording catches it, and the system quotes its own question back as her evidence. **Replaces diarization for the dominant attribution failure; §11.3a explains why that is the better trade.** Fixture: a turn whose transcript contains the probe verbatim must yield zero items from it. **[SR][PD]** |
| **FR-12** | Somatic-only evidence cannot populate a construct | M | Mother | `somatic_only == true` ⇒ `confidence ≤ 0.59` ⇒ not populated ⇒ enters probe tier 4; verified by test fixture **[SR][PD]** |
| **FR-13** | Coverage state is maintained and visible | M | CHP | Five states per construct; a visible coverage affordance; no covered construct is re-probed **[CR-C3]** |
| **FR-14** | Agent generates one targeted probe per turn in the mother's register | M | CHP | Exactly one question; ≤20 words; references her prior words when evidence exists; no clinical label; no leading form; shown with `Uliza`/`Ruka`; **never auto-spoken** **[CR-C3][PD]** |
| **FR-15** | Agent terminates on coverage, turn budget, or negative short-path | M | System | `MAX_TURNS = 8`; PHQ-2 <3 and GAD-2 <3 both covered ⇒ complete; incomplete coverage flags the record **[CR]** |
| **FR-16** | Scores are computed deterministically | M | System | PHQ-9, GAD-7, PHQ-2, GAD-2 from confirmed items only; **no model in the scoring path**; unit-tested against hand-computed vectors **[TC][SR]** |
| **FR-17** | CHP must confirm every amber item before the record is written | M | CHP | Per-item tap; **no bulk confirm**; green items need no action; write is blocked until all amber are resolved **[SR]** |
| **FR-18** | CHP can correct, dispute, or remove any item | M | CHP/Mother | `Sahihisha` re-records one item; `Amekanusha` removes it and records the disagreement as an audit event; originals retained in provenance **[UV][SR]** |
| **FR-19** | Record is persisted and retrievable per mother | M | CHP | `ScreeningRecord` v1; listed newest-first per mother; supports repeat screening across the perinatal window **[UV][CR]** |
| **FR-20** | Referral tier is assigned deterministically and shown with its reason | M | CHP/Clinician | Six rules of §11.8; no `no_action` tier; reason string always present **[UV][CR]** |
| **FR-21** | English handover summary is generated for the facility | M | Clinician | ≤120 words; band + instrument + cut-off named; **verbatim quotes preserved untranslated with bracketed gloss**; escalation reason first if present; readable in ≤15 s **[UV]** |
| **FR-22** | Back-read to the mother in her own language mix before submission | M | Mother | Generated at her measured proportions; shown for the CHP to read aloud; a `Amekanusha` control is available during the back-read **[SR][UV][PD]** |
| **FR-23** | Audio is deleted after transcription by default | M | Mother | Blobs destroyed once the transcript is persisted; retention is per-session opt-in only; deletion is verified in an integration test **[SR][CR]** |
| **FR-24** | The product never emits a diagnosis, and says so | M | All | No DSM/ICD code, no diagnostic label, no treatment or medication text anywhere in output; the non-diagnosis disclaimer is on the home screen, the result screen, and in the handover; `disclaimers[]` is non-empty on every record **[SR][CR]** |
| **FR-24a** | **Every model-generated string passes a deterministic denylist before it is rendered, spoken or persisted** | M | All | FR-24 is unenforceable by static string tests alone, because five surfaces are generated at runtime: the probe, the Kiswahili back-read, the English handover, and the `reasoning` / `severity_basis` free-text fields. A denylist pass runs over all five and blocks: DSM/ICD codes by regex (`F3[0-9](\.[0-9])?`), diagnostic nouns in English and Kiswahili (`depression`, `depressed`, `disorder`, `diagnosis`, `psychosis`, `mwendawazimu`, `pagawa`, `ugonjwa wa akili`), every INN in a small psychotropic list (`sertraline`, `fluoxetine`, `amitriptyline`, `diazepam`), and prescriptive verbs (`should take`, `anafaa kunywa`). **On a hit the string is regenerated once; on a second hit the surface falls back to a fixed safe template and the event is logged.** Unit-tested with adversarial strings. **[SR]** |
| **FR-25** | Escalation interrupt with verified crisis contacts and legal-status line | M | Mother | Full-screen; matched quote shown; CHP script; **only tier-A verified contacts** (§20.4); Kenya legal-status line present; acknowledgement required; **escalation is written to the record irreversibly** **[SR][CR][DV]** |
| **FR-26** | CHP can manually raise a risk flag at any time | M | CHP | Present on every conversation screen; produces the same `[S5]` interrupt as an automatic hit **[SR]** |
| **FR-27** | Consent can be withdrawn mid-session, deleting everything captured | M | Mother | One tap from the conversation screen; destroys session audio and extractions; leaves only an anonymous withdrawal counter **[SR]** |
| **FR-28** | Benchmark harness evaluates ≥4 ASR models on code-switched Swahili | M | Team | Sahara + 3; WER, CER, **EESR, CIR, SPR**, construct-extraction F1, **band-flip rate**, latency; one command; raw per-sample CSVs emitted **[CR][TC]** |
| **FR-29** | Benchmark results are visible inside the product | M | Judge | A "Kwa nini Sahara?" (Why Sahara?) page rendering the results table with method notes and the excluded-vendor rationale **[CR][DV]** |
| **FR-30** | Layout is usable at 360×640 | M | CHP | No horizontal scroll; targets ≥48 px; primary control thumb-reachable; verified on a real Android **[CR][UV]** |
| **FR-31** | Every error names what failed and what to do next | M | CHP | No generic error strings; enumerated in §21; a lint rule or test asserts the absence of "something went wrong" **[UV][TC]** |
| **FR-32** | Deletion-signature detector warns on suspected switch-boundary loss | **SH→M if time** | CHP | `FLOOR` derived from the AfriSwitchCare Swahili 5th percentile and recorded in the repo; amber, non-blocking, dismissible **[PD][TC]** |
| **FR-33** | Session pause and resume across an interruption | S | CHP | State survives; a resumed session is marked as such **[UV]** |
| **FR-34** | Referral card is shareable to WhatsApp or printable | S | Clinician | Plain text share; no PHI in the URL **[UV][DV]** |
| **FR-35** | Completed records queue offline and sync when connectivity returns | S | CHP | Local queue; UI states plainly that it is unsent; automatic retry **[UV]** |
| **FR-36** | Per-construct confidence is surfaced visually on the record | S | CHP | Green/amber banding on each evidence card **[TC][UV]** |
| **FR-37** | CHO supervisor aggregate view | C | Supervisor | Out of MVP **[n/a]** |
| **FR-38** | eCHIS / CHT FHIR integration | C | System | Out of MVP; the record schema is designed to map **[n/a]** |
| **FR-39** | EPDS as a second instrument | C | Clinician | **Blocked on written RCPsych clearance** (§20.5) **[n/a]** |
| **FR-40** | Structured event logging for evaluation | M | Team | Per-turn: ASR latency, cps, deletion flag, extraction latency, items produced/dropped, agent decision, confirmations, disputes. **No transcript content in logs.** **[TC][SR]** |

---

# 14. Non-Functional Requirements

## 14.1 Performance

| Metric | Target | Rationale |
|---|---|---|
| App shell interactive (3G, mid-range Android) | ≤ 3 s | Grace will not wait on a doorstep. |
| Upload, 60 s WebM/Opus turn, 3G | p95 ≤ 4 s | ~90 KB at Opus voice bitrates. Frequently the largest single component and it was omitted from an earlier draft of this table. |
| ASR round-trip (excluding upload), 60 s turn | p50 ≤ 4 s, p95 ≤ 6 s | Beyond ~8 s the conversation breaks and the mother disengages. |
| Local processing (LID, `cps`, safety scan, span validation, coverage) | p95 ≤ 0.5 s | |
| Extraction round-trip | p95 ≤ 3 s | |
| **Stop-record → evidence on screen** | **p95 ≤ 14 s** | **The only number that matters, and it is measured end to end.** It is deliberately *not* the sum of the component p95s above: component p95s do not add to a composite p95, and an earlier draft's 9 s target was that invalid sum, with no budget left for upload or render. 14 s is derived from measurement on a throttled connection, and if the measured value is better, tighten the target rather than the other way round. |
| Escalation interrupt after transcript receipt | ≤ 1.5 s | ⚠️ Revised from an earlier 500 ms. The safety scan is server-side (§17.3), so the budget must cover scan plus HTTP response plus render on a rationed 3G connection. 500 ms was not reachable from where the scan actually runs. **What matters is not the millisecond figure but the ordering guarantee: the safety path completes before extraction is dispatched, never after it, and never in parallel.** |
| Full screening session | **≤ 10 minutes across ≤ 6 turns** | ⚠️ Revised. The earlier "8 minutes across 8 turns" was impossible: 8 turns at the 110 s cap is 14.7 minutes of recording alone, and even at 60 s per turn it leaves zero seconds for ASR, extraction, probe reading, confirmation, review and back-read. 6 turns averaging 60 s is 6 minutes of speech inside a 10-minute session, which also satisfies the ≥60% speaking-share target in §14.7. **`MAX_TURNS` is therefore 6, not 8**, and §11.6 uses that value. |
| Sahara sync rate limit | 30 req/min | **FACT** from the docs. One CHP cannot hit it; a demo with several concurrent users could. Serialise per session. |

## 14.2 Reliability

Sahara down → the turn is retried with backoff; audio is retained so the mother never repeats herself; after 3 failures, offer manual entry so the screening still completes. Extraction LLM down → one retry, then manual construct entry. **Neither failure may lose a completed screening.** Database down → record held in `localStorage`, success screen withheld, retried on reconnect. **Safety layer must be available whenever a transcript exists**, since it is local and deterministic there is no failure mode where a transcript is produced and the scan is skipped; a test asserts this ordering.

## 14.3 Scalability

**Must scale for MVP:** nothing. Design target is 5 concurrent sessions, enough for a live demo with judges poking at it.
**Must not be designed for now:** multi-county, multi-tenant, thousands of CHPs, real-time dashboards. Explicitly stated so a judge understands the choice was made rather than missed.
**Must not preclude later scale:** stateless API routes, per-session serialisation of Sahara calls, a record schema that maps to FHIR.

## 14.4 Accessibility

| Constraint | Requirement |
|---|---|
| **Low literacy (the mother)** | She reads nothing. Zero text is required of her. All text is for the CHP. |
| **Low literacy (the CHP)** | Kiswahili-first UI. Icons paired with words, never icons alone. Reading level: Kenyan Form Four. |
| **Vision** | Minimum 16 px body, 4.5:1 contrast, no meaning conveyed by colour alone (every confidence band carries a label and an icon, not just green/amber). |
| **Motor** | ≥48 px targets. Primary control thumb-reachable in the lower third. No drag, no long-press, no swipe-only action. |
| **Language diversity** | The core thesis. No language selection. Graceful degradation on a third language. |
| **Connectivity** | Graded rather than binary. See §14.4a, which sets out exactly what works with no network, what degrades, and the one thing that cannot be made to work offline without creating a safety problem. |
| **Ambient noise** | Pre-emptive audio-quality feedback rather than post-hoc failure. |

## 14.4a Offline capability, graded

Grace covers ~110 households on foot with prepaid, rationed data and unreliable coverage (§4.1). "Requires network" is not an acceptable answer for a product that lives in her hand, but "works offline" is a claim this architecture cannot honestly make, because transcription and extraction are both network calls. The honest position is a graded one.

| Tier | Capability | Offline? | Cost to build |
|---|---|---|---|
| **0** | App shell loads; **S5 escalation card renders in full, with crisis numbers, hours, costs and scripts**; **manual risk flag (FR-26) works**; consent script displays; mother identity captured; past records readable | ✅ **Always. No network, ever.** | Low. Service worker + bundled JSON. **Already required** by §15.4 S5. |
| **1** | A completed screening record queues locally and syncs when coverage returns, with the UI stating plainly that it is unsent | ✅ Degraded but complete | Moderate. This is SH4. |
| **2** | **Capture-only fallback:** if coverage dies mid-session, the CHP keeps recording turns against a fixed fallback question list; audio is held locally; transcription, extraction, scoring and the agent loop all run when coverage returns | ⚠️ **Partial, and it changes the product.** See the warning below. | Moderate. IndexedDB audio queue plus a deferred pipeline. |
| **3** | ASR, extraction, agent-generated probes, **automatic safety scan**, back-read, scoring | ❌ **Network required.** No local model fits in a web app on a mid-range Android. | n/a |

### ⚠️ The safety consequence of Tier 2, and why it is a Should-Have rather than a Must

**Tier 2 moves the automatic safety scan out of the room.** A mother discloses suicidal ideation at 11:00; coverage returns at 15:00; the deterministic lexicon fires four hours after Grace has walked away. **That is not a screening tool, it is a notification.** Three things follow, and all three are requirements rather than observations:

1. **The manual risk flag (FR-26) is the offline safety control, and it must be Tier 0.** It is the reason §15.4 already requires the escalation card to render entirely from bundled local state. Grace does not need the model to tell her what she just heard. **The product's safety story offline rests on the trained human in the room, which is the same argument that justified the CHP-mediated design in the first place (§3.7).**
2. **Tier 2 must announce itself.** A persistent banner: *"Hakuna mtandao. Tunarekodi tu. Ukisikia jambo la hatari, bofya alama ya hatari mwenyewe."* ("No network. We are only recording. If you hear something dangerous, press the risk flag yourself.") **The CHP must know the machine is not listening for risk right now.**
3. **The back-read (FR-22) cannot happen in Tier 2**, because the mother has gone by the time there is a record to read to her. That breaks the third verification layer (§11.9). A Tier 2 record is therefore flagged `not_back_read` and **cannot be routed above `chp_followup` without a follow-up visit**, except where the CHP raised a manual flag, which latches `facility_urgent` as normal (§11.8 rule 1).

### Recommendation

**Build Tier 0 in the MVP; it is nearly free and it is already implied by the S5 requirements.** Ship Tier 1 if the T+24 gate is met. **Treat Tier 2 as post-competition**, because the three constraints above are real design work and rushing them produces a product that looks more capable offline than it safely is.

**What to say in the submission:** the escalation path, the crisis contacts and the manual risk flag work with no network at all, by design and not by accident, because a mother in a one-room home in Kawangware does not have coverage on a schedule. That is a true, verifiable, and unusually concrete accessibility claim. **Do not claim offline screening.**

## 14.5 Security

API keys server-side only, never in client bundles; all traffic TLS; no PHI in URLs, query strings, or logs; CHP code is an identifier and is not treated as a secret (and the MVP's threat model says so explicitly rather than implying security it does not have); database access via a service role only; **no third-party analytics, tag managers, or session-replay scripts of any kind on any screen** (a session-replay script on a screen containing a mother's disclosure would be a serious breach and is banned by rule, not by intention); dependency audit before submission.

## 14.6 Privacy

| Item | Rule |
|---|---|
| **Audio** | Deleted immediately after transcription by default. Retention is per-session opt-in and must be spoken to the mother when enabled. Never used for training. Never leaves the server except to the ASR provider. |
| **Transcripts** | Stored only as the evidence spans that made it into the record, plus the full turn transcript for the session's lifetime, purged at completion unless retention was opted into. |
| **PHI** | Display name and age only. **No national ID, no phone number, no GPS, no household identifier in the MVP.** |
| **Consent** | Spoken, recorded as a structured fact with a script version, withdrawable at any time with immediate deletion. |
| **Retention** | Records retained for the demo period only. A pilot requires a documented retention schedule and an ODPC-registered basis. |
| **Cross-border** | ⚠️ **The MVP calls a cloud ASR API, and Digital Health Act 2023 s.47 restricts offshore transfer of personal health information.** The MVP therefore processes **only** licensed benchmark audio and team-recorded synthetic audio. **No real patient audio.** The pilot path is §20.3. This limitation is stated in the submission rather than hidden. |
| **Sensitive data** | **FACT:** Kenya DPA 2019 (Cap. 411C) s.2 defines "sensitive personal data" to include data revealing health status, and "health data" expressly covers *"physical or mental health."* Everything here is sensitive personal data by statute. Voice recordings are additionally biometric-adjacent, and ⚠️ **no Kenyan-specific guidance exists on voice as biometric health data** (worth an ODPC consultation before a pilot). |

## 14.7 Usability (measurable)

| Target | Measurement |
|---|---|
| A CHP with no prior exposure completes a full screening after ≤5 minutes of instruction | Timed dry run with a non-team participant before submission |
| Zero training needed to find the record control | First-tap success on the home screen |
| Mother speaks for ≥60 % of session wall-clock | Sum of turn durations ÷ session duration |
| CHP taps per session | ≤ 25 including confirmations |
| Amber items per session | ≤ 4 (more means the confidence thresholds are miscalibrated) |
| Escalation card comprehension | The CHP can state the next action without re-reading |

## 14.8 Maintainability

Three separable layers with clean seams, which also happens to be how the work parallelises across two people:

1. **ASR adapter** behind a single `transcribe(audio, lang) → {text, latency, meta}` interface. Sahara is one implementation; the benchmark's Whisper, Jacaranda and ElevenLabs adapters implement the same interface. **Swapping the product's ASR is a one-line config change.** This is what makes the benchmark honest rather than decorative.
2. **Clinical logic** (lexicon, scoring, routing, thresholds) in pure, model-free, unit-tested functions with no I/O.
3. **Orchestration** as an explicit state machine, not implicit control flow, so the agent's decisions are inspectable and testable.

Configuration that must be data, not code: the idiom lexicon (CSV), the safety lexicon (CSV), the confidence thresholds, `MAX_TURNS`, the deletion `FLOOR`, and the referral rules. A clinician must be able to review the lexicons without reading TypeScript.

---

# 15. UI/UX Specification

## 15.1 Information architecture

```
MAMA-SAUTI
├── [S1] Nyumbani (Home)
│     ├── purpose line + non-diagnosis disclaimer  (always visible)
│     ├── "Anza uchunguzi" (Start screening)       → S2
│     ├── Today's screenings (list)                → S8 read-only
│     └── "Kwa nini Sahara?" (Why Sahara?)         → S10
├── [S2] Mama (Mother identity)                    → S3
├── [S3] Ruhusa (Consent)                          → S4 | S9
├── [S4] Mazungumzo (Conversation)   ← the loop
│     ├── S4-idle · S4-recording · S4-processing · S4-extracted
│     ├── evidence cards + coverage strip + probe card
│     ├── transcript (collapsed)
│     └── "Alama ya hatari" (raise risk flag)      → S5
├── [S5] Hatari (Escalation)          [interrupt]  → back to S4 | S6
├── [S6] Kagua (Review & confirm)                  → S7
├── [S7] Matokeo (Result & referral)               → S8
├── [S8] Rufaa (Handover card)                     → S1
├── [S9] Imekamilika (Ended / declined)            → S1
└── [S10] Kwa nini Sahara? (Benchmark)             → S1
```

Flat by design. There is no navigation drawer, no tab bar, no settings screen. A CHP mid-visit should never have to find something.

## 15.2 User flow

```
S1 Home
 ↓ Anza uchunguzi
S2 Mother identity  ──(anonymous)──┐
 ↓                                 │
S3 Consent ──(declined)──→ S9 Ended (nothing stored) ──→ S1
 ↓ (granted)
S4 Conversation ⟳ record → process → evidence → probe
 │      ├──(risk hit | manual flag)──→ S5 Escalation ──→ S4 or S6
 │      └──(withdraw consent)────────→ S9 (all deleted) ──→ S1
 ↓ (agent: COMPLETE)
S6 Review & confirm  ── amber items resolved, back-read to mother
 ↓
S7 Result & referral
 ↓
S8 Handover card ──→ S1 (record now in list)
```

## 15.3 Screen inventory

| Screen | Purpose | Primary action | MVP |
|---|---|---|---|
| S1 Nyumbani | Launch point, day's record, non-diagnosis statement | Anza uchunguzi | ✅ |
| S2 Mama | Attach the screening to a person | Endelea (Continue) | ✅ |
| S3 Ruhusa | Obtain and record consent | Amekubali / Amekataa | ✅ |
| S4 Mazungumzo | The conversation loop: capture, evidence, probe | Rekodi (Record) | ✅ |
| S5 Hatari | Interrupt, redirect the CHP to the person, give crisis resources | Nimeongea naye | ✅ |
| S6 Kagua | Confirm amber items; back-read to the mother | Thibitisha (Confirm) | ✅ |
| S7 Matokeo | Band, score, referral tier, reason | Tuma rufaa (Send referral) | ✅ |
| S8 Rufaa | English handover for the facility | Nakili / Shiriki (Copy / Share) | ✅ |
| S9 Imekamilika | Clean exit, nothing stored | Rudi nyumbani | ✅ |
| S10 Kwa nini Sahara? | Benchmark results in-product | n/a | ✅ |
| S11 Historia ya mama | Prior screenings for one mother | n/a | S |
| S12 Supervisor view | Aggregates | ❌ C |

## 15.4 Detailed screen specifications

### S1: Nyumbani (Home)

**Purpose.** Get Grace into a screening in one tap, and make the product's limits visible before anything else.
**Primary goal.** Start a screening.
**Primary action.** `Anza uchunguzi`, full-width, bottom third, thumb-reachable.
**Secondary.** Open a past record; open `Kwa nini Sahara?`; change CHP code.
**Information displayed.** Product name; the two-line purpose + non-diagnosis statement; today's screening count; list of today's records (mother name, time, band chip, tier chip).
**Empty state.** *"Hakuna uchunguzi leo. Anza wa kwanza."* ("No screenings today. Start the first one.") with an outline illustration, never a sad face.
**Loading.** Skeleton rows. Shell renders regardless of network.
**Error.** Offline banner: *"Hakuna mtandao. Unaweza kusoma rekodi za awali."* ("No network. You can read past records.")
**Success.** n/a.
**Accessibility.** Purpose statement is the first element in DOM order, not visually-first-only.
**Mobile.** Single column, 16 px gutters, primary CTA in the lower third.
**Voice.** No audio on this screen. No permission prompt yet; the prompt belongs at the first record tap, in context.

### S2: Mama (Mother identity)

**Purpose.** Attach the screening to a person without an interrogation.
**Primary action.** `Endelea`.
**Displayed.** Two fields (`Jina` / name, `Umri` / age), an `Bila jina` (anonymous) toggle, and a list of recent mothers for one-tap reselection.
**Empty.** No recent mothers → fields only.
**Error.** Age out of range 12–55 → inline, non-blocking, confirmable (a 13-year-old mother is tragically possible and the product must not refuse her).
**Voice.** **Names are never audio-derived.** A hint states this so nobody wonders why they are typing.

### S3: Ruhusa (Consent)

**Purpose.** Make consent a real, legible act rather than a checkbox.
**Primary action.** `Amekubali` (she agreed). Secondary, equally prominent, not visually demoted: `Amekataa` (she declined).
**Displayed.** The Kiswahili script at ≥18 px for reading aloud; the English gloss smaller beneath; four bullets: what is recorded, that audio is deleted, who receives it, that she may stop at any time; an `Hifadhi sauti` (retain audio) toggle, **default off**, with one line of consequence text.
**Empty / loading.** n/a.
**Error.** None possible; the two buttons are terminal.
**Accessibility.** Script is the largest text on the screen because its job is to be read aloud.
**Voice.** **No microphone access is requested or possible before this screen resolves.** Enforced server-side (FR-03).

### S4: Mazungumzo (Conversation)

The screen where the product lives. Four states.

**S4-idle.** Coverage strip at top (9 PHQ + 7 GAD pips: filled = evidenced, half = amber, hollow = uncovered, slash = denied). The current probe card, if any, with `Uliza` / `Ruka`. Evidence cards accumulated so far. Record control, large, bottom centre. `Alama ya hatari` (risk flag) as a persistent, unmissable but not alarming secondary control. `Maliza` (finish) available at all times so Grace is never trapped in the loop.

**S4-recording.** Everything else dims. Large pulsing control, elapsed timer, **live amplitude meter**, `Simamisha`. Amber at 100 s. Auto-stop at 110 s.

**S4-processing.** *"Inasikiliza..."* → *"Inaelewa..."*. Cancel available. **No fake percentage.**

**S4-extracted.** New evidence cards animate in. Each card shows: the construct name in Kiswahili; **the mother's verbatim quote as the largest text on the card**; the English gloss beneath in a lighter weight; an idiom chip if the lexicon matched; a confidence band with a *label*, not just a colour; `Sahihisha` and `Amekanusha`. Below the cards, the collapsed transcript behind *"Ona maandishi kamili"* (see full text). Then the next probe card.

**Empty state (S4, no turns yet).** The opening question, pre-filled as the first probe: *"Tangu ujifungue, umekuwa ukijisikiaje?"*
**Error states.** Enumerated in §10.8 and §21; each names the failure and the next action.
**Accessibility.** Coverage pips carry `aria-label`s. Confidence is never colour-only. The record control is the largest touch target on screen.
**Voice.** Tap-to-start/stop. No live transcript (§10.4).
**Design rule enforced here.** The largest text on any card is the mother's own words. The transcript is never the primary object. **[CR-C2]**

### S5: Hatari (Escalation)

**Purpose.** Get Grace's attention off the phone and onto the person, fast.
**Primary action.** `Nimeongea naye` (I have spoken with her). Nothing else is tappable until it is.
**Displayed, in this order:**
1. *"Simama. Ongea naye sasa."* ("Stop. Talk with her now.")
2. **A privacy control before anything else is revealed.** *"Kuna mtu mwingine anaweza kuona skrini?"* ("Can anyone else see the screen?") with `Hapana` / `Ndiyo`. **On `Ndiyo`, the verbatim quote is suppressed for the rest of this screen** and replaced by *"Amesema jambo linalohitaji msaada wa haraka"* ("She said something that needs urgent support"). See the design note below.
3. The matched verbatim quote (unless suppressed at step 2).
4. A three-line CHP script including the Kenya legal-status line, and the safeguarding line from §9.3.
5. **The link facility's own phone number**, configured per CHU at setup. **This is first in the contact list, because §11.8 rule 1 has just routed `facility_urgent` = "same-day facility contact", and a card that offers counselling and police but no route to the clinical tier the engine just assigned is incoherent.**
6. Verified crisis contacts as tap-to-call. **Each row shows the number, the service, its operating hours, and its cost**, because a CHP who taps an 08:00–22:00 line at 22:30 reaches nothing at the worst possible moment, and because §4.1 establishes that her airtime is prepaid and rationed. Rows outside their operating hours are visibly greyed with the next opening time.
7. `Nimeongea naye`.

**Design note on step 2, and it is not a small point.** §15.4 originally specified this screen as "highest contrast in the product, largest type", full-bleed crimson, legible across a room (§16.2 principle 3). §5.6 establishes the setting: a one-room home with a husband, children and neighbours audible. **As originally specified, the screen displaying her verbatim suicide disclosure was the most legible object in the room to everyone except her.** The same exposure applies to FR-22's mandatory back-read, which reads her quotes aloud. The privacy control is a two-tap fix for a foreseeable harm and it must not be cut.

**⚠️ The 999/112 and Childline 116 rows require a judgement call the CHP must be prompted on.** §4.2 records the mother's trust requirement as knowing that speaking "will not bring the police or take her baby". For an adolescent mother, a child-protection number is precisely the outcome she fears. These two rows are therefore placed **last**, under a heading *"Kwa dharura ya papo hapo pekee"* ("For immediate danger only"), and the CHP script does not read them aloud.

**Loading / empty / error.** None. This screen renders entirely from bundled local state and **must not depend on the network.** Contacts, hours, costs and scripts are in the bundle, not fetched.
**Accessibility.** Highest contrast in the product. Largest type. Phone numbers are tap-to-call and also displayed in full for reading aloud.
**Voice.** Recording is stopped and cannot be restarted from this screen.
**Rules.** Dismissing this screen does not un-escalate, and no later edit can lower the tier (§11.8 rule 1). `Nimeongea naye` is deliberately not the only control, because §21.7 flags single-control screens as producing reflex taps: the privacy question at step 2 forces one deliberate interaction before the acknowledgement is reachable.

### S6: Kagua (Review & confirm)

**Purpose.** Human verification, then the mother's verification.
**Primary action.** `Thibitisha na soma kwa mama` (Confirm and read to the mother).
**Displayed.** All items grouped green / amber. Amber items are individually tappable and **the primary action is disabled until every amber item is resolved**. Then the generated back-read text in her language mix, at ≥18 px for reading aloud, with `Amekanusha` available per item during the back-read.
**Error.** Attempting to proceed with unresolved amber → the offending card scrolls into view and pulses once.
**Accessibility.** Back-read text is the largest on screen; it exists to be spoken.

### S7: Matokeo (Result & referral)

**Purpose.** Tell Grace what happened and what happens next.
**Primary action.** `Tuma rufaa` (Send referral).
**Displayed.** Band (in words, never a bare number first); PHQ-9 and GAD-7 totals with the instrument and cut-off named; the referral tier and its plain-language reason; evidenced-construct count; **the two disclaimers, verbatim**:
> *"Hii si utambuzi wa ugonjwa. Ni uchunguzi wa awali."* ("This is not a diagnosis. It is an initial screening.")
> *"Kipimo hiki hakijathibitishwa rasmi kwa Kiswahili."* ("This instrument has not been formally validated in Kiswahili.")

The second disclaimer is unusual, and it is there because Larsen 2023 shows instrument choice moves measured prevalence fourfold and no criterion-validated Swahili PHQ-9 exists for a perinatal population. **Saying so on the result screen is the honest thing and the impressive thing.**

### S8: Rufaa (Handover card)

**Purpose.** Serve Peter Otieno's fifteen-second job.
**Primary action.** `Nakili` / `Shiriki` (copy / share).
**Displayed.** English summary ≤120 words: escalation reason first if present; band + instrument + cut-off; **verbatim quotes untranslated with bracketed gloss**; CHP code; timestamp; the non-diagnosis line.
**Accessibility.** Monospace-adjacent layout so it survives being pasted into WhatsApp.

### S10: Kwa nini Sahara? (Why Sahara?)

**Purpose.** Put the benchmark inside the product. **[CR-C7][DV]**
**Displayed.** The results table (§18.9); a one-paragraph plain-language explanation of what EESR measures and why WER alone is misleading; the excluded-vendor rationale (§18.3); a link to the repo and the raw CSVs. This screen is aimed at a judge, and it should be visibly aimed at a judge rather than pretending otherwise.

## 15.5 Interaction states

| State | Visual | Copy (SW) | Copy (EN gloss) |
|---|---|---|---|
| **Idle** | Record control at rest, full colour | `Bofya kurekodi` | Tap to record |
| **Listening / recording** | Pulsing control, live meter, dimmed surround | `Inarekodi...` | Recording |
| **Near limit (100 s)** | Timer amber | `Sekunde 10 zimebaki` | 10 seconds left |
| **Processing (ASR)** | Two-phase indicator | `Inasikiliza...` | Listening |
| **Thinking (extraction)** | Same indicator, phase two | `Inaelewa...` | Understanding |
| **Extracted** | Cards animate in | `Nimepata haya` | I found these |
| **Deletion suspected** | Amber strip above cards | `Tunaweza kuwa tumekosa sehemu ya aliyosema. Rekodi tena?` | We may have missed part of what she said. Record again? |
| **Confirming** | Amber cards, primary disabled | `Thibitisha vipengele vya njano` | Confirm the amber items |
| **Escalated** | Full-screen interrupt | `Simama. Ongea naye sasa.` | Stop. Talk with her now. |
| **Completed** | Result card | `Uchunguzi umekamilika` | Screening complete |
| **Failed (ASR)** | Inline card with retry | `Sauti haikusikika vizuri. Sogeza simu karibu kidogo.` | The voice wasn't clear. Move the phone a bit closer. |
| **Failed (network)** | Persistent banner | `Hakuna mtandao. Rekodi imehifadhiwa, tutajaribu tena.` | No network. The recording is saved, we'll try again. |
| **Failed (save)** | Blocking card, **no success screen** | `Haijatumwa bado. Tunajaribu tena.` | Not sent yet. We're retrying. |
| **Offline** | Banner | `Hakuna mtandao. Unaweza kusoma rekodi za awali.` | No network. You can read past records. |
| **Quota exceeded** | Named error | `Salio la huduma limeisha. Wasiliana na msimamizi.` | Service balance exhausted. Contact your supervisor. |

## 15.6 Microcopy inventory

**Buttons.** `Anza uchunguzi` (Start screening) · `Endelea` (Continue) · `Amekubali` (She agreed) · `Amekataa` (She declined) · `Rekodi` (Record) · `Simamisha` (Stop) · `Uliza` (Ask) · `Ruka` (Skip) · `Sahihisha` (Correct) · `Amekanusha` (She disagrees) · `Alama ya hatari` (Raise risk flag) · `Maliza` (Finish) · `Thibitisha` (Confirm) · `Tuma rufaa` (Send referral) · `Nakili` (Copy) · `Shiriki` (Share) · `Nimeongea naye` (I have spoken with her) · `Rudi nyumbani` (Back home) · `Ona maandishi kamili` (See full text) · `Futa kila kitu` (Delete everything).

**Permission request (shown in context at the first record tap, never at launch).**
> *"MAMA-SAUTI inahitaji ruhusa ya kutumia kipaza sauti ili kusikiliza mazungumzo. Sauti hufutwa mara tu baada ya kuandikwa."*
> ("MAMA-SAUTI needs microphone permission to listen to the conversation. Audio is deleted as soon as it is written down.")

**Permission denied.**
> *"Ruhusa imekataliwa. Fungua Settings → Apps → MAMA-SAUTI → Permissions → Microphone."*

**Non-diagnosis disclaimer (S1, S7, S8, verbatim, never paraphrased).**
> *"Hii si utambuzi wa ugonjwa. Ni uchunguzi wa awali unaosaidia kufanya rufaa."*
> ("This is not a diagnosis. It is an initial screening that helps make a referral.")

**Validation disclaimer (S7, S8).**
> *"Kipimo hiki hakijathibitishwa rasmi kwa Kiswahili kwa akina mama waliojifungua."*
> ("This instrument has not been formally validated in Kiswahili for postpartum mothers.")

**Escalation script (S5, for the CHP to read).**
> *"Asante kwa kuniambia. Sio kosa lako. Kufikiria kujiua sio kosa la jinai nchini Kenya. Nitakusaidia kupata msaada leo, na tutafanya hivyo pamoja."*
> ("Thank you for telling me. It is not your fault. Thinking about suicide is not a criminal offence in Kenya. I will help you get support today, and we will do it together.")

**Consent withdrawal confirmation.**
> *"Utafuta kila kitu cha kikao hiki. Hakuna kitakachohifadhiwa. Endelea?"*
> ("This will delete everything from this session. Nothing will be kept. Continue?")

**Success (S8).**
> *"Rufaa imetumwa. Rekodi imehifadhiwa. Sauti imefutwa."*
> ("Referral sent. Record saved. Audio deleted.") Three facts, because each one is a promise we made on the consent screen.

**⚠️ Copy review requirement.** All Kiswahili strings must be reviewed by a Kenyan native speaker before submission. The register above targets Kenyan colloquial Kiswahili, not Tanzanian *sanifu*. Machine-translated Kiswahili in a Kiswahili-language product is the fastest way to lose credibility with a Kenyan judge, and there are Kenyan judges on the panel.

---

# 16. Visual Design Direction

## 16.1 Brand personality

**Trustworthy · Calm · Kenyan · Clinical-adjacent, not clinical · Quiet.**

Explicitly **not**: cheerful, playful, gamified, startup-purple, or "wellness". This product is used at a moment when a woman may be telling someone she has thought about not being alive. Confetti, streaks, and encouraging emoji would be an insult.

## 16.2 Visual principles

1. **Her words are the hero.** On any card containing a quote, that quote is the largest and highest-contrast text. Nothing outranks it.
2. **Calm over urgent, except once.** The entire palette is low-saturation so that the escalation state, the one loud moment in the product, is unmistakable by contrast rather than by shouting continuously.
3. **State must be legible across a room.** The mother can see the phone. She should be able to tell whether it is recording from a metre away.
4. **Never colour alone.** Every confidence band, every status, carries a label and a shape. This is an accessibility requirement and a bright-sunlight requirement.
5. **One decision per screen.** A CHP is conducting a conversation. Two competing calls to action is one too many.
6. **Density where it is read, space where it is tapped.** The handover card is dense (a clinician skims). The conversation screen is spacious (a thumb taps).
7. **No decoration that carries no information.** The amplitude meter stays because it does a job. A decorative waveform would not.

## 16.3 Colour direction

Sourced from a deliberate reading of Kenyan public-health visual language (calm institutional greens and earth neutrals) rather than a generic health-tech blue.

| Role | Value | Purpose |
|---|---|---|
| **Primary** | Deep green `#1B5E4A` | Actions, recording state, brand. Reads as health and institution in Kenyan public-sector context without being MOH-official (we must not imply endorsement we do not have). |
| **Primary light** | `#2E8B6F` | Hover, active, meter fill. |
| **Secondary / accent** | Warm ochre `#C77D2E` | Idiom chips, the mother's voice. Earth-toned, warm, distinguishable from amber warning. |
| **Neutral 900 / 700 / 500 / 200 / 50** | `#1A1A1A` `#4A4A4A` `#8A8A8A` `#E4E4E4` `#FAFAF8` | Text and surfaces. Off-white ground, never pure white (glare on a phone outdoors). |
| **Success** | `#2E7D52` | Confirmed, sent, high confidence. **Always paired with a check glyph and the word.** |
| **Warning / amber** | `#B8860B` | Medium confidence, deletion suspected, unconfirmed. **Always paired with an exclamation glyph and the word.** |
| **Error** | `#A4262C` | Failures only. |
| **Escalation** | `#7A1620` deep crimson, full-bleed | **Used on exactly one screen in the entire product.** Its scarcity is what makes it work. |

Contrast: all text ≥4.5:1 against its ground; primary action ≥3:1 for the control itself.

## 16.4 Typography

| Role | Recommendation | Why |
|---|---|---|
| **Headings** | Inter or Source Sans 3, 600 | Excellent Latin-Extended coverage; renders Kiswahili orthography without substitution; free; on Google Fonts. |
| **Body** | Same family, 400/500, **minimum 16 px** | Consistency over cleverness. |
| **Read-aloud text** (consent script, back-read, escalation script) | **≥18 px, 500 weight, generous line-height 1.6** | This text exists to be read out loud from a phone held at arm's length, sometimes in poor light. It is a distinct type role, not a heading. |
| **The mother's quotes** | **≥18 px, 500, in Neutral 900, with a left ochre rule** | Principle 1, made typographic. |
| **Numerical data** (scores, timers, phone numbers) | **Tabular figures** (`font-variant-numeric: tabular-nums`) | A timer that jitters as digits change looks broken. Scores must align in a list. |
| **English gloss** | 14 px, 400, Neutral 500, italic | Subordinate to the original by construction, never replacing it. |

**Do not use a display or "African-inspired" decorative typeface.** It would be costume, and it would hurt legibility in the exact conditions this product runs in.

## 16.5 Component inventory

| Component | Spec |
|---|---|
| **Button, primary** | Full-width on mobile, 56 px tall, 8 px radius, primary green, white label, no gradient. |
| **Button, secondary** | Outline, same height. **Never visually demoted below the destructive-but-correct choice** (`Amekataa` must not look discouraged). |
| **Record control** | 88 px circle, primary green filled, centred in the lower third. Recording: pulse 0.8 Hz, radius unchanged (a growing button moves the tap target). |
| **Amplitude meter** | Horizontal bar, 12 segments, fills from primary-light. A low-level floor marker is visible so "too quiet" is legible, not inferred. |
| **Transcript card** | Collapsed by default. Expanded: verbatim mixed text, English spans subtly tinted ochre so switching is *visible* (this is a small touch that makes the product's thesis apparent at a glance). |
| **Evidence card** | Ochre left rule · construct name (SW, 14 px, Neutral 700) · **the quote (18 px, 500)** · gloss (14 px italic) · idiom chip if matched · confidence band (glyph + word + colour) · `Sahihisha` / `Amekanusha`. |
| **Confidence band** | `✓ Ina uhakika` (confident, green) · `! Thibitisha` (confirm, amber). Two states only on screen; low-confidence items are not shown because they were never populated. |
| **Coverage strip** | 16 pips (9 PHQ + 7 GAD). Filled / half / hollow / slashed. Each with an `aria-label`. Tapping a pip explains that construct in one sentence. |
| **Probe card** | Ochre-tinted surface, the question at 18 px, `Uliza` / `Ruka`. Visually marked as a *suggestion*, not an instruction. |
| **Escalation card (S5)** | Full-bleed crimson. Highest contrast in the product. Tap-to-call rows for crisis numbers. Numbers shown in full, not just as buttons. |
| **Band chip** | Word first, number second: `Wastani (14)` not `14 – moderate`. |
| **Disclaimer strip** | Neutral 200 ground, Neutral 700 text, always visible on S1/S7/S8, never dismissible. |

## 16.5a Affordances

§16.5 says what the components *are*. This says how each one **signals what it does before anyone touches it**, which is a separate problem and the one that matters most for this user.

**Why it needs its own section here.** Grace has never used a voice assistant, will not read an onboarding tutorial, and is learning the product while conducting a clinical conversation in someone's home (§4.1). She has no spare attention for discovery. **Every control must be self-evident on first sight, and every state must be readable at a glance from a metre away**, because the mother can see the screen too and is forming her own judgement about what this device is doing.

### The five rules

1. **Shape carries meaning before colour does.** The record control is the only circle in the product. Cards are rectangles. Chips are pills. A user who cannot distinguish the green from the amber, in sunlight or with colour-vision deficiency, can still tell a control from a container.
2. **Size encodes priority, exactly once per screen.** The largest interactive element is always the thing to do next. There is never a second element competing for that role (§16.2 principle 5).
3. **Every icon carries its word.** No icon-only controls anywhere, including the ones that feel universally understood. A microphone glyph means "recording" only to people who have already learned that convention.
4. **State is shown, never implied by absence.** "Not recording" is a visibly distinct resting state, not merely the lack of a pulse. "Unsent" is a banner, not a missing checkmark. **A user must never have to infer state from something that is not there.**
5. **Disabled controls explain themselves.** A greyed primary action always carries the reason inline (*"Thibitisha vipengele vya njano kwanza"*, "Confirm the amber items first"). A disabled control with no explanation reads as a broken app, and Grace will conclude the phone is faulty rather than that she has a step remaining.

### Affordance inventory

| Element | What it must signal, unprompted | How |
|---|---|---|
| **Record control** | "Press here, and it is not currently listening" | The only circle on screen; filled primary green; the largest target; sits in the thumb zone; labelled `Bofya kurekodi`. At rest it does **not** pulse, so rest and active are unambiguous. |
| **Recording state** | "It is listening **right now**, and it can hear you" | Pulsing halo at 0.8 Hz (the button itself does not resize, so the target never moves) + **a live amplitude meter that visibly responds to her voice**. The meter is the affordance that matters: it is the only element that proves the microphone is actually picking her up, and it does that job for the mother as much as for Grace. |
| **Amplitude meter floor marker** | "Too quiet is a thing that can happen, and you are above or below it" | A fixed tick on the bar. Without it, a low reading looks like a low voice rather than a problem. |
| **Elapsed timer** | "There is a limit and you are approaching it" | Tabular figures; turns amber at 100 s. |
| **Evidence card** | "This is something *she* said, not something the phone decided" | Ochre left rule + her quote as the largest text on the card. **The visual hierarchy is the trust mechanism**: the design makes provenance obvious before anyone reads a word. |
| **Idiom chip** | "This phrase was recognised from a known list, not inferred" | Pill shape, ochre, carries the matched term. Tapping shows the lexicon entry and its source. |
| **Confidence band** | "This one needs you; that one does not" | Glyph + word + colour, all three. `✓ Ina uhakika` versus `! Thibitisha`. Amber cards are additionally the only cards with an outline. |
| **Coverage strip** | "The screening has a shape, and you are partway through it" | 16 pips, filled / half / hollow / slashed. This is the single affordance that makes an open-ended conversation feel finite, which is what stops Grace ending a session early. |
| **Probe card** | "A suggestion you may use or ignore, not an instruction" | Tinted surface, distinct from evidence cards, with `Uliza` **and** `Ruka` given equal visual weight. **`Ruka` must never look like the discouraged choice**, or the CHP's clinical judgement is being overridden by button styling. |
| **Risk flag button** | "Always available, never alarming" | Persistent on every conversation screen, outline not filled, in a fixed position so it becomes muscle memory. **It must be findable under pressure without being looked for**, which is why position is fixed and never contextual. |
| **Transcript disclosure** | "There is more underneath if you want it" | Collapsed by default with a count (`Ona maandishi kamili`). Signals depth without competing with the evidence cards (§2.2 C2). |
| **Escalation card** | "Stop what you were doing" | Breaks every other visual rule at once: full-bleed, single colour used nowhere else, abrupt 120 ms entry. **Its affordance is discontinuity.** |
| **Offline banner** | "The machine is not listening for risk right now" | Persistent, not dismissible, with the explicit instruction to use the manual flag (§14.4a). |
| **Unsent record** | "This has not left the phone" | Banner plus a per-record marker in the list. **Never a silent retry**, because a silent retry means Grace believes a referral was sent when it was not. |

### Anti-affordances to avoid

No swipe-only actions, no long-press, no drag. No hidden gestures of any kind. No control that appears only on hover, which does not exist on touch. No infinite scroll on the record list. **No skeleton shimmer that resembles content**, because a user who cannot yet read fluently will try to tap it.

## 16.6 Motion

Three animations exist. Nothing else moves.

1. **Recording pulse.** 0.8 Hz opacity oscillation on a halo, not on the button. Runs only while recording. Its job is legibility across a room.
2. **Evidence card entry.** 180 ms fade + 8 px rise, staggered 60 ms. Its job is to show that something new arrived, so Grace does not have to re-scan the list.
3. **Escalation entry.** 120 ms, no easing, deliberately abrupt. Its job is to break the flow state. **This is the only animation in the product that is meant to feel jarring.**

Everything honours `prefers-reduced-motion`. No skeleton shimmer, no page transitions, no confetti, no lottie, no parallax. Each of those would cost frames on a mid-range Android and buy nothing.

---

# 17. Technical Architecture

## 17.1 Stack recommendation

**RECOMMENDATION: two artifacts, two owners, one interface contract.** With two people and roughly 34 hours, the parallelisation *is* the architecture.

| Layer | Choice | Why this and not the obvious alternative |
|---|---|---|
| **Product frontend + API** | **Next.js 14 (App Router) + TypeScript + Tailwind**, deployed on Vercel | Fastest path to a mobile-responsive app with server-side route handlers that keep the Sahara key off the client. Rejected: Gradio and Streamlit, which are faster still but visibly research tooling and would directly cost the Product Quality score (§2.2 C8). |
| **Benchmark harness** | **Python 3.11**, `datasets`, `jiwer`, `pandas`, `httpx` | The HF datasets and every open ASR model are Python-native. Fighting that in TypeScript would waste a day. |
| **Database** | **Postgres** (Supabase or Neon free tier) | Relational, free, zero-ops. Rejected: SQLite (no shared demo state), Firebase (schema drift under time pressure). |
| **Extraction model** | **Claude Sonnet** (or equivalent) with strict JSON schema output | Structured-output reliability is the binding requirement. **Whatever is chosen, `temperature = 0` and the schema is enforced in code, not trusted from the model.** |
| **Audio** | `MediaRecorder` → WebM/Opus | **FACT:** Sahara accepts WAV, MP3, MP4, M4A, OGG, WebM, FLAC. **No client-side conversion needed for the product.** The benchmark uses 16 kHz WAV for parity. |

## 17.2 Frontend responsibilities

Audio capture and state machine UI; consent gating in the UI (belt, with the server-side brace); rendering evidence, coverage, probes; correction and confirmation interactions; the escalation interrupt, **rendered entirely from bundled local data so it works with no network**; `localStorage` for CHP code and unsent records. **The frontend holds no API keys and performs no clinical scoring.**

## 17.3 Backend responsibilities

Route handlers proxying Sahara and the extraction model; **server-side consent enforcement (reject audio for any session without granted consent)**; the deterministic safety scan; span validation; coverage state transitions; deterministic scoring and referral routing; persistence; **audio purge**; structured event logging with no transcript content.

## 17.4 Voice layer

`MediaRecorder` at a 16 kHz target, mono. Live amplitude via `AnalyserNode` (this is the meter; it never leaves the browser). Hard 110 s cap with a 100 s warning, sized to Sahara's 120 s sync limit with headroom. Blob held in memory, uploaded as `multipart/form-data`, discarded on success.

## 17.5 Speech recognition layer

```ts
interface ASRAdapter {
  name: string;
  transcribe(audio: Blob | Buffer, opts: { lang: string }):
    Promise<{ text: string; latencyMs: number; meta: Record<string, unknown> }>;
}
```

**`SaharaAdapter`** (product + benchmark): POST `https://infer.voice.intron.io/file/v1/upload/sync`, `Authorization: Bearer $SAHARA_API_KEY`, multipart fields `audio_file_name` + `audio_file_blob`, `use_language_asr_input="sw"`.

Two configuration details that matter and are easy to get wrong:

- **FACT: Sahara's default pipeline applies LLM corrections to the transcript.** `use_disable_llm_corrections` controls this (`TRUE` = corrections off). **The product sets it to `TRUE`, corrections OFF. So does the benchmark's primary column.** We report a corrections-ON column separately for completeness, and we quantify what the post-processor contributes.

  **Three reasons the product runs corrections OFF, and this is not the obvious choice, so the reasoning is recorded.** (a) **Evidence integrity.** Every score in this product is justified by a verbatim quote that is read back to the mother. A quote drawn from an undisclosed LLM's smoothed rewrite is not her words, and the back-read (§11.9 layer 3) would be asking her to confirm a sentence she did not say. (b) **The safety layer would stop being deterministic.** §1.6 claims the safety scan runs on the raw transcript rather than on model output. With corrections ON that claim is false, because a correcting LLM sits upstream of the scan and could plausibly normalise a hedged suicidal phrase or regularise Sheng. (c) **The release gate would measure the wrong configuration.** SPR = 1.00 is gated on the benchmark; if the benchmark measures corrections-OFF and the product runs corrections-ON, the gate gates nothing.

  **Trade-off accepted:** raw output will be rougher, and some of the LLM's corrections would genuinely have helped. We take the rougher transcript in exchange for being able to say truthfully that what appears on screen is what she said. **If the benchmark shows corrections-ON materially improves EESR-clinical, revisit this decision explicitly rather than silently.**
- **Sync returns 503 *with* the `file_id`** after 120 s. Fall back to polling `GET /file/v1/status/{file_id}`; statuses run `FILE_QUEUED → FILE_PENDING → FILE_PROCESSING → FILE_TRANSCRIBED | FILE_PROCESSING_FAILED`.

Rate limits (**FACT** from the docs): sync 30/min, async 60/min, status 100/min. `Retry-After` is returned on 429. Serialise per session.

**Benchmark-only adapters:** `WhisperAdapter` (local `faster-whisper`), `JacarandaAdapter` (HF transformers), `ElevenLabsAdapter` (HTTP). Same interface, which is what makes the model swap a config change rather than a rewrite.

## 17.6 Code-switch handling layer

Token-level language tagging (heuristic lexicon + character-n-gram classifier is sufficient at MVP; a full LID model is not worth the day it would cost); CMI and switch-point computation using the Das & Gambäck (2014) / Gambäck & Das (2016) definitions **so our numbers are directly comparable to AfriSwitch's published `cmi` column**; the deletion-signature detector; and unrecognised-language span marking.

## 17.7 Agent layer

An explicit state machine, not implicit control flow:

```
IDLE → AWAITING_TURN → TRANSCRIBING → SAFETY_SCAN
                                        ├→ ESCALATED (terminal-ish; returns to AWAITING_TURN or REVIEW)
                                        └→ EXTRACTING → VALIDATING → STATE_UPDATE → DECIDE
DECIDE → { PROBE → AWAITING_TURN | ESCALATE → ESCALATED | COMPLETE → REVIEW }
REVIEW → CONFIRMED → SCORING → ROUTING → PERSISTING → PURGING → DONE
```

Every transition is logged with its inputs. This is what makes the agent's behaviour inspectable in the demo and testable in §26.

## 17.8 Tool layer, data, external services

**Tools:** as enumerated in §11.7. `score` and `route_referral` are pure functions with **no model and no I/O**, unit-tested against hand-computed vectors.

**Database schema (minimal, 6 tables):**

```sql
chp            (code PK, name, chu, created_at)
mother         (id PK, display_name, age, chp_code FK, anonymous bool, created_at)
session        (id PK, mother_id FK, chp_code FK, consent_granted bool,
                consent_at, script_version, audio_retained bool,
                language_profile jsonb, status, started_at, ended_at)
turn           (id PK, session_id FK, idx, duration_ms, transcript text,
                cps numeric, deletion_suspected bool, asr_model, asr_latency_ms,
                created_at)                       -- transcript purged at completion
screening_record (id PK, session_id FK, mother_id FK, scores jsonb, items jsonb,
                risk jsonb, referral jsonb, asr jsonb, disclaimers jsonb, created_at)
audit_event    (id PK, session_id FK, kind, payload jsonb, created_at)
                -- kinds: consent_granted, consent_withdrawn, safety_hit, escalation_ack,
                --        item_disputed, item_corrected, span_validation_failure,
                --        persist_retry, audio_purged
```

**Never stored anywhere:** audio after transcription (default), GPS, phone number, national ID, household identifier, third-party speech content.

**External services:** Intron Sahara v2.5 (ASR, required); an LLM provider (extraction + generation); Postgres; Vercel. That is the entire dependency list, deliberately.

**Observability.** Log: turn count, ASR latency, `cps`, deletion flag, extraction latency, items produced, **items dropped for span-validation failure** (this is the hallucination canary and should be watched during the demo), agent decisions, confirmations, disputes, escalations, persist retries. **Never log transcript content, evidence spans, names, or ages.** A test asserts that no log line contains a field from the PHI allowlist.

**Security layer.** Keys server-side only; TLS; no PHI in URLs or logs; service-role DB access; **no third-party analytics or session replay on any screen** (§14.5).

## 17.9 Architecture diagram

```
              ┌──────────────────────────────────────────┐
              │  CHP's Android browser  (360×640)        │
              │  Next.js client                          │
              │  ┌────────────┐  ┌───────────────────┐   │
              │  │MediaRecorder│  │AnalyserNode meter │   │
              │  └─────┬──────┘  └───────────────────┘   │
              │        │  WebM/Opus                      │
              │  ┌─────▼───────────────────────────────┐ │
              │  │ Bundled: crisis contacts, escalation │ │  ← works offline
              │  │ script, consent script, lexicons     │ │
              │  └──────────────────────────────────────┘ │
              └────────────────────┬─────────────────────┘
                                   │ HTTPS
              ┌────────────────────▼─────────────────────┐
              │      Next.js route handlers (server)      │
              │  ┌─────────────────────────────────────┐ │
              │  │ 0. CONSENT GATE  (reject if !granted)│ │
              │  └──────────────┬──────────────────────┘ │
              │  ┌──────────────▼──────────────────────┐ │      ┌──────────────────┐
              │  │ 1. ASRAdapter.transcribe()          │─┼─────▶│ Intron Sahara    │
              │  │    lang="sw" (code-switched pair)   │◀┼──────│ v2.5  /file/v1   │
              │  └──────────────┬──────────────────────┘ │      └──────────────────┘
              │  ┌──────────────▼──────────────────────┐ │
              │  │ 2. Code-switch: token LID, CMI, cps │ │
              │  │    → deletion-signature detector     │ │
              │  └──────────────┬──────────────────────┘ │
              │  ┌──────────────▼──────────────────────┐ │
              │  │ 3. SAFETY SCAN  (deterministic,     │ │
              │  │    lexicon, NO MODEL) ──────────────┼─┼──▶ ESCALATE (short-circuits)
              │  └──────────────┬──────────────────────┘ │
              │  ┌──────────────▼──────────────────────┐ │      ┌──────────────────┐
              │  │ 4. Extraction (LLM, strict JSON,    │─┼─────▶│ LLM provider     │
              │  │    temperature 0)                   │◀┼──────│                  │
              │  └──────────────┬──────────────────────┘ │      └──────────────────┘
              │  ┌──────────────▼──────────────────────┐ │
              │  │ 5. SPAN VALIDATION (substring)      │ │
              │  │    violations → drop + log          │ │
              │  └──────────────┬──────────────────────┘ │
              │  ┌──────────────▼──────────────────────┐ │
              │  │ 6. Coverage state → DECIDE          │ │
              │  │    PROBE | ESCALATE | COMPLETE      │ │
              │  └──────────────┬──────────────────────┘ │
              │  ┌──────────────▼──────────────────────┐ │
              │  │ 7. score()  route_referral()        │ │
              │  │    PURE, DETERMINISTIC, NO MODEL    │ │
              │  └──────────────┬──────────────────────┘ │
              └─────────────────┼───────────────────────┘
                                │
                   ┌────────────▼────────────┐
                   │ Postgres                │
                   │ record + audit_event    │
                   │ (audio PURGED)          │
                   └────────────┬────────────┘
                                │
                   ┌────────────▼────────────┐
                   │ Handover card (English) │──▶ Clinical Officer
                   └─────────────────────────┘

        ── separate artifact, same ASRAdapter interface ──
   ┌─────────────────────────────────────────────────────────┐
   │ Python benchmark harness                                │
   │ AfriSwitchCare[swahili] + AfriSwitch[swahili] + FieldSet │
   │   → Sahara(LLM-corr OFF) · Sahara(ON) · Whisper-lg-v3    │
   │     · Jacaranda-Health/ASR-STT · ElevenLabs Scribe v2    │
   │   → WER · CER · EESR · CIR · SPR · construct-F1          │
   │     · |ΔPHQ-9| · band-flip rate · latency                │
   │   → results/*.csv  →  S10 "Kwa nini Sahara?"             │
   └─────────────────────────────────────────────────────────┘
```

## 17.10 What a real pilot would additionally require

Stated so the MVP's boundaries are a choice, not an oversight:

1. **In-country processing.** Digital Health Act 2023 s.47 restricts offshore transfer of personal health information. A pilot needs either a Kenya-region deployment agreement with Intron, or on-device/in-country ASR.
2. **ODPC registration** as data controller and processor (DPA s.18(1)), plus a **DPIA** (s.31) completed before processing.
3. **A licensed healthcare provider in the legal chain.** ⚠️ Neither the DPA (s.46(1)) nor the Digital Health Act (s.41(2)) permits a technology company to process health data on its own account. The entity structure must reflect this from day one.
4. **NACOSTI licence + accredited IRB** (KEMRI SERU, KNH-UoN ERC, AMREF ESRC, Maseno, or Strathmore) + county health research approval.
5. **DHA certification.** ⚠️ The Digital Health Agency runs a live nine-stage certification pipeline ([certification.dha.go.ke](https://certification.dha.go.ke)). Budget time.
6. **A PPB classification opinion** on medical-device status. ⚠️ We could not confirm published PPB guidance on Software as a Medical Device; a screening tool that does not diagnose should land in a lower class under IMDRF/WHO logic, but **get the opinion in writing rather than reasoning by analogy.**
7. **Written MOH sign-off on a CHP scope-of-work document.** ⚠️ **This is the one people forget and it is the one that matters most.** No Kenyan statute defines "screening" or draws the boundary between "monitoring health status" (authorised, PHC Act s.11(2)(c)) and "diagnosis" (reserved, Mental Health Act Cap 248 s.2). That gap closes with an MOH letter, not with legal inference.

---

# 18. Speech Model Benchmarking Specification

## 18.1 What this benchmark is for

Not "which model has the lowest WER." The question is: **does ASR quality on code-switched Swahili change the clinical decision this product makes?** If two models differ by 8 WER points but produce the same PHQ-9 band on every case, the WER difference is not a product fact. If two models differ by 2 WER points and one flips the band on a fifth of cases, that is the headline.

**This framing is the submission's technical differentiator.** Most entries will report WER. The competition brief explicitly asks whether transcription quality affects the downstream task.

## 18.2 Models, and why each is in

**Four models, satisfying both readings of the ambiguous requirement (§2.1).** Sahara is run in two configurations, which is a fifth column but not a fifth vendor.

| # | Model | Category | Why it belongs |
|---|---|---|---|
| **1a** | **Intron Sahara v2.5**, `sw`, `use_disable_llm_corrections=TRUE` (corrections OFF) | African, commercial, **code-switch-native** | **Mandatory, and this is the primary column.** Corrections OFF isolates the acoustic model, gives a fair comparison against models with no post-processor, **and is the configuration the product ships** (§17.5). |
| **1b** | **Intron Sahara v2.5**, `sw`, corrections ON (API default) | Same | Reported separately to quantify what the undisclosed post-processor contributes. Most teams will benchmark the default and not notice they are measuring an ASR model plus a hidden LLM. |
| **2** | **OpenAI Whisper large-v3** (`language="sw"` and `language=None`) | Global, open source, Apache-2.0 | The world's default multilingual baseline and what most teams will reach for. Two conditions matter: forcing `sw` versus letting it auto-detect exposes whether it collapses code-switched audio into one language, which is exactly our thesis. |
| **3** | **Jacaranda-Health/ASR-STT** (whisper-medium, sw+en bilingual, CC-BY-SA-4.0) | African, health-domain, **incumbent** | **The most product-relevant comparator that exists.** Built by the organisation that actually runs maternal health messaging for ~3M Kenyan mothers, reports WER 0.147, and claims code-switch strength. If Sahara does not beat the regional incumbent on our task, that is a finding worth publishing. |
| **4** | **ElevenLabs Scribe v2** (`swa`) | Global, commercial, closed | ⚠️ Vendor self-rates Swahili at **≤10% WER**; AssemblyAI self-rates the same language at **25–50%**. That is a fivefold vendor disagreement on monolingual Swahili with no published eval set behind either claim. Testing it on real code-switched audio is a genuinely interesting question. ~$0.22/hr. **No benchmarking restriction found in its terms.** |

**Optional 5th if the harness is finished and idle before T+29:** Meta MMS `mms-1b-all` (ISO code `swh`, note: **not** `swa`), CC-BY-NC-4.0. A pure CTC architecture would round out the comparison, since every other entry is encoder-decoder or closed.

## 18.3 Models deliberately excluded, and why (put this in the submission)

| Excluded | Reason |
|---|---|
| **Deepgram** | ⚠️ **Terms of Service restriction #9 prohibits use "for competitive purposes, including model training, benchmarking and other competitive analysis."** Not conditioned on being a competitor. We will not publish numbers we are contractually barred from producing. |
| **AssemblyAI** | ⚠️ Two clauses: prohibits "competitive analysis or benchmarking", **and** separately prohibits submitting benchmarking material "not independently created by the Customer", which directly implicates evaluating on a third-party corpus like AfriSwitchCare. |
| **NVIDIA Parakeet / Canary** | **Swahili is not supported by any checkpoint.** Parakeet-v2 is English-only; Parakeet-v3 and Canary-1b-v2 cover 25 European languages (Granary corpus); Canary-1b/flash/180m hardcode `choices=['en','de','es','fr']`. **Reported as a negative finding, not a benchmark row.** |
| **w2v-BERT 2.0** | `sw` is in its 96-language pretraining set, but the card states it is *"a bare checkpoint without any modeling head, and thus requires finetuning."* Cannot be benchmarked zero-shot. (It is, however, the only permissively-licensed path to a custom Swahili-English code-switch model. See §29.5.) |

**Stating the two ToS exclusions is worth real credit under Ethics & Safety.** A team that publishes Deepgram numbers has either not read the terms or has decided not to care. We read them.

## 18.4 Metrics

**Tier 1: standard, for comparability**

| Metric | Definition |
|---|---|
| **WER** | `jiwer.wer` on normalised text. Normalisation per §18.7. |
| **CER** | `jiwer.cer`, same normalisation. Reported because CER is more informative than WER for an agglutinative language where a single morpheme error destroys a whole token. |
| **Latency** | p50 / p95 wall-clock per utterance, including network. |

**Tier 2: code-switch specific. This is our contribution.**

| Metric | Definition | Why it exists |
|---|---|---|
| **EESR: Embedded-English Span Recall** | For each gold `[[EN]]…[[/EN]]` span, count it recalled if its normalised token sequence appears in the hypothesis (contiguously, or with ≥80% token overlap in order). `EESR = recalled / total`. | **Directly measures switch-boundary deletion.** Computable straight from AfriSwitch's and AfriSwitchCare's own `transcription_tagged` field, so it requires no new annotation. This is the metric aggregate WER structurally cannot see. |
| **EESR-clinical** | EESR restricted to English spans containing a term from the affective/clinical vocabulary (`stress`, `depress*`, `anxious`, `worry`, `overwhelm*`, `tired`, `sleep`, `sad`, `alone`, `hopeless`, `low`). | The general EESR could be fine while the clinical subset collapses. **This is the number that determines whether the product works.** |
| **CIR: Clinical Idiom Recall** | Recall over the §5.4 lexicon, fuzzy-matched at Levenshtein ≥0.85 with stem variants. | The Kiswahili half of the same question. |
| **SPR-seen** | Recall over safety-lexicon phrases, on clips that speak those exact phrases. | Sanity check only. **This is the system tested against its own answer key, and it is reported as such.** |
| **SPR-held-out** | Recall over risk utterances written by a second person **after** the lexicon was frozen, using phrasings deliberately absent from it. | **The metric that means something.** It measures whether the ASR preserves risk language in general, not whether our lexicon matches itself. Target ≥0.90, and any miss is analysed individually rather than averaged. |
| **CMI-Δ** | Absolute difference between gold `cmi` and hypothesis-derived CMI. | Does the model preserve the *structure* of switching, or flatten it? |

**Tier 3: downstream task. This is what the competition brief actually asks for.**

| Metric | Definition |
|---|---|
| **Construct Extraction F1** | Run the identical extraction pipeline (same prompt, `temperature = 0`, same lexicon) on the gold transcript and on each model's hypothesis. F1 over the set of PHQ-9/GAD-7 constructs populated. |
| **\|ΔPHQ-9\|** | Mean absolute difference between the PHQ-9 total derived from gold and from each hypothesis. |
| **Band-flip rate** | **% of cases where the assigned severity band differs between gold and hypothesis.** |
| **Referral-tier flip rate** | % of cases where the routed referral tier differs. |
| **Safety-flag flip rate** | % of cases where `risk_flag` differs. **A false-negative flip here is a P0 finding, not a metric.** |

**Band-flip rate is the headline number.** It converts "34% WER" into "on X% of mothers, the model choice changes what happens to her." That is the sentence that lands with a judge.

## 18.5 Test datasets

| Set | Source | Volume | Role |
|---|---|---|---|
| **A: Primary, in-domain** | `intronhealth/AfriSwitchCare`, config `swahili`, split `test` | **12 conversations, 1.54 h**, CMI 37.4, ~96.4 switch points/conv | Simulated doctor-patient clinical code-switching. **In-domain for a CHP-mediated screening conversation, which is exactly why we chose the CHP-mediated design.** Includes a **depression** case among its 12 conditions. |
| **B: Secondary, robustness** | `intronhealth/AfriSwitch`, config `swahili`, split `test` | **650 utterances, 3.89 h**, CMI 25.72, 10.29 switch points/utt | In-the-wild conversational. Tests whether findings hold outside clinical register. |
| **C: First-party field set** | Recorded by the team | **28 utterances**, ~18 min | Satisfies competition requirement C12 with full metadata. **The only set carrying risk utterances and hand-assigned gold scores, so it is the only set on which Tier 2 SPR and all of Tier 3 can be computed.** See §18.5a. |

**Both A and B are CC BY-NC-SA 4.0 and gated on Hugging Face. ✅ Access is granted to this team**, so the benchmark can use them directly. **The non-commercial term still binds redistribution: we evaluate on them and we do not ship their audio** (§20.5, and requirement C12 is satisfied with field set C instead).

**Loading (config names are lowercase language names):**
```python
from datasets import load_dataset
care = load_dataset("intronhealth/AfriSwitchCare", "swahili", split="test")
wild = load_dataset("intronhealth/AfriSwitch",     "swahili", split="test")
```
⚠️ Config names are inferred from AfriSwitch's documented `"hausa"` example. **Confirm `"swahili"` immediately after access is granted.**

**Two practical traps in dataset A, both verified:**

1. **The card's "Avg. Duration" column is actually the total.** Swahili's 92.3 min ↔ 1.54 h. So these are **12 conversations averaging ~7.7 minutes each**, not 12 × 92 minutes. Consequential: **Whisper's 30 s window and Sahara's 120 s sync cap both require chunking.**
2. **Swahili `num_turns` is null**: Swahili transcripts carry no `[Speaker N]` markers. Any diarization-dependent step breaks on exactly the language we care about. (This is why we do not build diarization, §8.5.)

**Chunking protocol, and it must be identical across all models or the comparison is void.** VAD-based segmentation at 60–90 s with 1 s overlap, produced **once** and reused for every model. Segment boundaries, and the gold transcript alignment to them, are committed to the repo so the whole thing is reproducible.

## 18.5a Which metric runs on which dataset, and why band-flip cannot run on A

A mistake worth avoiding: **band-flip rate is meaningless on dataset A, and it is the headline metric.**

Dataset A is 12 simulated consultations across 12 conditions, of which **one is depression**. For the other eleven, the gold PHQ-9 total is near zero and the gold band is "minimal". A transcription error would have to invent a great deal of symptom content to move that band. Band-flip on A would therefore come out near zero **by construction**, and the resulting number would say nothing whatsoever about ASR quality. Publishing it as a headline would be worse than publishing nothing.

**Dataset A has a second disqualifying property for Tier 3.** Its Swahili transcripts carry no speaker markers at all, so a PHQ-9 extraction run over them attributes the clinician's utterances to the patient. The product treats third-party speech as a named failure mode (§12.4, §21.1); the benchmark's primary set is 100% two-party text with the parties indistinguishable.

**Assignment, therefore:**

| Tier | Dataset A (AfriSwitchCare sw) | Dataset B (AfriSwitch sw) | Field set C |
|---|---|---|---|
| **1** WER, CER, latency | ✅ primary | ✅ if credits allow | ✅ |
| **2** EESR, EESR-clinical, CIR, CMI-Δ | ✅ **primary** (highest switch density, in-domain clinical register) | ✅ robustness | ✅ |
| **2** SPR-seen / SPR-held-out | ❌ no risk content | ❌ | ✅ **only here** |
| **3** construct F1, \|ΔPHQ-9\|, **band-flip**, tier-flip, safety-flag flip | ❌ **degenerate; do not report** | ❌ | ✅ **only here** |

**This is why field set C carries hand-assigned gold PHQ-9 and GAD-7 item vectors and why its 8 perinatal clips are written to span all five severity bands.** n=28 is small and we say so; a small set with a distributed gold signal beats a larger one where the signal cannot vary.

**Report Tier 3 as: "on n=28 utterances with hand-assigned gold scores, model choice changed the assigned PHQ-9 band on X of 28 cases."** A count, not a percentage, at this n.

## 18.6 First-party field set (C) specification

24 recordings satisfying competition requirement C12, with the exact metadata the brief asks for.

28 recordings satisfying competition requirement C12, with the exact metadata the brief asks for. **Every clip carries a hand-assigned gold PHQ-9 and GAD-7 item vector**, which is what makes it (and not dataset A) the set on which band-flip can actually be computed. See §18.5a.

| Category | n | Content |
|---|---|---|
| Perinatal distress, natural code-switching | 8 | The §5.3 utterances, spoken naturally. Gold scores spread deliberately across all five PHQ-9 bands. |
| Somatic-only presentation | 4 | Tests the §12.4 rule and the §11.4b backstop end to end |
| Numbers, dates, names | 3 | Including `saa nne usiku` clock offset |
| **Safety phrases, lexicon-matched** | **4** | The SPR-seen set. One clip per `form` in §11.4a. |
| **Safety phrases, held out** | **4** | **The SPR-held-out set, and the only safety number that means anything.** Written by whichever team member did *not* author the lexicon, after the lexicon was frozen, deliberately using phrasings it does not contain. **Non-negotiable.** |
| Sheng, observational only | 2 | `sifeel poa`, `siko sawa`. **Recorded and reported, but not scored against any target and not counted toward any headline metric** (§5.1). Present so the research track has a starting point (§29.5). |
| Noise conditions | 2 | Same utterance, quiet room vs. background radio + infant |

**Metadata schema, `data/fieldset_metadata.csv`:**
`file_id, duration_s, language_pair, domain, register, accent_country, accent_region, speaker_l1, speaker_age_band, speaker_gender, device, noise_condition, snr_estimate_db, transcription, transcription_tagged, cmi, num_switch_points, contains_safety_phrase, consent_status, recorded_at`

**Ethics of set C, stated in the submission.** These are **synthetic utterances performed by team members**, constructed from published idioms, not recordings of real patients. Nobody's distress is redistributed. **We submit only set C's audio, never A's or B's**, because those are CC BY-NC-SA and gated.

## 18.7 Normalisation, and a documented bug in the reference harness

We follow Intron's `Intron-Multimodal-Benchmarking` `scripts/evaluations.py` conventions so our numbers are comparable, **with two deliberate deviations we declare openly.**

**FACT (verified in the repo):** the non-English normalisation path is
`EnglishNumberNormalizer` → Whisper `BasicTextNormalizer(remove_diacritics=True)` → punctuation stripping, with `remove_diacritics = not is_english`.

**Deviation 1: diacritics.** Their pipeline destroys diacritics for every African language. For plain Swahili WER this is mostly harmless; **for lexicon matching it is not**, because it collapses distinctions our idiom matcher relies on. **We report WER under their exact normalisation for comparability, and compute EESR/CIR/SPR under a diacritic-preserving normalisation.** Both are stated.

**Deviation 2: we do not report their "normalized vs unnormalized" split for non-English.** ⚠️ **Verified bug:** for non-English languages both branches call the same `clean_multilingual_text()`. We diffed `evaluations/transcriptions/transcription_wer.csv` against `transcription_unnormalized_wer.csv`: **every non-English row is byte-identical; only the `english` row differs.** Reporting both as independent numbers would be reporting the same number twice.

**⚠️ Two more things about that repo, if it is used directly.** Its `results/Readme.md` documents a `prediction` column, but `evaluations.py` asserts `"hypothesis" in data.columns`. **Use `hypothesis`, or evaluation raises `AssertionError`.** And `transcription_evals()` parses filenames as `parts = file.split("_")` with `model = parts[0]`, so **any model identifier containing an underscore silently breaks.** Use hyphens.

**⚠️ Critical framing point: the Intron benchmarking repo is not a code-switching harness.** Its own README lists under limitations that *"intra-utterance code-switching is present but inconsistently annotated across languages."* It computes no CMI, no switch-point metric, no per-word LID. **Our Tier-2 metrics are therefore net-new and must be implemented by us.** Say this in the report; it is a contribution, not a gap.

## 18.8 Evaluation pipeline

```
AfriSwitchCare[swahili] · AfriSwitch[swahili] · FieldSet-C
        ↓
VAD chunking (60–90 s, 1 s overlap), computed ONCE, shared by all models
        ↓
┌───────┬───────────┬───────────┬────────────┬─────────────┐
│Sahara │ Sahara    │ Whisper   │ Jacaranda  │ ElevenLabs  │
│corr-OFF│ corr-ON  │ large-v3  │ ASR-STT    │ Scribe v2   │
└───┬───┴─────┬─────┴─────┬─────┴──────┬─────┴──────┬──────┘
    └─────────┴───────────┴────────────┴────────────┘
        ↓ hypothesis transcripts (results/<task>/<model>_swahili.csv, col: hypothesis)
        ↓
Tier 1: WER · CER · latency
Tier 2: EESR · EESR-clinical · CIR · SPR · CMI-Δ
        ↓
IDENTICAL extraction pipeline (same prompt, temperature 0, same lexicon)
        ↓
Tier 3: construct-F1 · |ΔPHQ-9| · BAND-FLIP RATE · tier-flip · safety-flag flip
        ↓
results/*.csv  →  report  →  S10 "Kwa nini Sahara?" in-product page
```

**Run command (single entry point, per FR-28):**
```bash
python -m bench.run --dataset afriswitchcare_sw --models all --out results/
python -m bench.report --in results/ --out report/benchmark.md
```

## 18.9 Benchmark report template

**Table 1: Transcription quality (dataset A: AfriSwitchCare Swahili, n=12 conversations, 1.54 h)**

| Model | WER ↓ | CER ↓ | **EESR ↑** | **EESR-clinical ↑** | **CIR ↑** | **SPR ↑** | CMI-Δ ↓ | Latency p95 (s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Sahara v2.5 (corr OFF)** | | | | | | | | | **primary column; as shipped in the product** |
| Sahara v2.5 (corr ON) | | | | | | | | | API default; isolates the post-processor's contribution |
| Whisper large-v3 (`sw`) | | | | | | | | | forced language |
| Whisper large-v3 (auto) | | | | | | | | | tests language collapse |
| Jacaranda-Health/ASR-STT | | | | | | | | | regional incumbent |
| ElevenLabs Scribe v2 | | | | | | | | | vendor claims ≤10% WER |

**Table 2: Downstream clinical impact, on field set C only (n=28, hand-assigned gold). The headline.**

| Model | Construct F1 ↑ | \|ΔPHQ-9\| ↓ | **Band-flip (of 28) ↓** | Tier-flip (of 28) ↓ | **Safety-flag false-neg ↓** |
|---|---|---|---|---|---|
| *(same rows)* | | | | | |

Report counts, not percentages, at this n. **Do not compute Table 2 on dataset A; §18.5a explains why it would be degenerate.**

**Table 3: Robustness (dataset B: AfriSwitch Swahili, n=650 utterances)**. WER, EESR, CIR only. Tests whether Table 1's ordering holds outside clinical register.

**Table 4: Safety recall, field set C**. SPR-seen (n=4) and **SPR-held-out (n=4)** reported separately, with every miss described individually. Plus the paired noise-condition clips.

**Table 5: Not benchmarked, and why**. Deepgram (ToS), AssemblyAI (ToS), NVIDIA Parakeet/Canary (no Swahili), w2v-BERT (no decoder head).

## 18.10 Expected results and honest baselines

**Set expectations before running, so a bad number is a finding rather than a panic.**

**FACT.** Published baselines on genuinely code-switched Swahili:

| Source | Result |
|---|---|
| **shamiriAI** (Lilan, Mochama, Osborn et al. 2026, *JMIR AI* 5:e95063) on code-switched English/Kiswahili/**Sheng** mental health session audio | **WER 0.34, CER 0.19**, cosine semantic similarity 0.77. **The only peer-reviewed quantified benchmark for exactly our setting. This is our realistic ceiling.** |
| **AfriSwitch**, best system, code-switched Swahili | **34.12% WER** |
| Intron MultiBench README, **monolingual** accented clinical Swahili, Sahara | **0.068 normalised WER**, CER 0.028 |
| Common Voice read-speech Swahili | 3–16% WER |

**The gap between 0.068 and 0.34 is the entire story of this competition.** Monolingual accented clinical Swahili is close to solved. Code-switched Swahili is not. **Do not compare against the monolingual number, and say explicitly why in the report.**

## 18.11 Failure analysis taxonomy

Every error is hand-categorised on a stratified sample of 100 utterances, ~20 per model. Categories, with the deliberate observation about each:

| Category | What to look for |
|---|---|
| **Switch-boundary deletion** | **The hypothesis is fluent monolingual Swahili with the English simply gone.** Expected to dominate. |
| **Switch-boundary substitution** | English word replaced by a phonetically similar Swahili word. Worse than deletion, because it is invisible to a reader. |
| **Language collapse** | The whole utterance rendered in one language. Watch Whisper-auto specifically. |
| **Sheng, observational** | `sifeel poa`, `siko sawa` mangled. **Counted and described, never aggregated into a headline metric** (§5.1), because Sheng is absent from every model's training data and a number here measures that absence rather than anything about this product. |
| **Idiom fragmentation** | `mawazo mengi` → `mawazo` + `mengi` split across a boundary, or `kufikiria sana` → `kufikiri sana`. Determines whether fuzzy matching is sufficient. |
| **Numbers and dates** | Mixed numeral systems; **the `saa nne` clock offset**. |
| **Names** | Expected to be the worst class. Justifies never deriving names from audio. |
| **Noise** | Compare the paired field-set recordings directly. |
| **Fast or overlapping speech** | Infant and multi-speaker interference. |
| **Mixed grammar** | Swahili morphology on an English stem (`kuconnect`, `nime-check`). A genuinely hard case and a good example for the report. |
| **⚠️ Safety-phrase loss** | **Reported separately and never averaged into anything.** Any instance is a named finding. |

---

# 19. Data Requirements

## 19.1 Input data

**From the CHP:** CHP code; mother display name and age (typed, never audio-derived); consent decision; audio retention decision; per-item confirmations, corrections and disputes; optional manual risk flag.
**From the mother:** speech, and nothing else. **She types nothing, taps nothing, and reads nothing.**

## 19.2 Audio characteristics that matter

| Property | Product | Benchmark |
|---|---|---|
| Format | WebM/Opus (accepted natively by Sahara) | 16 kHz mono WAV |
| Sample rate | 16 kHz target, device-dependent | 16 kHz (matches both HF datasets) |
| Channels | Mono | Mono |
| Duration | 20–110 s per turn | 60–90 s VAD chunks, shared across models |
| Environment | Household, radio, infant, roof rain | Dataset-native + paired field-set noise condition |
| Device | Mid-range Android built-in mic, 20–50 cm | Same for set C |

## 19.3 Metadata

Product, per turn: `duration_ms`, `asr_model`, `asr_latency_ms`, `cps`, `deletion_suspected`, `language_spans[]`, `cmi`.
Session: `language_profile`, turn count, escalation flags, coverage completeness.
Benchmark, per sample: the full schema in §18.6, satisfying the competition's requested fields (**language pair, domain, accent/country, device type, noise conditions**).

## 19.4 Generated data

Transcript (transient); token language tags; extracted items with verbatim spans, idiom ids, confidence, severity; coverage state; agent decisions with rationale; generated probes; PHQ-9/GAD-7/PHQ-2/GAD-2 scores and band; referral tier and reason; Kiswahili back-read; English handover summary; audit events.

## 19.5 Stored data

**Persisted:** `chp`, `mother` (display name + age only), `session` (consent facts, language profile, status), `screening_record` (scores, items with spans, risk, referral, ASR metadata, disclaimers), `audit_event`.
**Transient, purged at session completion:** turn audio (purged at transcription unless retention opted in), full turn transcripts, working coverage state.

## 19.6 Sensitive data

**FACT.** Kenya DPA 2019 (Cap. 411C) s.2: "sensitive personal data" includes data revealing **health status**; "health data" expressly covers *"physical or mental health."* **Every clinical field in this product is sensitive personal data by statute**, which triggers: lawful basis (ss.30, 44–45), express informed freely-given consent, ODPC registration (s.18(1)), and a mandatory DPIA (s.31).

Highest-sensitivity fields, in order: the risk flag and its verbatim quote; PHQ-9 item 9 evidence; all evidence spans (a mother's own words about her mental state); scores and band; the mother's name linked to any of the above; **raw audio, which is additionally biometric-adjacent and highly identifying.** ⚠️ **No Kenyan-specific guidance exists on voice recordings as biometric health data.** Worth an ODPC consultation before any pilot.

## 19.7 Data that must NOT be stored

Explicit, and each has a reason:

| Not stored | Why |
|---|---|
| **Raw audio after transcription** (default) | We promised deletion on the consent screen. Breaking that promise once destroys the product. |
| **GPS or household location** | Not needed for screening; enormously re-identifying in a small CHU. |
| **Phone number, national ID, NHIF number** | Not needed. Every additional identifier increases breach severity for zero clinical gain. |
| **Third-party speech content** | The husband did not consent. Flag it, do not extract from it, do not store it. |
| **Free-form CHP impressions** | Unstructured clinical opinion from an unlicensed cadre is exactly the legal exposure of §17.10(7). |
| **Anything from a session where consent was declined or withdrawn** | Beyond an anonymous counter. |
| **Transcript content in application logs** | A log aggregator is not a clinical system and does not inherit its controls. |
| **Any data used for model training** | Not offered in the MVP at all, so there is no consent to get wrong. |

## 19.8 Consent points

| # | Moment | What is consented | Default | Revocable |
|---|---|---|---|---|
| 1 | S3, before any audio | Recording, transcription, immediate deletion, sharing with the facility clinician | Must be explicit | Yes, any time, with immediate deletion |
| 2 | S3, separate toggle | Audio **retention** beyond transcription | **Off** | Yes |
| 3 | S6 back-read | Confirmation that the record reflects what she said | Must be read to her | She may dispute any item |
| 4 | S7 | Onward referral to the named facility | Implicit in #1, restated in the back-read | She may decline the referral; the record is kept, the referral is not sent |
| n/a | *not offered* | Use for model training or research | **Not offered in MVP** | n/a |

**A pilot adds:** written informed consent under an approved IRB protocol; a separate consent for research use; a low-literacy-appropriate consent process (which is a design problem, not a paperwork problem); and an assent process for mothers under 18, who are a substantial share of this population.

---

# 20. Responsible AI Specification

## 20.1 Privacy

Data minimisation is the primary control, not encryption. We collect a name, an age, and speech. We keep the speech only long enough to read it. Everything in §19.7 is a deliberate refusal to collect something we could easily have collected.

## 20.2 Consent

Consent is a screen, a spoken script, a stored structured fact with a version, a default-off retention toggle, a one-tap withdrawal that deletes, and a server-side gate that makes recording impossible without it. **Consent that is only enforced in the UI is not enforced.**

## 20.3 Data minimisation and localisation

⚠️ **The most serious legal constraint on this product, stated plainly.** Digital Health Act 2023 **s.47**: *"Personal health information may only be shared to any person outside Kenya for the purposes of health tourism."* Read literally, this bars offshore cloud or LLM processing of identifiable Kenyan health data.

**MVP mitigation:** the demo processes **only** licensed benchmark audio and team-recorded synthetic audio. **No real patient audio, ever, in this build.** This is stated in the submission rather than glossed.
**Pilot requirement:** in-country processing, via a Kenya-region agreement with Intron or on-device ASR, plus a legal opinion on s.47 specifically. Regulation 26(2)(f) of the Data Protection (General) Regulations 2021 independently names *"provision of primary or secondary health care for a data subject in the country"* as a strategic-interest purpose requiring local storage.

## 20.4 Crisis resources: verified only

**Every number in the escalation card is tiered by verification strength, and we ship only tier A.** Bundled in the app so the card works with no network.

**Tier A: verified on the organisation's own official site or a government property. These ship. Hours and cost are displayed on the card, not just recorded here (§15.4 S5 step 6).**

| Order on card | Service | Number | Scope | Cost | Hours |
|---|---|---|---|---|---|
| **1** | **The CHU's own link facility** | configured per CHU | Clinical. **The tier the engine just assigned.** | n/a | facility hours |
| 2 | **Kenya Red Cross** | **1199** | Counselling / psychosocial | Toll-free (stated) ⚠️ see below | "Anytime" |
| 3 | **One2One (LVCT Health)** | **1190** (call *and* SMS) | Counselling incl. mental health, GBV | ⚠️ **not stated by the provider; display as "cost unknown"** | **08:00–22:00 daily.** Greyed outside these hours. |
| 4 | **Healthcare Assistance Kenya (GBV)** | **1195** | GBV, links to health/legal/police | Toll-free | 24 h |
| 5 | **Childline Kenya** | **116** | Child protection + counselling | Toll-free | 24 h |
| 6 | **National emergency** | **999 / 112** | Police dispatch | Free | 24 h |

Rows 5 and 6 sit under *"Kwa dharura ya papo hapo pekee"* ("For immediate danger only") and are not read aloud from the script (§15.4 S5).

⚠️ **1199 ships with a caveat, not as clean tier A.** A third-party claim that **1199 is Safaricom-only** could not be verified and **would be clinically material** on any other network. Until it is resolved, 1199 displays a one-line note (*"Ikikataa, jaribu 1190"* / "If it fails, try 1190") and the facility number sits above it. **Resolving this is a pre-pilot action item, and arguably a pre-demo one.**

**Why 1195 is on this list:** perinatal screening surfaces intimate partner violence at high rates. **FACT:** domestic violence carries OR 6.34 (95% CI 4.11–9.78) for postpartum depression in East Africa (Negesse et al. 2022, [doi:10.1177/20503121221135403](https://doi.org/10.1177/20503121221135403)). A GBV pathway is not an add-on; it is a predictable branch.
**Why 116 is on this list:** adolescent mothers are a substantial share of this population.

**Tier B: third-party corroborated only. Shipped with a visible caveat or not at all.**
Befrienders Kenya **+254 722 178 177**: consistent across Befrienders Worldwide and LifeLine International, ⚠️ but **their own site publishes no working number** (helpline links render as `tel:undefined`) and **hours are disputed three ways.** Ship with "Mon–Fri, 9am–5pm" and a caveat, or omit.

**⚠️ Explicitly excluded, and each exclusion is a real finding:**

| Excluded | Why |
|---|---|
| **`befrienderskenya.org`** | **Dead domain serving a parking page, reportedly redirecting to an unrelated commercial site.** It appears on many aggregator lists. The real domain is `befrienderske.org`. **Shipping this would send a woman in crisis to a parked domain.** |
| **Niskize `0900 620 800`** | **Premium-rate 0900 prefix** (~KSh 7/min per a third-party source). **Must never appear in a free-crisis tier without a cost label.** |
| **Emergency Medicine Kenya Foundation** | Does not run a helpline. Their page aggregates and lists 1199 (Red Cross) as a "Suicide Hotline", and contains a visible bug (1514 listed for two services). Not a source of truth. |
| **Inuka** | Now a Netherlands B2B employer-gated platform whose own site disclaims crisis use. |
| **Mathari National Teaching and Referral Hospital** | ⚠️ **`mathari.go.ke` returns an empty document; no contact number is verifiable from any official source.** Kenya's main public psychiatric referral hospital, and we cannot verify a number for it. **This is the single biggest gap in the referral pathway and must be obtained directly before any pilot.** |

⚠️ **Two unresolved questions before a pilot:** (i) a third-party claim that **1199 is Safaricom-only** could not be verified and would be clinically material; (ii) Red Cross's own page confirms the number and toll-free status but labels the counselling scope only on secondary pages.

**Legal status line in the escalation script.** **FACT:** attempted suicide was declared unconstitutional by the High Court of Kenya on **9 January 2025** (*KNCHR & 2 others v AG*, Petition E045 of 2022, [2025] KEHC 6), with immediate effect and no suspension. ⚠️ **Penal Code s.226 is still printed pending formal repeal** (NA Bill No. 53 of 2024). Many women still believe disclosure is criminal, which suppresses exactly the disclosure we need. **The script says so.**

⚠️ **Tanzania is materially different and must not be treated as the same market.** Attempted suicide **remains a crime** there (Penal Code Cap. 16 R.E. 2023, s.217). Tanzania has **no national adult suicide-prevention line**; Ahadi Mental Health **199** (SMS **15061**) and C-Sema **116** are age- or scope-limited. **A Tanzanian deployment requires a different disclosure script and a different safeguarding pathway. MAMA-SAUTI v1 is Kenya-only, and the spec says so rather than implying regional coverage.**

## 20.5 Instrument licensing

PHQ-9, PHQ-2, GAD-7, GAD-2: **FACT**, free, verified at [phqscreeners.com/terms](https://www.phqscreeners.com/terms). Attribution retained in the repo and on the result screen.
EPDS: **excluded from MVP** pending written RCPsych clearance (§8.6). ⚠️ If it is ever added, obtain that clearance first; a voice tool reads items aloud, which is arguably reproduction.
Datasets A and B: **CC BY-NC-SA 4.0**, gated. **We do not redistribute their audio.** ⚠️ **Note the non-commercial term against the registration form's "Solution Access Type" field:** if MAMA-SAUTI is ever commercial, these datasets cannot be used in the commercial product, only in published evaluation.
Idiom lexicon: our compilation from published literature, with per-row citations. Released **CC BY 4.0** as a contribution back to the field.

## 20.6 Risk register

| Risk | Who is affected | Severity | Mitigation | Residual risk |
|---|---|---|---|---|
| **ASR deletes a suicidal disclosure** | Mother | **Catastrophic** | Deterministic lexicon incl. hedged forms; independent LLM `risk_flag`, either triggers; CHP manual flag always present; SPR=1.00 release gate; deletion-signature detector | **Non-zero and irreducible in software.** The trained human in the room is the real control. This is the strongest argument for the CHP-mediated design. |
| **Somatic idiom over-read as depression** | Mother | High | The §12.4 somatic-only rule (caps confidence below population threshold, forces a probe); Kaiser 2015's explicit warning encoded as a product constraint | Residual over-extraction possible on ambiguous multi-construct utterances; band, not label, limits harm |
| **Somatic idiom under-read (status quo)** | Mother | High | Idiom lexicon; probe tier 4 targets somatic-only constructs | Lexicon has only 15 entries and the Swahili literature is genuinely thin (§5.5) |
| **Model hallucinates evidence she never gave** | Mother, CHP | High | **Hard substring validation, drop not repair**; back-read to the mother; per-item CHP confirmation | Correct-substring-but-wrong-construct remains possible; mitigated by the back-read |
| **False positive → unnecessary referral** | Mother, health system | Medium | Band not label; PPV limits explicit on screen; probes disambiguate | Real, and accepted. **The cost asymmetry against a false negative justifies it, and we say so rather than hiding it.** |
| **Product used to diagnose** | Mother | High (legal + clinical) | No label anywhere in output; disclaimer on three screens and in the handover; `disclaimers[]` on every record; scoring is deterministic and inspectable | CHP or clinician may still verbalise a diagnosis. **Training control, not software control.** |
| **CHP acts beyond scope** | CHP (legal) | High | Output framed as screen + referral; escalation script directs to the person and to services, never to intervention | ⚠️ **No Kenyan statute defines "screening."** Closes with an MOH letter (§17.10(7)), not with software. |
| **Bias against non-standard accents / rural / older speakers** | Mothers | High | Benchmark stratified by noise condition; **⚠️ AfriSwitchCare and AfriSwitch contain NO speaker demographics at all** (confirmed absence, stated on the cards) | **We cannot measure accent bias with the available data. This is a stated limitation, not a solved problem.** A pilot must collect demographics prospectively. |
| **Sheng under-served** | Younger mothers | Medium | Sheng entries remain in the lexicon so the system still *recognises* what it can; 2 observational clips in field set C | **Real and unmitigated. Sheng is in no model's training distribution, so this is a gap in the underlying speech technology rather than in this product.** MVP makes no claim here (§5.1) and states the limitation; closing it is a research contribution (§29.5). |
| **Third party (husband) answers for her** | Mother | Medium | `third_party_speech_suspected` flag; no confident extraction; CHP prompted to seek privacy | Privacy is often physically unavailable in a one-room home. Real and unsolved. |
| **Consent theatre (CHP taps without reading)** | Mother | Medium | Script kept to four sentences; largest text on the screen; version recorded | **Real residual risk. Software cannot fix it; training and supervision must.** Stated rather than claimed away. |
| **Offshore processing of health data** | Mother, team (legal) | High | **No real patient audio in the MVP**; benchmark and synthetic audio only | Blocks a pilot until §17.10(1) is resolved. |
| **Data breach** | Mother | High | Minimisation; audio deleted; no location, phone, or ID; TLS; no third-party scripts | A breach of names + PHQ-9 bands would still be severe. Minimisation is what limits it. |
| **Stigma from being screened** | Mother | Medium | Consent script avoids leading with *afya ya akili*; conducted privately in her home rather than in a clinic queue | Being visited by a CHP is itself visible to neighbours. |
| **Misuse: coercive screening (employer, spouse, institution)** | Mother | High | Consent required and withdrawable; CHP-gated; no self-serve mode | **A CHP could in principle be pressured.** Mitigation is institutional, not technical. |
| **Misuse: repurposing as a general medical assistant** | Patients | Medium | Scope is hard-coded: only PHQ-9/GAD-7 constructs are extractable; the schema has no other slots | Fork risk on an open repo. Licence and README state intended use. |
| **Over-trust in the score by a clinician** | Mother | Medium | Instrument, cut-off and **the non-validation caveat** printed in the handover | A busy clinician may read the number and skip the caveat. |

## 20.7 Bias, inclusion, transparency

**Language inclusion** is the product's founding premise: refusing to make a mother choose one language is the inclusion mechanism, not a feature on top of one.
**Accent inclusion** is asserted in the design and ⚠️ **cannot be verified with the available data**, because neither Intron dataset carries any speaker demographics. **Stated as a limitation in the submission.** A pilot collects age band, county, L1 and urban/rural prospectively, then re-runs the benchmark stratified.
**Transparency:** every score traces to a quote; every quote is verbatim; the model name and configuration are on the record; the benchmark is in the product (S10); the lexicon is released with citations.
**Explainability:** the explanation is not a saliency map. It is the mother's sentence.
**Human oversight:** the CHP confirms; the mother back-reads; the clinician decides. **Scoring and routing are deterministic, inspectable functions of an evidence-linked item set, with every medium-confidence item confirmed by the CHP and every item read back to the mother.**

⚠️ **State the limit of that claim precisely, because a judge will find it otherwise.** High-confidence (green) items populate without a per-item tap, so a PHQ-9 total can be composed largely of severities an LLM assigned from spans it selected. The *arithmetic* is model-free; **the inputs are not**. What the design actually guarantees is provenance (every score traces to a verbatim quote) and human reviewability (every quote is read aloud to the person who said it), not independent validation of the 0–3 severity mapping. **Provenance is not validity, and the document does not claim it is.** Closing that gap requires the validation study in §29.5, not a UI change.
**Failure disclosure:** §12.6. The product never claims a success it did not achieve.

**WHO alignment:** *Ethics and governance of artificial intelligence for health* (2021); *guidance on large multi-modal models* (2024); *Guide for integration of perinatal mental health in maternal and child health services* (2022, [9789240057142](https://www.who.int/publications/i/item/9789240057142)). ⚠️ **Correction worth knowing: there is no perinatal module in mhGAP**, and there is no mhGAP Intervention Guide v3.0. Cite IG v2.0 (2016) for algorithms and the mhGAP guideline 3rd edition (2023) for recommendations. The 2022 perinatal guide is the correct WHO anchor for this product.

---

# 21. Failure Mode Analysis

## 21.1 Voice capture failures

| Failure | Cause | Detection | User impact | Recovery |
|---|---|---|---|---|
| Mic permission denied | OS / browser | `getUserMedia` rejects | Cannot record at all | Specific instruction card with the Android path; retry button |
| No audio captured (silence) | Phone too far, mic obstructed, mother did not speak | Amplitude below floor >5 s in a >8 s recording | Wasted turn | **Pre-emptive** live hint during capture, not after; re-record same turn index |
| Clipping / overload | Phone too close, loud room | Peak amplitude saturated | Degraded ASR | Live meter shows red; hint to move back |
| Recording exceeds Sahara's limit | Long turn | Timer at 100 s | Turn truncated | Amber at 100 s, auto-stop at 110 s, turn preserved, prompt to continue in a new turn |
| Browser suspends recording | Backgrounded, call incoming, screen lock | `MediaRecorder` state change | Partial audio | Detect, keep the partial, tell her what happened, offer re-record |
| **CHP's own words attributed to the mother** | CHP keeps recording while reading the probe or prompting mid-turn | **Known-prompt suppression (FR-11a)**, plus the turn boundary itself | **A false positive manufactured by the system's own question, on the construct it is measuring.** The highest-frequency attribution failure. | Item dropped, `known_prompt_suppressed` logged. **Watch this counter: if it fires often, the CHP is recording through her own speech and the training needs fixing, not the code.** |
| Third party speaks | Husband, mother-in-law, neighbour | ⚠️ **Weakly detectable without diarization, which is out of scope per §11.3a** | Wrong person's words attributed | `third_party_speech_suspected` heuristic (register shift, pronoun mismatch); CHP prompted to seek privacy. **Acknowledged in `LIMITATIONS.md` as a real, only-partly-mitigated failure. Known-prompt suppression does not touch this case.** |

## 21.2 ASR failures

| Failure | Cause | Detection | User impact | Recovery |
|---|---|---|---|---|
| **Switch-boundary deletion** | The dominant code-switch failure mode | **Deletion-signature detector** (`cps` below calibrated floor) | **Clinical English silently lost. The most dangerous ASR failure in this product.** | Amber strip, offer re-record; benchmark quantifies the residual (EESR-clinical) |
| Language collapse | Model renders everything in one language | `cps` normal but zero English spans detected in an utterance with English phonetics | Meaning distorted | Flag turn; probe rather than extract |
| Whisper 30 s window truncation | Long-form audio | Output far shorter than duration | Content lost | Chunking protocol, applied identically to all models |
| Sahara 429 rate limit | >30 sync req/min | HTTP 429 + `Retry-After` | Delay | Backoff honouring the header; serialise per session |
| `QUOTA_EXCEEDED` / insufficient credits | ⚠️ **Participant credit allowance is not published anywhere.** | Explicit error code | **Total stop** | **Named error, not generic.** ⚠️ **ACTION DAY 0: check the credit balance and estimate burn before building, otherwise this surfaces mid-demo.** |
| `INSUFFICIENT_AUDIO_ACTIVITY` | Near-silence | Explicit error code | Wasted turn | Merged with the silence path |
| Network timeout | Connectivity | Timeout | Delay | Audio retained in memory; retry costs the mother nothing |
| Names mis-transcribed | Worst ASR entity class here | Not automatically detectable | Wrong person referenced | **Structurally prevented: names are typed, never audio-derived.** |
| Numbers / clock mis-parsed | Mixed numeral systems, **Swahili 6 h offset** | Not automatically detectable | Wrong date or time in the record | **Always confirmed**, with the conversion shown explicitly |

## 21.3 Code-switch specific failures

| Failure | Cause | Detection | Impact | Recovery |
|---|---|---|---|---|
| Sheng not recognised | Not in any model's training distribution | Low confidence, garbled span | Younger mothers under-served | Probe rather than extract, as with any low-confidence span. **Not scored against a target** (§5.1); noted in `LIMITATIONS.md` and carried into the research track. |
| Idiom fragmented across a boundary | `mawazo mengi` split, `kufikiria`→`kufikiri` | Lexicon miss where phonetics suggest a hit | Idiom evidence lost | Fuzzy matching ≥0.85 + stem variant sets |
| Third language inserted (Kikuyu, Dholuo) | Out of the `sw` pair | Unrecognised span | Content lost | Mark `unrecognised_language`; **do not extract; do not hallucinate a Swahili reading**; prompt to repeat |
| Swahili morphology on English stem (`kuconnect`, `nime-check`) | Genuine mixed grammar | Often mis-segmented | Meaning distorted | Documented in failure analysis; a good report example |

## 21.4 Intent and extraction failures

| Failure | Cause | Detection | Impact | Recovery |
|---|---|---|---|---|
| **Hallucinated evidence span** | LLM invention | **Substring validation** | Would be catastrophic if it reached the record | **Item dropped, not repaired; logged as `span_validation_failure`. Watch this counter during the demo.** |
| Over-extraction from somatic-only speech | Model over-reads | `somatic_only` flag | False positive | §12.4 rule caps confidence below threshold; forces a probe |
| Under-extraction | Hedged or indirect speech | Coverage stays low | Missed case | Probe priority targets uncovered constructs; turn budget of 8 gives room |
| Wrong construct assigned | Ambiguous multi-construct utterance | Correct substring, wrong label | Score distorted | Back-read to the mother; CHP `Sahihisha` |
| Denial vs absence conflated | Schema misuse | Coverage state inspection | Re-probing something she already denied, which is intrusive | `constructs_addressed_but_negative` is a distinct state by design |
| Schema violation | Model output drift | Parse failure | Turn lost | One retry, then manual entry path; screening is not lost |

## 21.5 Agent failures

| Failure | Cause | Detection | Impact | Recovery |
|---|---|---|---|---|
| Probe repeats a covered construct | State bug | Coverage inspection | Mother feels unheard | Covered constructs excluded from targeting by construction; unit-tested |
| Probe is leading | Prompt drift | Manual review | Biased responses | Constraint in the prompt + a review checklist item in §22.3 |
| Probe is clinically clumsy | Generation quality | CHP judgement | Awkward moment | `Ruka` always available; the CHP is the editor |
| Loop never terminates | Decision-function bug | Turn counter | Session drags, mother disengages | `MAX_TURNS = 8`, hard |
| Terminates too early | Negative short-path fires wrongly | Coverage completeness on the record | Missed case | Short path requires **both** PHQ-2 and GAD-2 covered *and* both below threshold |
| PHQ-9 #9 never probed | Priority bug | Coverage inspection | **Safety gap** | **Rule: the agent always probes item 9 at least once. The CHP may skip; the agent may not.** Unit-tested. |

## 21.6 Tool, network and persistence failures

| Failure | Cause | Detection | Impact | Recovery |
|---|---|---|---|---|
| DB write fails | Connectivity, service | Write error | Record could be lost | Held in `localStorage`; **success screen withheld**; retried |
| Extraction provider down | Outage | Error | Turn lost | One retry, then manual construct entry |
| Referral not routable | Config gap | Routing returns null | Referral not sent | CHP told to route manually, with the reason |
| Partial write | Crash between record and audit event | Reconciliation on load | Inconsistent state | Single transaction for record + audit; idempotent retry key |
| Audio purge fails | Storage error | Purge confirmation missing | **Promise to the mother broken** | Retry; **alert; if it cannot be purged, this is a P0 and is surfaced, not swallowed** |

## 21.7 UX failures

| Failure | Cause | Detection | Impact | Recovery |
|---|---|---|---|---|
| CHP taps confirm without reading | Habituation | Not detectable | Unverified record | Per-item taps, no bulk confirm; **acknowledged as a residual risk, not claimed solved** |
| Mother watches the screen and sees an error mid-disclosure | Live text or visible failure | Observation | Trust destroyed | **No live transcription** (§10.4); errors are non-blocking and quiet where possible |
| Screen unreadable in sunlight | Contrast | Field test | Unusable | Off-white ground, high contrast, no colour-only meaning |
| CHP cannot find the risk flag under pressure | Buried control | Usability test | **Safety gap** | Persistent on every conversation screen |
| Session lost to an interruption | No pause | Observation | Mother repeats herself | Pause/resume (SH5) |

## 21.8 Privacy failures

| Failure | Cause | Detection | Impact | Recovery |
|---|---|---|---|---|
| Audio not deleted | Bug or misconfiguration | Purge audit event missing | **Consent violated** | Integration test asserts deletion; alert on missing purge event |
| Transcript content in logs | Careless logging | Log-content test | Sensitive data outside the clinical system | **Test asserts no PHI-allowlist field appears in any log line** |
| PHI in a URL or share link | Careless routing | Route audit | Leak via browser history, WhatsApp preview | Rule: no PHI in URLs; share payloads are plain text |
| Third-party script captures a screen | An added analytics or replay tag | Dependency review | **Severe: a mother's disclosure captured by a vendor** | **Banned by rule (§14.5); checked in the pre-submission dependency audit** |
| Data sent offshore | Cloud ASR | Architecture review | ⚠️ Potential Digital Health Act s.47 issue | **No real patient audio in MVP**; pilot path §17.10(1) |
| Re-identification from a small CHU | Name + age + band in a unit of ≤1,000 households | Threat modelling | Stigma, harm | No GPS, no household ID, no phone number; access limited |

---

# 22. Success Metrics

## 22.1 User success

| Metric | Target | How measured |
|---|---|---|
| Screening completion rate | ≥90% of started sessions reach a record | `session.status` counts |
| Time per screening | ≤10 min median | `ended_at − started_at` |
| Mother speaking share | ≥60% of session wall-clock | Σ turn duration ÷ session duration |
| CHP taps per session | ≤25 | Event log |
| Items disputed by the mother | ≤1 per session | `item_disputed` audit events. **A rising rate means extraction is drifting from what she actually said.** |
| Screening events created where zero existed before | 100% of completed sessions | This *is* the value proposition (§6.6). Every completed record is a data point that did not previously exist. |

## 22.2 Voice performance

| Metric | Target | Source |
|---|---|---|
| WER on AfriSwitchCare Swahili | ≤0.35 | **Anchored to shamiriAI's WER 0.34 on Kenyan code-switched mental health audio, not to the 0.068 monolingual figure.** |
| **EESR** | ≥0.80 | Our metric |
| **EESR-clinical** | **≥0.90** | The number that determines whether the product works |
| **CIR** | ≥0.85 | Idiom lexicon recall |
| **SPR** | **1.00** | **Release blocker. No exceptions.** |
| Deletion-suspected turn rate | ≤15% | Product telemetry |

## 22.3 AI performance

| Metric | Target |
|---|---|
| Construct extraction F1 vs gold transcript | ≥0.75 |
| Span validation failure rate | **≤1%.** Above this, the extraction prompt is unsound. |
| Somatic-only rule correctly fires | 100% on the 4 dedicated field-set fixtures |
| Probe relevance (references her prior words when evidence exists) | ≥80%, manually rated on 20 probes |
| Probe skip rate (`Ruka`) | ≤30%. Higher means probes are not useful. |
| Band agreement, gold vs Sahara-derived | ≥90% (i.e. band-flip ≤10%) |

## 22.4 Technical performance

| Metric | Target |
|---|---|
| Stop-record → evidence on screen, p95 | ≤9 s |
| ASR round-trip, 60 s turn, p95 | ≤6 s |
| Escalation render after transcript receipt | ≤500 ms |
| Session error rate | ≤5% of turns require a retry |
| Zero unrecovered data loss | 100% of completed sessions persist |

## 22.5 Competition success: what evidence proves what

| Judging dimension | Evidence we will point at |
|---|---|
| **Real-world impact** | The **process** claim, per §3.3a: a routine CHP postnatal visit currently produces zero structured mental health data, and MAMA-SAUTI converts it into a completed, evidence-linked screening record with a routed referral. Supported by: fewer than 2 depression detections per 100,000 consultations in the largest published Kenyan primary-care sample; MOH's own written statement that no MOH form carries a mental health field; 19.8 CHPs per facility versus 5.1 clinical officers; ~107,000 CHPs with government-issued smartphones. **Do not present "1.41 per 100,000 versus 22% prevalence" as a ratio.** §3.3a explains why it is not one. |
| **Code-switching** | EESR / EESR-clinical / CIR / CMI-Δ across 4 models on the highest-switch-density language in Intron's own benchmark; the demo utterance with ≥3 switch points; **the absence of any language selector.** |
| **Product quality** | The full screen set with real empty, loading, error and success states; native-reviewed Kiswahili microcopy; verified on a real Android at 360×640. |
| **Technical execution** | Reproducible one-command benchmark; the ASRAdapter interface; deterministic model-free scoring; substring validation; the Sahara LLM-corrections-on/off split; the documented normalisation deviations. |
| **Ethics & safety** | Server-enforced consent; audio deleted by default; deterministic model-free safety layer; SPR release gate; **the two ToS-based vendor exclusions**; verified-only crisis contacts with the `befrienderskenya.org` finding; no diagnosis; the honest limitations section. |

---

# 23. Demo Specification

## 23.1 Constraints

⚠️ **No video length is published.** **RECOMMENDATION: 3 minutes.** Tight enough to hold attention, long enough for the story. Deploy to a public URL and record against production, never localhost. Record on a real Android in portrait, screen-captured, with a brief cut to a hand holding the phone so the physical context is legible.

## 23.2 Demo user and situation

**Grace Wanjiku, CHP, Kawangware.** Six-week postnatal visit to **Amina, 22, first baby.** Amina has already been to the clinic twice with headaches and been given painkillers. Nobody asked a second question.

## 23.3 Beat sheet (3:00)

| Time | Beat | On screen | What the judge should take away |
|---|---|---|---|
| **0:00–0:20** | **The number** | Title card: *"In the largest published Kenyan primary-care study, 5.3 million consultations, fewer than 2 depression cases were detected per 100,000. No Kenyan MOH form has a field for maternal mental health."* | The problem is quantified and correctly scoped. ⚠️ **The earlier version of this card generalised a single county's finding to "Kenya" and set it against a prevalence rate with a different denominator. §3.3a explains why both were wrong; this card is the fixed version and the wording is load-bearing.** |
| 0:20–0:35 | Consent | S3, script visible, Grace taps `Amekubali` | Ethics is a screen, not a paragraph. Audio-deletion promise is made out loud here so the S8 payoff lands. |
| **0:35–1:05** | **The utterance** | S4-recording. Amina speaks: *"Kichwa inauma kila siku, nikaenda hospitali wakanipa* **painkillers** *. Lakini bado niko na* **stress** *sana... usiku sina usingizi, nakuwa na* **mawazo mengi** *."* | **Four switch points and a documented Kiswahili idiom in one natural sentence.** Note that *stress* is not decoration: Mendenhall 2019 documents the English words "stress" and "depression" as adopted into Kiswahili discourse with shifted meaning, so the embedded English **is** the affective vocabulary. That is the thesis, in one sentence a judge can hear. |
| 1:05–1:20 | Transcript with switching visible | S4-extracted, transcript expanded briefly; **English spans tinted ochre** | Sahara caught the embedded English. Visible, not asserted. |
| **1:20–1:40** | **The refusal** | Evidence card for `mawazo mengi` populates. The somatic headline does **not** populate. A note reads *"Dalili za mwili pekee, tuulize zaidi"* ("Physical symptoms only, let's ask more") | **The system declines to over-read. Most demos show a system doing more. This one shows it doing less, correctly.** |
| **1:40–2:00** | **The agent** | Probe card: *"Umesema unaskia* **kuchoka moyo** *. Hiyo hisia ya kuchoka, iko zaidi kwa mwili ama pia kwa mawazo?"* Grace taps `Uliza`. Amina answers. Constructs fill. | **This is the agentic proof.** The question was not scripted; it uses her exact words; it is the one question that separates somatic from psychological. |
| 2:00–2:15 | **Recovery** | One turn returns a short transcript. Amber strip: *"Tunaweza kuwa tumekosa sehemu ya aliyosema. Rekodi tena?"* Grace re-records. It works. | **The benchmark finding, operating inside the product.** Honest about failure and shows the design that catches it. |
| 2:15–2:30 | **Safety** | Amina: *"Kuna siku nafikiria ingekuwa poa kama singekuwepo."* S5 fires. Crimson. Grace puts the phone down and takes her hand. | The escalation redirects to the human. **Show her putting the phone down. That single gesture is the ethics argument.** |
| 2:30–2:45 | **The downstream task** | S6 back-read to Amina in her own mix → S7 result: band, PHQ-9, tier `facility_urgent`, reason, both disclaimers → S8 English handover with her verbatim quotes | **The transcript is nowhere on screen in this beat.** The record and the referral are the product. **[CR-C2]** |
| 2:45–3:00 | **The benchmark** | S10 "Kwa nini Sahara?" Table 2 held on screen: **band-flip rate by model.** Closing card: *"Aggregate WER cannot see a deleted 'stress'. Band-flip rate can."* | Rigour, and a sentence a judge will repeat. |

## 23.4 Where each judging dimension is demonstrated

**Real-world impact:** 0:00 and the closing card. **Code-switching:** 0:35 and 1:05. **Product quality:** throughout, and specifically the Kiswahili microcopy and the real Android. **Technical execution:** 2:00 (the deletion detector) and 2:45 (the benchmark). **Ethics & safety:** 0:20 (consent), 1:20 (the refusal to over-read), 2:15 (escalation), 2:30 (back-read + disclaimers), and 2:45 if the excluded-vendor note is visible on S10.

## 23.5 Demo rules

**Do:** record against a deployed URL; use a real Android; show the phone in a hand at least once; keep every Kiswahili line native-reviewed; show the failure recovery; end on the record, not the transcript.
**Do not:** narrate features; show a settings screen; show a dashboard; use a stock-photo African mother; add music under the escalation beat; speed up the processing states (**a real 5-second wait is more credible than a fake instant one, and a judge who has built this knows it**); imply MOH endorsement the team does not have.

## 23.6 If something breaks on the day

Record the full run **before** it is needed. Keep a known-good session recorded end to end. If Sahara's credits run out mid-recording, the earlier take is still available. **⚠️ Check the credit balance before every recording session.**

---

# 24. MVP Build Plan

## 24.1 The real calendar

**Two people. Target: everything submittable by the end of the second day, working through the night between them.** The plan is expressed in **elapsed hours from now (T+0)**, not in dates, because the team is compressing rather than spreading. Total window to a submittable package: **T+34**.

**Estimates assume agent-assisted development** (Claude Code, Cursor or equivalent) for scaffolding, boilerplate, adapters, test fixtures and the benchmark harness. Without that, multiply the build milestones by roughly 2 and cut accordingly. The estimates do **not** compress for the three things agents do not speed up: native-speaker Kiswahili review, clinician review of the safety lexicon, and recording the demo.

## 24.1a The two tracks and where they meet

**Person A: Product.** Next.js app, UI, audio capture, agent orchestration, persistence.
**Person B: Intelligence and Benchmark.** Sahara adapter, lexicons, extraction prompt and schema, safety layer, benchmark harness, report.

The tracks run in parallel after T+2 and meet at one interface: `ASRAdapter` plus the `extraction` JSON schema. **Agree both inside the first hour and freeze them at T+6.** Changing either after that costs more than whatever it buys.

| Window | Person A (product) | Person B (intelligence + benchmark) |
|---|---|---|
| **T+0 → T+2** | M0 Unblock, together | M0 Unblock, together |
| **T+2 → T+7** | M1 app shell, capture, S1/S2/S3 | M1 Sahara adapter, both lexicons |
| **T+7 → T+13** | M2 S4 turn loop, evidence cards | M2 extraction schema, span validation, somatic rule + backstop |
| **T+13 → T+17** | M3 span tinting, deletion strip | M3 LID, `cps`, deletion detector |
| **T+17 → T+24** | M4 coverage state, decision function, S5 escalation | M4 probe generation, deterministic scoring and routing |
| **T+13 → T+29** | n/a | **M6 benchmark, interleaved. Long-running jobs start early and run unattended.** |
| **T+24 → T+29** | M5 S6/S7/S8/S9, design system, microcopy | M6 continues; report generation |
| **T+29 → T+32** | M7 acceptance testing, together | M7 acceptance testing, together |
| **T+32 → T+34** | M8 demo, docs, submit | M8 benchmark report, field set packaging |

**T+24 is the hard gate. The MVP is functionally complete there or the cut list in §24.11 gets deeper, not the schedule longer.**

⚠️ **Two risk notes on the overnight plan, offered as engineering rather than advice.** First, **start the benchmark's long jobs before the tired hours**, because a run that fails at T+26 costs two hours you will not have. Second, four items should not be executed at hour 30 of a push: the **safety lexicon** (§11.4a), the **item-9 probe wording** (§11.6a), the **acceptance tests in §26.11**, and the **final read of every Kiswahili string**. Those are the four places where a mistake is not recoverable by a later commit. Front-load them, or schedule the sleep block before them.

⚠️ **Fire the external dependencies at T+0, because they run on other people's clocks.** Gated Hugging Face approval, a native Kenyan Kiswahili reviewer, and a clinician for the safety lexicon are all blocking, all unaffected by how fast the team works, and all free to request now.

## 24.1b The two contracts, and what "contract" means here

A **contract** is a written agreement on the shape of data crossing between the two tracks. It is not a design document and not code. It exists so that A and B can build against each other for twenty hours without either one blocking on the other, and so that neither discovers at T+20 that the other returns a different shape than expected.

**Why two people need this and one person would not.** With a single developer, the interface lives in their head and refactoring is cheap. With two people on parallel tracks and no time for integration debugging, an unwritten interface fails in the worst possible way: both halves work, neither half works together, and the discovery happens with hours left. Writing these down costs twenty minutes. Not writing them down is the most likely cause of a failed integration on this schedule.

**Write both into `docs/contracts.md`, commit it, and freeze at T+6.** After T+6 a change requires both people to agree and both to update their side in the same sitting.

### Contract 1: `ASRAdapter` (the boundary between the product and any speech model)

Everything about which ASR model is in use sits behind this one function signature (§17.5).

```ts
interface ASRAdapter {
  name: string;                       // "sahara-v2.5-corr-off", "whisper-large-v3-sw", ...
  transcribe(audio: Blob | Buffer, opts: { lang: string }): Promise<{
    text: string;                     // the transcript, verbatim, no post-processing by us
    latencyMs: number;                // measured at this boundary, for §14.1 and the benchmark
    meta: Record<string, unknown>;    // model-specific extras; never read by product logic
  }>;
}
```

**What the contract must additionally state in writing**, because these are the parts that bite:
- **Errors throw typed errors, they do not return empty strings.** An empty `text` means "she said nothing", and a failed call means "we do not know what she said". Conflating those two is how a screening record silently loses a turn.
- **The adapter never retries.** Retry policy, backoff and `Retry-After` handling live in the caller, so the benchmark can measure raw latency and the product can retry on its own terms.
- **`text` is returned unmodified.** No trimming, no normalisation, no casing changes. Normalisation is the benchmark's job (§18.7) and the safety scan must see raw text (§11.4a rule 2).
- **Who owns which implementation:** B writes `SaharaAdapter` plus the benchmark-only adapters; A consumes the interface and never imports a concrete adapter directly.

**What this buys.** Swapping the product's ASR is a one-line config change. That is also what makes the benchmark honest rather than decorative: the thing being benchmarked is literally the thing the product calls.

### Contract 2: the `extraction` JSON schema (the boundary between the transcript and the clinical record)

The exact object B's extraction step returns and A's UI renders. **The authoritative shape is §11.3** and the contract file should reference it rather than restating it, so there is one source of truth.

**What the contract must state in writing:**
- **Every field is required. There are no optional clinical fields.** A missing field is a schema violation, not a default.
- **`evidence_span` must be a literal substring of the turn transcript**, and the validator that enforces it (FR-11) belongs to B and runs before A ever sees the object.
- **Enumerations are fixed and named:** `construct` values, `severity_estimate` as an integer 0 to 3, `confidence` as a float 0 to 1, `span_language` as one of `sw | en | sheng | unknown`.
- **`risk_flag` is top-level, not an item.** A's escalation logic reads only that field and the deterministic scan's output, never an item's contents.
- **Denial and absence are different states.** A construct the mother explicitly denied goes in `constructs_addressed_but_negative`; a construct never reached is simply absent. A's coverage strip renders these differently, so the distinction must survive the boundary.
- **B ships a hand-written example object and a deliberately invalid one on day one.** A builds the UI against those two fixtures and does not wait for the model to work. This is the single highest-value item in the contract, because it decouples the two tracks completely for the first six hours.

### A third thing worth agreeing at T+0, though it is not an interface

**The `data/` files are contracts with the clinicians, not with each other:** `idiom_lexicon.csv`, `safety_lexicon.csv`, `probes/phq9_item9.sw.txt`. They are data, not code, specifically so a clinician or a native speaker can review them without reading TypeScript (§14.8). **Agree their column headers at T+0**, because renaming a column at T+20 breaks both tracks at once.

## 24.2 Milestone 0: Unblock (T+0 → T+2, both, 2 h)

**Goal.** Start every clock that is not the team's own, and prove every external dependency actually works before writing code against it.

**Already resolved, no action needed:**
- ✅ **Sahara API key in hand.**
- ✅ **Hugging Face access granted to `intronhealth/AfriSwitchCare` and `intronhealth/AfriSwitch`.** This was the single highest-risk item in an earlier draft of this plan and it is now closed. **Consequence: the deletion-detector `FLOOR` can be derived from real AfriSwitchCare gold transcripts as originally specified (§11.5), and the field-set fallback in §24.11 is no longer needed.**

**Tasks, in priority order:**

1. **Prove the key and the datasets, do not assume them.** One real transcription call returning text from a WAV, and one `load_dataset("intronhealth/AfriSwitchCare", "swahili", split="test")` that actually materialises rows. ⚠️ **Confirm the config name is `"swahili"`** while doing it; §18.5 flags that it was inferred from the card's `"hausa"` example.
2. ⚠️ **Check the Sahara credit balance and estimate burn before building.** The streaming API returns `credit_balance` in `SESSION_CREATED`; the file API surfaces `QUOTA_EXCEEDED`. **The participant allowance is published nowhere.** Dataset A is 1.54 h, plus development turns, plus benchmark re-runs. **This is now the highest-risk external unknown on the board**, and running out at T+25 is the one failure this milestone exists to prevent.
3. **Ask a native Kenyan Kiswahili speaker** whether they can review roughly 60 short strings later in the build. A hard Definition-of-Done item (§25.5), and it cannot be compressed.
4. **Ask a Kenyan mental health clinician** to review the safety lexicon (§11.4a) and the item-9 probe wording (§11.6a). If nobody is reachable, that goes in `LIMITATIONS.md` rather than being quietly skipped.
5. Ask Intron how to submit and the deadline timezone, via **both** voice@intron.io (the API support address, per §2.1) **and** the [intron.io/contact](https://www.intron.io/contact/) form.
6. Repo, `.env.example`, deploy an empty Next.js app to a public URL **in this milestone**, so deployment is never discovered to be broken at T+33.
7. Provision Postgres, apply the 6-table schema.
8. **Agree the two contracts in writing (§24.1b).**

**Definition of done.** A Sahara call returns a transcript from a real WAV; the Swahili dataset config loads and its row count matches the card; credit balance known and burn estimated; both human reviewers asked; a blank app is live at a public URL; both contracts committed to `docs/contracts.md`.
**Risk.** Credits are tighter than the benchmark needs. **Mitigation:** dataset A only (B is already cut, §24.11), and reduce the benchmark to three model configurations before reducing anything in the product.

## 24.3 Milestone 1: Foundation (T+2 → T+7, 5 h)

**A:** app shell, routing, S1/S2/S3, `MediaRecorder` capture with the amplitude meter, `localStorage` for the CHP code.
**B:** `SaharaAdapter` working end to end on a file; `data/idiom_lexicon.csv` (15 entries, §5.4, with citations); `data/safety_lexicon.csv` including hedged forms.
**DoD.** Record in the browser → server → Sahara → transcript on screen. Consent gate enforced **server-side**. Both lexicons committed as CSV.
**Risk.** WebM/Opus rejected. **Mitigation:** Sahara accepts WebM per the docs; if it fails, a server-side ffmpeg transcode to WAV is a 30-minute fallback.

## 24.4 Milestone 2: Core voice interaction (T+7 → T+13, 6 h)

**A:** S4 in all four states; turn loop; evidence card component; transcript collapsed; 100 s/110 s limits; error states from §21.1 and §21.2.
**B:** extraction prompt with strict JSON schema; **span validation**; the somatic-only rule **and its deterministic backstop (§11.4b)**; confidence banding; **the output denylist (FR-24a)**.
**DoD.** One turn produces validated evidence cards with verbatim quotes. **Adversarial fixture: a hallucinated span is dropped and logged.**
**Risk.** Schema instability. **Mitigation:** `temperature = 0`, enforce in code, one retry, then manual path.

## 24.5 Milestone 3: Code-switch processing (T+13 → T+17, 4 h)

**B:** token LID; CMI; `cps`; **deletion-signature detector with `FLOOR` derived from AfriSwitchCare gold transcripts, not guessed**; fuzzy idiom matching with stem variants.
**A:** ochre tinting of English spans in the transcript; the amber deletion strip.
**DoD.** A code-switched utterance shows tinted English spans; a truncated transcript raises the amber strip; an idiom match produces a chip with its `idiom_id`.
**Risk.** LID accuracy is poor. **Mitigation:** heuristic lexicon plus character n-grams is sufficient for tinting and `cps`. **Cap this at 90 minutes; a proper LID model is not in scope** (§24.11).

## 24.6 Milestone 4: Agentic workflow (T+17 → T+24, 7 h). **The MVP is functionally complete at T+24 or the cut list gets deeper.**

**A:** coverage state; the decision function **including the item-9 gate (§11.6)**; probe card; `MAX_TURNS`; S5 escalation with bundled crisis contacts, hours, costs and the privacy check; the manual risk-flag button.
**B:** probe generation with the register-mirroring constraints; **the fixed item-9 probe file (§11.6a)**; **deterministic `score()`, the band table and `route_referral()` with unit tests against hand-computed vectors and at every band boundary**.
**DoD.** A multi-turn session runs to `COMPLETE`. A safety phrase triggers S5 inside the §14.1 budget. **Unit test asserts no path through `decide()` returns `COMPLETE` while PHQ-9 #9 is `UNCOVERED`.** Scoring and banding are unit-tested. The escalation tier is latched and cannot be lowered by an edit.
**Risk.** The loop misbehaves live. **Mitigation:** the state machine is explicit and logged; `Maliza` (finish) is always available.

## 24.7 Milestone 5: UI/UX polish (T+24 → T+29, 5 h, A leads)

**A:** S6, S7, S8, S9; back-read generation; English handover; disclaimers on S1/S7/S8; the full colour and type system; all microcopy; 360×640 verification on a real Android; `prefers-reduced-motion`.
**B:** S10 as a static table rendered from the committed results CSV (per §24.11); the audio purge path with its audit event.
**DoD.** A complete session runs from S1 to S8 on a real Android. Audio is verifiably deleted. **⚠️ Native Kiswahili review of every string is complete.**
**Risk.** Polish expands without limit, which is the classic way a 5-hour milestone becomes 12. **Mitigation:** this milestone has a hard 5-hour box. At T+29 whatever is unfinished moves to §24.11, not into M7's window. **Product Quality is the binding constraint on the whole submission (§28), so protect this box rather than extending it.**

## 24.8 Milestone 6: Benchmarking (T+13 → T+29 on B's track, interleaved, ~8 h of attended work)

**This milestone is deliberately not a block.** It is a set of long-running jobs that B starts early and babysits between other tasks, because a benchmark run is mostly waiting and Sahara's sync endpoint is rate-limited to 30 requests per minute. **Start the first real run no later than T+17.**

**B:** VAD chunking, computed once and committed; adapters for Sahara (both configurations), Whisper (both conditions) and Jacaranda; Tier 1 and Tier 2 metrics on dataset A; **Tier 2 SPR and all of Tier 3 on field set C** (§18.5a); a 20-utterance failure analysis across two configurations (§24.11); report generation; raw per-sample CSVs.
**Also in this window:** record field set C, 28 clips (§18.6). **The 4 held-out safety clips must be written by whichever team member did not author the safety lexicon**, so schedule that handoff rather than discovering it at the end.
**DoD.** `python -m bench.run --models all` completes from a clean clone. Tables 1, 2 and 4 populate. **Band-flip is computed on field set C, not on dataset A.** Results committed as CSV and rendered on S10.
**Risk.** Credits exhausted mid-run. **Mitigation:** run dataset A first (in-domain and the smaller at 1.54 h); dataset B is already cut (§24.11); field set C is entirely under the team's control. **If credits run short, drop model configurations before dropping datasets**, because three configurations on two datasets is a more defensible submission than five on one.

## 24.9 Milestone 7: Testing (T+29 → T+32, 3 h, both)

Both: run every §26 acceptance scenario against the deployed URL; verify all §25 Definition of Done boxes; a timed dry run with **someone not on the team**; dependency audit; **assert no log line contains PHI**; confirm no third-party scripts.
**DoD.** All P0 scenarios pass. Every unchecked DoD box is either fixed or explicitly listed as a known limitation in the README.

## 24.10 Milestone 8: Submission (T+32 → T+34, 2 h, both)

Record the demo (multiple takes, and **keep a known-good full run as a backup before attempting a better one**); write `README.md`, `BENCHMARK.md`, `RESPONSIBLE-AI.md`, `LIMITATIONS.md`; package field set C audio and metadata CSV; release `idiom_lexicon.csv` under CC BY 4.0; final read-through of this specification against §28. **Then submit.**

**⚠️ Submit as soon as the package is complete, and do not hold it for polish.** No deadline time-of-day or timezone is published (§2.1), so a deadline in an unknown timezone has already passed somewhere. If the submission mechanism allows resubmission, submit a complete-but-imperfect package the moment one exists and replace it afterwards. **Every hour a finished package sits unsubmitted is pure downside risk.**

⚠️ **Check the Sahara credit balance immediately before recording the demo.** Running out mid-take is a recoverable annoyance if a known-good run is already saved and an unrecoverable one if it is not.

## 24.11 Cut list, pre-agreed

**Cut these at T+0, before starting, not "if we fall behind".** A review of the Must-Have list against the available hours found it roughly three times oversized. **Cutting at hour 28 under pressure produces worse choices than cutting at hour zero with a clear head**, and on a compressed overnight schedule the decision quality gap is the whole argument.

| Cut | Instead | Why now |
|---|---|---|
| **Dataset B from the benchmark** | Datasets A and C only | 650 utterances × 6 configs is ~3,900 ASR calls; at Sahara's 30 req/min sync limit that is over two hours of wall clock **per Sahara config alone**, before Whisper or anything else. It is the robustness set, not the primary one. |
| **Tier 3 metrics on dataset A** | Field set C only | Not a time cut, a correctness cut: §18.5a shows band-flip on A is degenerate by construction. Doing less here is doing it right. |
| **The 5th model (MMS) and ElevenLabs** | Sahara ×2 + Whisper ×2 + Jacaranda | Three vendors, five configurations. Satisfies the narrower reading of the requirement; add ElevenLabs back only if the harness is finished and idle before T+29. |
| **Failure analysis at 100 utterances × 11 categories × 5 models** | **20 utterances, 2 configurations** (Sahara corr-OFF vs Whisper-auto), one table | Several hours of unavoidably manual labour, assigned to the person still building the harness. The qualitative finding is identical at 20. |
| **CMI computed per turn in the product (FR-08)** | Keep a wordlist good enough to tint English spans ochre; compute CMI once, in the harness, on gold text | A heuristic LID yields CMI with unknown error, which makes CMI-Δ meaningless anyway. The only thing the product needs LID for is the demo beat at 1:05. |
| **S10 wired to live benchmark output (M16)** | A static table rendered from a committed CSV | A judge cannot tell the difference, and the wiring competes directly with M5's polish box. |
| **M14's "list past screens for a mother"** | Persist only; no history screen | Adds a screen, a query and an empty state for something the demo never opens. |
| **FR-22's "at her measured proportions"** | Reproduce her verbatim quotes inside a Kiswahili frame | Hitting a target token ratio is an open generation-control problem, and it is not what the trust requirement in §4.2 asks for. Her own words back is. |
| **Automated PHI-in-logs and bundle-inspection CI tests (FR-40, §25.6)** | Keep the discipline; verify by manual grep during M7 | The check matters, the automation does not, on this timescale. |

**If still behind after all of the above, cut in this order:** S11 mother history → offline queueing (SH4) → session pause/resume (SH5) → inline single-item re-record (SH2).

✅ **The deletion-signature detector's external dependency is resolved.** Dataset access is granted (§24.2), so the `FLOOR` is derived from real AfriSwitchCare gold transcripts as §11.5 specifies. **Derive it, record the derived value in the repo, and do not hardcode a guess.**

**Never cut:** the safety layer, **the fixed item-9 probe (§11.6a)**, **the item-9 gate in `decide()`**, span validation, the somatic-only rule **and its deterministic backstop (§11.4b)**, the output denylist (FR-24a), consent enforcement, audio deletion, the disclaimers, or the deterministic scoring. **Those are the submission.**

---

# 25. Definition of Done

The project is **not** done because the code runs, a transcript appears, the UI looks good, or the happy path works.

## 25.1 Product Done
- [ ] A CHP can complete a full screening from S1 to S8 on a real mid-range Android without instruction
- [ ] Every screen has a real empty, loading, error and success state
- [ ] Session completes in ≤10 minutes across ≤6 turns
- [ ] Records persist and are listed per mother
- [ ] The product never emits a diagnosis, a label, a medication, or a treatment recommendation
- [ ] Both disclaimers appear on S1, S7 and S8, verbatim

## 25.2 Voice Done
- [ ] User can start and stop a voice interaction with one tap
- [ ] Audio capture works reliably on a real Android in a noisy room
- [ ] Recording state is visible across a room
- [ ] Live amplitude meter functions and shows the low-level floor
- [ ] Silence is detected and hinted **during** capture, not after
- [ ] Microphone permission denial produces a specific, actionable card
- [ ] 100 s warning and 110 s auto-stop work
- [ ] Every audio error is recoverable without losing the session
- [ ] Code-switched speech is accepted with no language selection anywhere

## 25.3 Code-Switching Done
- [ ] Sahara is called with `use_language_asr_input="sw"`
- [ ] Mixed-language transcripts display verbatim and untranslated
- [ ] English spans are visually distinguishable in the transcript
- [ ] Token LID, CMI and `cps` are computed per turn
- [ ] Deletion-signature detector fires on truncated transcripts, with `FLOOR` **derived from data and recorded in the repo**
- [ ] Idiom lexicon matches fuzzily with stem variants and records `idiom_id`
- [ ] Sheng input is accepted and recorded without crashing, and is **not** claimed as a supported capability anywhere in the submission
- [ ] Probes mirror the mother's register and never translate her idiom back at her
- [ ] A third language is marked `unrecognised_language` and is never hallucinated into Swahili

## 25.4 Agent Done
- [ ] Coverage state is maintained across turns and is visible
- [ ] The agent decides between PROBE, ESCALATE and COMPLETE, and every decision is logged
- [ ] Probes are generated, not scripted, and reference her prior words
- [ ] **PHQ-9 item 9 is always probed at least once**
- [ ] Covered constructs are never re-probed
- [ ] `MAX_TURNS = 8` terminates the loop
- [ ] The negative short-path requires both PHQ-2 and GAD-2 covered and below threshold
- [ ] `score()` and `route_referral()` contain no model and are unit-tested against hand-computed vectors
- [ ] The referral tier and its reason appear on S7 and in the handover

## 25.5 UX Done
- [ ] Verified at 360×640 on a real device
- [ ] All targets ≥48 px; the primary control is thumb-reachable
- [ ] Contrast ≥4.5:1 for text; no meaning is conveyed by colour alone
- [ ] **Every Kiswahili string reviewed by a native Kenyan speaker**
- [ ] Read-aloud text (consent, back-read, escalation script) is ≥18 px
- [ ] **The mother's quote is the largest text on every evidence card**
- [ ] No error message says "something went wrong"
- [ ] `prefers-reduced-motion` is honoured
- [ ] A non-team participant completes a screening after ≤5 minutes of instruction

## 25.6 Technical Done
- [ ] Deployed to a public URL and the demo is recorded against it
- [ ] API keys are server-side only; verified absent from the client bundle
- [ ] **Consent is enforced server-side**, and the bypass test (25.12C) fails to bypass
- [ ] Span validation drops non-substring spans and logs them; adversarial test in CI
- [ ] Audio purge runs and writes its audit event; integration test asserts deletion
- [ ] **No PHI appears in any log line**; asserted by test
- [ ] **No third-party analytics or session-replay scripts on any screen**; dependency audit clean
- [ ] p95 stop-record → evidence ≤9 s, measured
- [ ] The state machine logs every transition

## 25.7 Benchmark Done
- [ ] ≥4 models evaluated (Sahara + 3), satisfying both readings of the requirement
- [ ] Sahara run in both LLM-corrections-OFF and ON configurations, reported separately
- [ ] VAD chunking computed once and shared identically across all models, committed to the repo
- [ ] Tier 1 (WER, CER, latency) computed
- [ ] **Tier 2 (EESR, EESR-clinical, CIR, SPR, CMI-Δ) computed**
- [ ] **Tier 3 (construct F1, |ΔPHQ-9|, band-flip, tier-flip, safety-flag flip) computed**
- [ ] Failure analysis over a stratified 100-utterance sample, categorised per §18.11
- [ ] Excluded models documented with reasons (**Deepgram ToS, AssemblyAI ToS, no-Swahili NVIDIA, w2v-BERT headless**)
- [ ] Normalisation deviations declared, including the diacritics choice and the duplicated-column bug
- [ ] Raw per-sample CSVs committed; `hypothesis` column named correctly
- [ ] One-command reproduction works from a clean clone
- [ ] Results render on S10 inside the product

## 25.8 Responsible AI Done
- [ ] Consent script is written, versioned, displayed and stored
- [ ] Audio deleted by default; retention is per-session opt-in
- [ ] Consent is withdrawable mid-session with immediate deletion
- [ ] **SPR = 1.00 on the safety test set**
- [ ] Safety layer is deterministic and contains no model
- [ ] Safety escalation works with no network
- [ ] **Only tier-A verified crisis contacts ship**; `befrienderskenya.org` and the premium-rate number are excluded
- [ ] The Kenya legal-status line is in the escalation script
- [ ] Risk register (§20.6) is complete with residual risks stated
- [ ] `RESPONSIBLE-AI.md` documents controls **and** limitations, including the accent-bias measurement gap
- [ ] Instrument licensing documented; EPDS explicitly excluded with its reason

## 25.9 Demo Done
- [ ] ≤3 minutes, recorded against the deployed URL on a real Android
- [ ] Contains an utterance with ≥3 Kiswahili-English switch points and a documented idiom
- [ ] Shows the somatic-only refusal
- [ ] Shows an agent-generated probe using the mother's own words
- [ ] Shows a failure and its recovery
- [ ] Shows the safety escalation and the CHP putting the phone down
- [ ] **Ends on the record and the referral, never on a transcript**
- [ ] Shows the benchmark, including band-flip rate
- [ ] A known-good full run is recorded and stored as a backup

## 25.10 Documentation Done
- [ ] `README.md`: what it is, who it is for, setup from a clean clone, `.env.example`, one-command benchmark
- [ ] `BENCHMARK.md`: models, datasets, metrics, method, results, failure analysis, exclusions, normalisation deviations
- [ ] `RESPONSIBLE-AI.md`: privacy, consent, safety, bias, limitations
- [ ] `LIMITATIONS.md`: everything in §29.3, stated plainly
- [ ] `data/idiom_lexicon.csv` released CC BY 4.0 with per-row citations
- [ ] `data/fieldset_metadata.csv` + field set C audio
- [ ] This specification, included in the repo

## 25.11 Competition Submission Done
- [ ] Problem & solution description written
- [ ] Working prototype video submitted
- [ ] Code repo public, or technical documentation submitted
- [ ] Benchmark results submitted
- [ ] Responsible AI note submitted
- [ ] Field set C audio + metadata submitted (**never datasets A or B, which are CC BY-NC-SA and gated**)
- [ ] Vertical stated as Health in the first line
- [ ] ⚠️ Submission mechanism and deadline timezone confirmed with Intron
- [ ] **Submitted as soon as the package was complete, not held for polish** (§24.10)

---

# 26. Acceptance Test Scenarios

Each scenario is **P0** (blocks submission) or **P1** (should pass). Together they operationalise §25: a Definition of Done box is only ticked when the corresponding scenario passes against the deployed URL.

## 26.1 Happy path (P0)

**Scenario.** Grace screens Amina. Five turns, clear audio, natural code-switching, no risk content.
**Input.** The §5.3 utterances covering rumination, sleep, appetite, anhedonia, energy.
**Expected system behaviour.** Consent recorded → 5 turns transcribed → constructs populate with verbatim spans → agent probes uncovered constructs → `COMPLETE` → scores computed deterministically → tier assigned → back-read generated → record persisted → audio deleted.
**Expected UI.** S1→S2→S3→S4(×5)→S6→S7→S8 with no error states.
**Expected outcome.** A `ScreeningRecord` with ≥6 PHQ-9 items evidenced, a band, a tier, a reason, non-empty `disclaimers[]`, and an `audio_purged` audit event.
**Pass criteria.** Every populated item's `evidence_span` is a literal substring of its turn transcript. Session ≤10 min. Success screen appears **only after** the write is confirmed.

## 26.2 Code-switch path (P0)

**Scenario.** Heavy intra-sentential Kiswahili-English switching.
**Input.** *"Nikiamka asubuhi naskia body yangu ni heavy, sina energy ya kufanya kitu. Niko na stress sana."*
**Expected.** English spans present in the transcript and visibly tinted; `language_profile` reflects the mix; CMI computed; probes are generated in her mixed register, not in monolingual Kiswahili.
**Note.** A Sheng variant of this fixture (*"Sifeel poa kabisa"*) is recorded and observed but **not scored against a pass criterion** (§5.1).
**Pass criteria.** **No English token is silently dropped.** Verified by manual comparison against what was spoken. `EESR = 1.00` on this fixture.

## 26.3 Noise path (P1)

**Scenario.** The same utterance recorded twice: quiet room, and radio plus infant.
**Expected.** Both transcribe. The noisy version may show lower confidence and may raise the deletion strip. **Neither crashes and neither silently produces an empty transcript presented as complete.**
**Pass criteria.** Degradation is visible to the CHP, never hidden. The paired recordings are in field set C and the WER delta is reported.

## 26.4 Low confidence path (P0)

**Scenario.** A mumbled, hedged, ambiguous statement.
**Input.** *"Ni... sijui... kuna vitu tu... si mbaya sana."*
**Expected.** No construct populates (`confidence < 0.60`). The construct becomes a probe target. **The system asks rather than guessing.**
**Pass criteria.** Zero items populated from this turn. A probe is generated. **A populated item here is a P0 failure.**

## 26.5 Wrong transcription path (P0)

**Scenario.** Sahara returns a transcript containing a word the mother did not say, and extraction quotes it. Simulated by injecting a corrupted transcript.
**Expected.** The span is still validated as a substring **of the transcript**, so it passes mechanical validation, and is then caught by the **back-read**: Grace reads it to Amina, Amina says she did not say that, Grace taps `Amekanusha`.
**Pass criteria.** The item is removed. `item_disputed` is written to `audit_event`. The score recomputes. **This scenario exists to prove that the human layers catch what the mechanical layer structurally cannot.**

## 26.6 Hallucinated span (P0)

**Scenario.** The extraction model returns an `evidence_span` absent from the transcript. Simulated with a stubbed response.
**Expected.** **Item dropped, not repaired, not fuzzy-matched.** `span_validation_failure` logged.
**Pass criteria.** The item never reaches the UI or the record. Adversarial unit test in CI.

## 26.7 Somatic-only path (P0): the product's thesis under test

**Scenario.** The mother reports only physical symptoms.
**Input.** *"Kichwa inauma kila siku. Mgongo pia. Nimechoka sana kimwili."*
**Expected.** `somatic_only: true` → `confidence ≤ 0.59` → **no construct populates** → the construct enters probe tier 4 → a psychologising probe is generated that uses her own words.
**Pass criteria.** Zero psychological constructs populated. A probe is generated. **If a depression construct populates from this input, the product has committed exactly the error it exists to prevent, and this is a P0 failure.**

## 26.8 Ambiguous intent path (P1)

**Scenario.** Contradiction across turns: *"Silali kabisa"* in turn 2, *"nalala vizuri"* in turn 4.
**Expected.** Both quotes shown side by side; the CHP is asked to clarify with her. **The system does not silently pick one.**
**Pass criteria.** No score is written for the contested construct until the CHP resolves it.

## 26.9 Network failure path (P0)

**Scenario.** Connectivity drops mid-turn, then after a completed session.
**Expected.** Mid-turn: audio retained, backoff retry, the mother is never asked to repeat herself. Post-session: record held in `localStorage`, **success screen withheld**, banner states it is unsent, retried on reconnect.
**Pass criteria.** **Zero data loss. The success screen never appears before a confirmed write.**

## 26.10 Downstream tool failure (P1)

**Scenario.** Sahara returns 429, then `QUOTA_EXCEEDED`.
**Expected.** 429 → backoff honouring `Retry-After`, transparent to the CHP. Quota → a **named** error stating what happened and what to do. Not "something went wrong."
**Pass criteria.** The error names the cause. The session can still be completed via manual entry.

## 26.11 Safety escalation (P0): the most important test in this document

**Scenario A (explicit).** *"Nilifikiria kujitia kitanzi."*
**Scenario B (hedged).** *"Kuna siku nafikiria ingekuwa poa kama singekuwepo."*
**Scenario C (English embedded).** *"Sometimes I think everyone would be better off without me."*
**Scenario D (low ASR confidence on the risk phrase).**

**Expected, all four.** S5 fires within 500 ms of transcript receipt. Recording stops. The matched quote is shown. The CHP script including the Kenya legal-status line is shown. **Only tier-A verified crisis numbers appear.** Acknowledgement is required. The escalation is written to the record irreversibly. The referral tier is forced to `facility_urgent`.

**Pass criteria.**
- **SPR = 1.00 across the full safety test set. Any miss blocks submission. There is no negotiation on this line.**
- S5 renders with **no network** (contacts are bundled).
- Scenario D escalates despite low confidence: **confidence thresholds do not apply on the safety path.**
- Dismissing S5 does not remove the flag.

## 26.12 Consent scenarios (P0)

**A. Declined.** Grace taps `Amekataa` → S9 → nothing stored except an anonymous counter. **Pass:** zero rows in `mother`, `session`, `turn` for this attempt.
**B. Withdrawn mid-session.** After three turns, Amina asks to stop → one tap → everything from the session is destroyed. **Pass:** all audio, transcripts and extractions gone; only a `consent_withdrawn` audit event remains.
**C. Bypass attempt.** A crafted request uploads audio for a session with `consent_granted = false`. **Pass: the server rejects it.** UI-only enforcement is a P0 failure.

## 26.13 Non-diagnosis (P0)

**Scenario.** Review every string the product can emit: UI copy, probes, back-read, handover, error messages.
**Pass criteria.** **No DSM or ICD code, no diagnostic label, no medication name, and no treatment recommendation appears anywhere.** The disclaimer is present on S1, S7 and S8, and `disclaimers[]` is non-empty on every record. Automated string test plus one manual review pass.

---

# 27. Anti-Feature List

Things a team under time pressure will be tempted to build. Each is excluded with a reason, and the reason is the useful part.

| Anti-feature | Why not |
|---|---|
| **Live streaming transcription** | Pulls the CHP's eyes off the mother during a disclosure; shows visibly wrong partial hypotheses on code-switched speech; costs a day of WSS plumbing; and breaks parity with the benchmark. Sahara offers it. We decline it. (§10.4) |
| **A conversational TTS agent that interviews the mother** | Technically the flashiest thing available (Sahara ships Swahili TTS) and the worst product decision on the list. A synthetic voice asking a woman about self-harm is strictly worse than a trained human asking. It also burns the latency budget and removes the one person who can respond to a crisis. |
| **Speaker diarization** | AfriSwitchCare Swahili has no speaker markers, so it cannot even be evaluated on our primary in-domain set. Real cost, unmeasurable benefit. |
| **A language selector** | Its *absence* is the product's positioning statement. Adding one would undo the thesis. |
| **User accounts, passwords, RBAC** | A CHP code suffices for a 4-day demo. Real auth is pilot work and adds zero judging value. |
| **An analytics dashboard with charts** | Judges do not score charts. It is a day of work that shows nothing the demo does not. |
| **Multi-language expansion beyond Swahili-English** | Sahara offers 11 other code-switched pairs and it is tempting to claim breadth. Breadth without depth reads as a demo. **One language pair, done properly, beats twelve done shallowly**, and the idiom lexicon does not generalise. |
| **Fine-tuning our own ASR model** | No public Swahili-English code-switched training corpus exists. On this timescale it is not a project, it is a way to lose. (It is a good *paper*: §29.5.) |
| **Full offline mode** | Genuinely valuable in the field and genuinely a multi-day build with sync-conflict handling. Queueing a completed record (SH4) captures most of the value for a fraction of the cost. |
| **PDF report generation** | The clinician reads a WhatsApp message, not a PDF. Plain text share is correct and takes an hour. |
| **A mother-facing companion app** | Doubles the surface area, halves the polish, and reintroduces the unsupervised-disclosure safety problem. |
| **A RAG layer over clinical guidelines** | Sounds sophisticated; adds a hallucination surface to a product whose entire trust model is verbatim quotation. **Nothing in the workflow requires retrieval.** |
| **Sentiment or emotion detection from audio prosody** | Very tempting and quite dangerous. It would let the system claim a construct from something not in the transcript, breaking the verbatim-evidence guarantee. Also, the realistic prior is poor: RideKE (29,000 Kenyan code-switched tweets) reaches **31% macro-F1 on emotion**. **Explicitly banned by §11.3 rule 2.** |
| **Predicting a diagnosis, or a risk score from an ML model** | Legally prohibited (§8.5) and would replace a deterministic, inspectable, defensible score with an unaccountable one. |
| **Gamification, streaks, badges for CHPs** | The context is a woman describing suicidal thoughts. No. |
| **Supporting iOS, tablets and desktop in the MVP** | The user has a government-issued Android. Design for it. |
| **A settings screen** | Every setting is a decision we failed to make. |
| **Anything requiring an MOH or Jacaranda logo** | Implying an endorsement the team does not have is a fast way to lose the Ethics dimension and the relationship. |

---

# 28. Competition Readiness Review

Written as a skeptical judge who has seen forty submissions and is looking for reasons to cut. **Scores are deliberately not inflated. Nothing scores 10.**

| Criterion | Score | Reason | Weakness | Improvement |
|---|---|---|---|---|
| **Problem significance** | **8** | A detection rate below 2 per 100,000 consultations, cited to a 5.3-million-consultation trial, plus MOH's own written acknowledgement that no form carries the field. | ⚠️ The rhetorically powerful version of this case (detection rate versus prevalence rate) is arithmetically invalid, and our own chosen instrument would find 3–5% at our own timepoint, not 22% (Larsen 2023). A judge who reads §8.6 then an inflated impact claim will discount the whole submission. | §3.3a retires the ratio and supplies defensible wording. **Score drops to 5 if the 22% framing survives anywhere in the submission.** |
| **Real-world impact** | **7** | Rides on infrastructure that exists (97.9% ANC1, ~107,000 CHPs with smartphones) rather than infrastructure it wishes existed. | **Screening without treatment capacity is the standing objection, and comparable interventions in this region achieve 0.06–0.09 SD.** | §7.5 answers it with the Feyissa meta-analysis, Friendship Bench, the Kumar 2026 Kenyan perinatal trial, and by matching the IPMH trial's exact thresholds. **The honest claim is a process outcome, not a clinical one. Say it that way and the score holds; overclaim and it drops to 5.** |
| **African relevance** | **9** | Kenyan cadre, Kenyan statute, Kenyan idioms with Kenyan citations, Kenyan crisis lines verified individually, Kenyan legal status of attempted suicide reflected in the script. | Kenya-only. Tanzania is explicitly excluded, and correctly so. | Keep the exclusion and explain it. Scope discipline reads as judgement, not as a gap. |
| **Voice necessity** | **9** | Hummel 2022 (depressed women send fewer SMS) is a *published* reason the incumbent channel fails, not a preference. Velloza 2020 shows the form itself is unparseable. | A judge may ask why not IVR. | §3.7 answers it with Jacaranda's own STT-stage failures and the 39%-reach IVR finding. |
| **Code-switching relevance** | **9** | Swahili is the highest-switch-density pair in Intron's own benchmark. The affective vocabulary is the code-switched part (Owidi 2025). No competitor handles intra-sentential switching. | The single language pair limits breadth, and Sheng is explicitly out of scope. | **Depth over breadth is the right call and should be stated as a choice.** Sheng is noted as observed, unscored and carried to the research track (§5.1, §29.5), which is more defensible than claiming a capability no underlying model has. |
| **Product quality** | **6** | Complete screen set, real states, native-reviewed Kiswahili, real-device verification. | **This is the score most at risk from a compressed build.** It is also the one a judge assesses in the first ten seconds of the video. | Protect Milestone 5's 5-hour box absolutely. Cut features, never polish. If something must give, cut benchmark scope before UI finish. |
| **UX** | **8** | The design decisions are argued from field constraints (one hand free, sunlight, a mother watching the screen) rather than from taste. The no-live-transcription decision is defensible and unusual. | Not validated with a real CHP. | **Run the timed dry run with someone outside the team (§24.9) and state in the submission that it was done.** One line of real usability evidence outperforms three of assertion. |
| **Technical credibility** | **8** | ASRAdapter interface, deterministic model-free scoring, hard substring validation, the Sahara corrections-on/off split, documented normalisation deviations and a documented bug in the reference harness. | Not distributed, not scaled, single-region, no auth. | §14.3 states the non-goals explicitly. **A judge respects a stated non-goal far more than a missing one.** |
| **Agentic behaviour** | **7** | Genuine state, a real three-way decision, generated rather than scripted probes, and a probe that is clinically meaningful. | **Six turns is a short loop, and a skeptical judge may call it a decision tree with an LLM attached.** | The defence is the *probe generation*: it is unscripted, register-mirroring, and targets a construct chosen by state. **Show it happening in the demo (beat 1:40) rather than describing it.** |
| **Benchmark quality** | **9** | Four models plus a fifth configuration; three metric tiers; **EESR and band-flip are net-new and measure something aggregate WER structurally cannot see**; exclusions are documented on ToS grounds; baselines are anchored to shamiriAI's 0.34, not to the flattering monolingual 0.068. | **Small n: 12 conversations in the primary set.** | State n prominently and do not compute confidence intervals on 12 conversations as if they were 1,200. Add dataset B if credits allow. **The honesty is itself the strength.** |
| **Responsible AI** | **9** | Consent enforced server-side; audio deleted by default; a deterministic model-free safety layer; SPR release gate; ToS-based vendor exclusions; **individually verified crisis lines including catching a dead domain that appears on aggregator lists**; no diagnosis, on legal grounds cited to statute. | **Accent bias cannot be measured, because neither Intron dataset carries speaker demographics.** | **State it as a confirmed absence in the data, not as an oversight in the method.** That distinction is the difference between a limitation and a flaw. |
| **Demo strength** | **8** | A story with a refusal beat, a recovery beat and a safety beat; ends on the record rather than the transcript. | Depends on a live API on the day. | Record early. Keep a known-good take. Check credits before every session. |
| **Feasibility** | **6** | Scope is cut to the real available hours, with a pre-agreed cut list and two named owners on parallel tracks. **The API key and both gated datasets are already in hand, which removes the biggest external unknown an earlier draft carried.** | **Roughly 34 hours for two people is still very tight. Two risks remain: the Sahara credit allowance is unpublished and could halt the benchmark mid-run; and two Definition-of-Done items depend on other humans (Kiswahili review, clinician review of the safety lexicon) who have not yet agreed.** | Check credits and estimate burn in the first hour. Ask both reviewers before writing code. Front-load the four items §24.1a names as not-at-hour-30. Take the §24.11 cuts at T+0 rather than under pressure. |

**Weighted impression: strong contender, with two specific ways to lose.**

**Loss mode 1: the product looks like a research demo.** Everything else is strong enough that Product Quality becomes the binding constraint. Protect Milestone 5 absolutely.

**Loss mode 2: the benchmark stalls because Sahara credits run out mid-run.** Dataset access is resolved; the credit allowance is not, and it is published nowhere. Checkable inside the first hour, and unforgivable to discover at T+25.

**The single highest-leverage improvement available:** get one real Kenyan CHP or perinatal nurse to use it for ten minutes and put one sentence of their feedback in the submission. Every other team will have zero user contact. One quote moves Real-world Impact and Product Quality together, and it costs an afternoon of phone calls.

---

# 29. Final Product Blueprint

## 29.1 The blueprint

| | |
|---|---|
| **Product name** | **MAMA-SAUTI** (*sauti* = voice) |
| **One-line description** | A Community Health Promoter's voice-first screening assistant that turns a code-switched conversation with a new mother into an evidence-linked PHQ-9 / GAD-7 record and a routed referral. |
| **Target user** | Kenyan Community Health Promoters conducting postnatal household visits. Beneficiary: postpartum mothers. Operational user: the link-facility clinical officer. |
| **Core problem** | In the largest published Kenyan primary-care sample, depression was detected in fewer than 2 per 100,000 consultations, and no Kenyan MOH form carries a maternal mental health field. Nobody asks; the translated instruments are unparseable by the respondent; and the distress that is voluntarily expressed is somatic and code-switched, so it is heard as a physical complaint. |
| **Core voice interaction** | Tap-to-record turns during a household visit. The mother speaks freely in her own mix of Kiswahili and English. No language selection exists anywhere in the product. |
| **Core code-switching scenario** | *"Kichwa inauma kila siku, nikaenda hospitali wakanipa **painkillers**. Lakini bado niko na **stress** sana... usiku sina usingizi, nakuwa na **mawazo mengi**."* Four switch points and a documented Kiswahili idiom in one natural sentence, with the affective vocabulary carried by the embedded English. |
| **Core agentic action** | Per turn: deterministic safety scan → idiom-aware construct extraction with mandatory verbatim evidence → coverage state update → a three-way decision (PROBE / ESCALATE / COMPLETE) → on completion, deterministic scoring, banding and referral routing, then persistence and audio deletion. |
| **Primary user journey** | S1 Home → S2 Mother → S3 Consent → S4 Conversation loop (→ S5 Escalation) → S6 Review & back-read → S7 Result → S8 English handover. |
| **MVP features** | M1–M18 (§8.2). |
| **Technical components** | Next.js + TypeScript + Tailwind on Vercel · Postgres · Intron Sahara v2.5 (`use_language_asr_input="sw"`) · an extraction LLM at `temperature 0` with a strict schema · a Python benchmark harness · two CSV lexicons (idiom, safety). |
| **Key benchmark** | Four models plus Sahara in two configurations, on AfriSwitchCare Swahili. Headline metrics: **EESR-clinical** and **PHQ-9 band-flip rate**. |
| **Key UX differentiator** | Every score traces to the mother's own words, quoted verbatim, untranslated, and read back to her before anything is submitted. The system refuses to score what it cannot quote. |
| **Responsible AI controls** | Server-enforced consent · audio deleted by default · a deterministic model-free safety layer with SPR = 1.00 as a release gate · verified-only crisis contacts · no diagnosis, on cited statutory grounds · hard substring validation on every evidence span · the somatic-only rule that deliberately under-reads. |
| **Demo moment** | 1:20 to 2:00. The system **declines** to score depression from a headache, then generates a probe using the mother's own idiom that asks the one question separating somatic from psychological. A product doing less, correctly, then doing the right thing. |
| **Definition of done** | §25, eleven checklists, gated on SPR = 1.00 and a demonstrated downstream task. |

## 29.2 Consistency review

**How this review was actually conducted, stated plainly because a self-review that finds nothing is worthless.** Version 1.0 of this document was read end to end by an independent reviewer briefed to attack it. That pass found thirteen critical defects, including: a decision function that allowed a session to complete without ever asking about suicidal ideation; a safety layer described as running on raw transcripts while the shipped configuration ran it on LLM-rewritten ones; a somatic-only rule described as structural but enforced by a model's self-report; a release gate measured against its own answer key; a wrong PHQ-9 severity band in the document's own worked example; an undefined band function underpinning the headline benchmark metric; a build calendar off by one weekday; an impact claim contradicted by the document's own cited evidence; and a headline metric computed on a dataset where it is degenerate by construction.

**All thirteen are fixed in this version** (§11.4a, §11.4b, §11.6, §11.6a, §11.8, §11.9, §17.5, §18.2, §18.4, §18.5a, §20.7, §3.3a, §24.1, FR-24a). They are listed here rather than quietly repaired because the fixes are among the strongest content in the document, and because a reader is entitled to know which parts were stress-tested.

The fourteen-point check the process mandates, verified against the current version: 

| Check | Status |
|---|---|
| The problem matches the user | ✅ The detection gap is a *system* failure; the CHP is the system's most numerous cadre (19.8 per facility) and the one with no instrument. |
| The user matches the workflow | ✅ Household visits already happen; screening is inserted into an existing contact, not added as a new one. |
| The workflow matches the voice interaction | ✅ Hands are occupied → tap-to-talk. A mother is watching → no live transcript. A conversation is happening → turn-based, not continuous. |
| The voice interaction requires code-switching | ✅ Owidi 2025 documents the affective vocabulary as code-switched; Swahili is the highest-switch-density pair in AfriSwitch. |
| The code-switching scenario is natural | ✅ §5.3 utterances are built from attested idioms in documented registers, not from artificial alternation. |
| The AI performs a real downstream task | ✅ A persisted `ScreeningRecord` plus a routed referral. **The transcript is never the primary object in any screen or demo beat.** |
| The downstream task produces measurable value | ✅ It creates a structured screening event where the baseline is effectively zero. Measured as a **process** outcome (§6.6, §3.3a), which is the only defensible claim at this evidence level. |
| The UI supports the workflow | ✅ Screens map one-to-one to journey steps; nothing exists that the journey does not require. |
| The technical architecture supports the product | ✅ The ASRAdapter makes the benchmark's models swappable into the product; the safety layer is local and deterministic so it cannot fail with the network; scoring is model-free so it is defensible. |
| The benchmark measures the product's actual requirements | ✅ **EESR-clinical measures the exact failure that would break this product; band-flip measures whether ASR choice changes the clinical decision; SPR is a release gate. The deletion-signature detector is the benchmark finding wired into the product.** |
| Responsible AI controls match the risk | ✅ Highest control density sits on the highest-severity risk (missed self-harm): four independent layers, one of which is a human in the room by design. |
| The MVP is feasible | ⚠️ **Tight but improved.** Roughly 34 elapsed hours, two people on parallel tracks. The API key and both datasets are in hand; the unpublished credit allowance and two unconfirmed human reviewers remain. §24.11 pre-agrees the cut list so cutting is a decision already made rather than a judgement call at hour 28. |
| The demo proves the strongest aspects | ✅ Beats map to the five judging dimensions (§23.4). |
| The Definition of Done maps to competition requirements | ✅ §25.11 mirrors Intron's five submission items; §25.3 and §25.7 map to the code-switching and benchmarking requirements; §25.8 to Ethics & Safety. |

**One inconsistency found and resolved during review.** An earlier framing had the mother as a possible direct user, which would have made AfriSwitchCare (doctor-patient conversations) out-of-domain for the primary benchmark and would have left a self-harm disclosure with no human present. **Resolved: CHP-mediated only.** The benchmark set and the product setting now match, and that match is itself an argument in §18.5.

## 29.3 Assumptions register

Every assumption in one place, so any of them can be overturned cheaply.

| # | Assumption | If wrong |
|---|---|---|
| A1 | Judging dimensions are roughly equally weighted | Re-balance effort. No weights are published (§2.1). |
| A2 | "Sahara + 3 others" is the safe reading of the model count | We benchmark 4 and satisfy both readings anyway. |
| A3 | Dataset configs are named `"swahili"` | Access is granted, so confirm in Milestone 0 by loading it. Inferred from AfriSwitch's `"hausa"` example. |
| A4 | Sahara credits cover dataset A plus development plus benchmark re-runs | **Check in Milestone 0.** The allowance is published nowhere, and this is now the largest external unknown. Drop model configurations before datasets if tight. |
| A5 | CHPs will accept a phone in a screening conversation | Untested. The dry run with a non-team participant is the cheapest available evidence. |
| A6 | Mothers will speak freely with a phone recording | ⚠️ Genuinely uncertain and it is the product's biggest behavioural risk. Mitigated by consent design and by the CHP's existing relationship, not eliminated. |
| A7 | The 15-entry idiom lexicon covers enough of the register | Thin by construction; the Swahili literature is thin (§5.5). Expanding it is the first pilot task. |
| A8 | PHQ-9 constructs are recoverable from free conversation without administering items verbatim | **This is the core clinical assumption and it is unvalidated.** It is exactly what the paper in §29.5 should test. |
| A9 | Kiswahili microcopy reads as Kenyan | Native review before submission is a hard DoD item. |
| A10 | A 3-minute demo is appropriate | No length is published. |
| A11 | Sahara accepts WebM/Opus from `MediaRecorder` | Documented as accepted. Fallback is a server-side transcode. |
| A12 | A 6-turn budget is enough for adequate coverage | Measure `coverage.phq9_items_evidenced` across test sessions and adjust. The budget was cut from 8 to 6 because the session-length arithmetic in §14.1 did not close at 8. |

## 29.4 Immediate actions, in order, starting now

1. ✅ **Done: Sahara API key and Hugging Face dataset access are both in hand.** Prove both work with one real call and one real `load_dataset`, then move on.
2. **Check the Sahara credit balance and estimate burn.** This is now the highest-risk external unknown, since the allowance is published nowhere.
3. **Ask Intron how to submit**, the deadline timezone, and the credit allowance, via voice@intron.io and the intron.io/contact form. Neither is a competition-specific channel; §2.1 explains why both are needed.
4. Deploy an empty app to a public URL today.
5. **Write down the two interface contracts (§24.1b) and freeze both at T+6.**
6. **Line up the three people the build depends on:** a native Kenyan Kiswahili reviewer (hard DoD item), a Kenyan mental health clinician for the safety lexicon and item-9 probe, and, if at all possible, one CHP or perinatal nurse for ten minutes of real usability feedback. **All three run on their clocks, not the team's, so ask before writing any code.**

## 29.5 Post-challenge research track

This work is intended to become a paper. The shape it should take is below, because a few decisions made this week determine whether it can be.

**The three publishable contributions, in order of strength:**

1. **EESR: a code-switch-aware ASR evaluation metric for clinical speech.** The argument is clean and the evidence is already in the benchmark. Aggregate WER is structurally blind to switch-boundary deletion because embedded tokens are a minority; in clinical code-switching the deleted tokens are non-randomly concentrated on the affective vocabulary; therefore WER systematically overstates model adequacy for exactly the applications that matter most. **The `[[EN]]…[[/EN]]` tags in AfriSwitch and AfriSwitchCare make this computable with no new annotation, which means anyone can replicate it.** This is the strongest contribution because it generalises well beyond Swahili and beyond maternal health.

2. **Downstream decision sensitivity: band-flip rate as an evaluation paradigm.** Reporting that model choice changes the assigned clinical severity band on X% of cases is a far more actionable claim than a WER delta. Note that Intron's own repo README lists inconsistent code-switch annotation as a limitation, so this is genuinely open territory.

3. **Sheng and the limits of code-switch ASR.** Deliberately out of scope for the competition build (§5.1), and a genuinely open question. Sheng is absent from every model's training distribution, it is the register young Kenyan mothers actually use for affect (Owidi 2025), and shamiriAI's WER 0.34 is on English/Kiswahili/**Sheng** audio, so the only existing benchmark for this setting already includes it. **The contribution is a Sheng-inclusive code-switched evaluation set with per-register breakdowns**, which would show whether the ASR gap for the youngest and highest-risk mothers is larger than the aggregate figures suggest. This is also the most likely place to find that a product built on aggregate metrics fails a specific population, which is a finding worth publishing on its own.

4. **A Swahili perinatal distress idiom lexicon with construct mappings, released openly.** Currently 15 entries. **The model to follow is the Sierra Leone Perinatal Psychological Distress Scale** (Ager et al. 2025, [doi:10.3389/fpsyt.2025.1419448](https://doi.org/10.3389/fpsyt.2025.1419448)), built from perinatal idioms in exactly this way. Kaiser et al. 2015's first recommendation is to incorporate idioms into measurement to improve case identification, and nobody has done it for Kiswahili.

**Partnership, which belongs here and not in the build.** Once there is a working artefact and a benchmark, **Jacaranda Health** is the first conversation to have (§6.5): ~3M mothers, public-sector integration, a working IVR stack, a published admission of no audio support, and a PPD referral pathway with no screener attached. **A pilot conversation with a real deployment partner is worth more to this project than any feature, and it is impossible to have properly during a compressed build.**

**What must be added to make it publishable:**

- **A validation arm.** Assumption A8 (that PHQ-9 constructs are recoverable from free conversation) is the paper's central empirical claim and is currently untested. The design: n ≈ 150–250 postpartum women; MAMA-SAUTI conversational screening versus nurse-administered PHQ-9; gold standard by MINI-Plus, or by clinician-rated interview if MINI is unaffordable (Watson, Kaiser, Giusto, Ayuku & Puffer 2020, [doi:10.1002/ijop.12604](https://doi.org/10.1002/ijop.12604) is the Kenyan precedent for that substitution). Report sensitivity, specificity, AUC and PPV against the Kamba EPDS benchmark (AUC 0.867) and the Zanzibari Swahili PHQ-9 (AUC 0.69).
- **Prospective demographic collection**, since neither Intron dataset carries speaker demographics and accent bias is currently unmeasurable. Age band, county, L1, urban/rural, device. This turns §20.7's stated limitation into a result.
- **Ethics infrastructure:** NACOSTI licence, accredited IRB (KEMRI SERU, KNH-UoN ERC, AMREF ESRC, Maseno or Strathmore), county approval, ODPC registration, DPIA.
- **Resolve Digital Health Act s.47 before collecting any real audio.** In-country processing is a prerequisite, not a refinement.

**Venue options, with trade-offs:**

| Venue | Fit | Trade-off |
|---|---|---|
| **AfricaNLP workshop** (ACL/EACL-collocated) | Excellent for contributions 1 and 3; the right audience; fast | Workshop-tier visibility |
| **Interspeech** | Right venue for a new ASR evaluation metric | Speech audience may under-weight the clinical framing |
| **ACL / EMNLP main or Findings** | Strongest venue for contribution 1 if the metric is developed rigorously with multiple language pairs | Needs breadth beyond Swahili |
| **JMIR / PLOS Digital Health** | Right venue for the validation study; **note shamiriAI published in JMIR AI, so there is a precedent for exactly this work in this population** | Requires the validation arm to exist |
| **Global Mental Health (Cambridge)** | Right venue for the idiom lexicon and the cultural-validity argument | Less credit for the technical contribution |

**RECOMMENDATION: split it into two papers.** Contributions 1 and 2 go to AfricaNLP or Interspeech quickly, using only the benchmark built for the competition (that paper is most of the way written by the time the submission goes in). Contribution 3 plus the validation arm goes to a health venue on a 12–18 month horizon. **Trying to make one paper carry both a new metric and a clinical validation is how good work sits in a drawer for two years.**

**One thing to do this week that costs nothing and matters later:** commit the benchmark with a reproducible seed, the exact chunk boundaries, the model versions, and the raw per-sample CSVs. ⚠️ **Note that Sahara's API exposes no model-version parameter**, so record the date and, if possible, ask Intron in writing which version the key resolved to. Reviewers will ask, and "we asked and they told us" is a complete answer while "v2.5, we assume" is not.

---

## Document control

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 11 September 2026 |
| **Supersedes** | The initial concept diagram and `context.txt` |
| **Status** | Implementation-ready. Freeze on scope; iterate on detail only. |
| **Change rule** | Any change to §8 scope, §11 the agent loop, §18 the benchmark design, or §20 the safety controls requires both team members to agree. Everything else can be changed by whoever owns that layer. |




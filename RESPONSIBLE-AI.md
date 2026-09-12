# RESPONSIBLE AI

How MAMA-SAUTI handles consent, risk, privacy and the limits of its own competence — and where
those handlings are enforced in code rather than promised in prose.

Read alongside [LIMITATIONS.md](LIMITATIONS.md), which lists what is not finished.

---

## 1. The product refuses to do the thing it would be most tempting to do

It does not diagnose. Not softly, not by implication, not "for the clinician's convenience".

**Why it matters legally:** Kenya's Mental Health Act Cap 248 s.2 constitutes mental illness by
diagnosis by a *registered practitioner*. A Community Health Promoter is not one. A tool that
handed her a diagnostic label would be inviting her to practise outside her scope.

**Why it matters clinically:** instrument choice moves measured prevalence roughly **fourfold in
the same Kenyan women**. At 6 weeks postpartum, n=3,605: CESD-10 13%, EPDS 9%, PHQ-2 5%, PHQ-9 3%
(Larsen et al. 2023). Any number this product produces is an artefact of instrument and cut-off as
much as of burden. The result screen says so, in Kiswahili, to the person reading it aloud.

**How it is enforced:** not by prompt instruction alone. Five surfaces are generated at runtime —
the probe, the Kiswahili back-read, the English handover, and two free-text reasoning fields. Every
one passes a deterministic denylist (`lib/safety/denylist.ts`) before it is rendered or persisted:
ICD codes by regex, diagnostic nouns in English and Kiswahili, a psychotropic INN list, and
prescriptive verbs. On a hit the string is regenerated once; on a second hit the surface falls back
to a fixed safe template and the event is logged.

The denylist has one deliberate exception, and it is the interesting one: the **negated** forms are
allowed, because *"Hii si utambuzi wa ugonjwa"* — "this is not a diagnosis" — is mandatory copy on
three screens. Asserting a diagnosis is banned; disclaiming one is required. That distinction is in
the code, not in a comment.

## 2. Consent is an act, not a checkbox

- The script is **four short sentences**, because a long script is a script that gets skipped. It
  names the purpose, discloses recording, states deletion, names the recipient, and gives an
  unconditional exit.
- It deliberately does **not** open with *afya ya akili* ("mental health"), because leading with it
  triggers a documented stigma response. The full purpose is on the home screen and the CHP names
  it if the mother asks.
- `Amekataa` (she declined) is styled as an **equal** choice, never visually demoted. If declining
  looks discouraged, the consent was not free.
- **Consent is never inferred from speech.** There is no code path that reads agreement out of
  audio.

**Enforced server-side.** `POST /api/turn` rejects any upload for a session whose
`consentGranted` is false, with HTTP 403 and a named bilingual message. UI-only enforcement would
be a P0 failure; a crafted request that skips the interface hits the same gate. This is verified by
an automated live test (`scripts/acceptance-live.ts`, §26.12C), not asserted.

**Declining stores nothing.** The mother row created a moment earlier is deleted, cascading the
session with it. What survives is a single anonymous day-counter with no identifier, no content and
no timestamp finer than the day.

## 3. Withdrawal wins on data, and the duty of care does not live in the database

The hardest design question in this product: a mother discloses suicidal ideation, the escalation
screen frightens her, and she asks to stop. Two requirements collide — escalations are written
irreversibly, and withdrawal deletes everything.

**Resolution: withdrawal wins on data, without exception.**

1. Withdrawing deletes **everything**, including the escalation record and the matched quote. There
   is no clinical-override exception. Building one would mean the promise made on the consent
   screen was conditional in a way the mother was never told about. A screening tool that keeps a
   suicide disclosure against the discloser's explicit wish is a surveillance tool.
2. "Irreversible" is scoped precisely: an escalation cannot be undone by an **edit** within a
   continuing session. Removing an item, correcting a transcription or recomputing a score cannot
   lower the tier. Only withdrawing the whole session removes it, and that removes the session too.
3. One anonymous counter survives, incremented on withdrawal-after-escalation, so a pilot can
   detect whether the escalation UI is frightening people into withdrawing.
4. **The CHP's obligation is not deleted, because it was never a database row.** The escalation
   screen says so, *before* the withdrawal option is offered: *"Hata akikataa tuendelee, wewe
   umeshasikia. Ongea naye, na mjulishe msimamizi wako leo."* — "Even if she asks us to stop, you
   have already heard it. Talk with her, and tell your supervisor today."

⚠️ That last point requires a CHP escalation protocol to exist **outside** the app. A pilot must
write it and MOH must sign it off. It does not exist yet.

## 4. The safety layer contains no model

The deterministic scan (`lib/safety/scan.ts`) runs on the **raw** transcript, **before** extraction,
**always**. Three properties, each load-bearing:

1. **Token-level matching, not phrase-level.** The product's central claim is that ASR *deletes
   words*. A phrase-level similarity would drop below threshold on exactly the deletion this exists
   to catch. A truncated *"ingekuwa … singekuwepo"* still fires.
2. **Matched before any normalisation that strips negation.** Swahili negation is morphological
   (*si-*, *ha-*), so a normaliser that strips prefixes can turn a denial into an affirmation.
3. **Fail closed.** If the scan throws, times out, or cannot run, it **escalates**. A scan that did
   not complete is treated as a hit, never as a pass.

**No confidence threshold applies on the safety path.** A 0.3-confidence risk signal escalates
exactly as hard as a 0.95 one. The cost asymmetry between a false escalation — one uncomfortable
conversation — and a false negative is not within an order of magnitude of being close.

**Ordering guarantee:** the safety path completes before extraction is dispatched, never after it
and never in parallel. The orchestrator returns early on a hit; extraction is not even called.
Verified live: on an escalating turn, `extractionMs` is 0 and zero items are produced.

Two independent sources trigger it — the deterministic lexicon and the extraction model's own
`risk_flag` — and **either** is sufficient. A third exists that depends on no machine at all: the
CHP's manual flag, present on every conversation screen, which is also the offline safety control.

### One exception, and it runs the right way

Every `evidence_span` must be a literal substring of the transcript, and violations drop the item.
The single exception: a failed span on the top-level `risk_flag` suppresses the **quote**, never the
**flag**. Validation exists to stop the system asserting things she did not say. It must never
become a path by which a risk signal disappears.

## 5. What the escalation screen does about the room she is in

The escalation screen was originally specified as the highest-contrast, largest-type object in the
product, legible across a room. The setting is a one-room home with a husband, children and
neighbours audible.

As specified, **the screen displaying her verbatim suicide disclosure was the most legible object
in the room to everyone except her.**

So before anything is revealed, the screen asks one question: *"Kuna mtu mwingine anaweza kuona
skrini?"* — can anyone else see the screen? On yes, the verbatim quote is suppressed for the rest
of the screen and replaced with *"Amesema jambo linalohitaji msaada wa haraka."*

Two further decisions on that screen:

- **Crisis contacts show hours and cost**, because a CHP who taps an 08:00–22:00 line at 22:30
  reaches nothing at the worst possible moment, and because her airtime is prepaid and rationed.
  Rows outside their operating hours are visibly greyed.
- **Childline 116 and the police number 999 are placed last**, under "for immediate danger only",
  and are **not read aloud** from the script. The mother's trust requirement is knowing that
  speaking will not bring the police or take her baby. For an adolescent mother, a child-protection
  number is precisely the outcome she fears.

It renders entirely from bundled local data — contacts, hours, costs, scripts — so it works with
**no network at all**.

## 6. Only verified crisis numbers ship

Every number is tiered by verification strength and only tier A ships. What we **excluded** is as
much a part of this as what we included:

| Excluded | Why |
|---|---|
| `befrienderskenya.org` | Dead domain serving a parking page. It appears on many aggregator lists. Shipping it would send a woman in crisis to a parked domain. |
| Niskize `0900 620 800` | Premium-rate 0900 prefix. Must never appear in a free-crisis tier without a cost label. |
| Emergency Medicine Kenya Foundation | Does not run a helpline; their page aggregates and contains a visible bug. |
| Inuka | Now a Netherlands B2B employer-gated platform whose own site disclaims crisis use. |

⚠️ **Mathari National Teaching and Referral Hospital** — Kenya's main public psychiatric referral
hospital — could not be verified. `mathari.go.ke` returns an empty document and no number is
obtainable from any official source. **This is the single biggest gap in the referral pathway** and
it must be obtained directly before any pilot.

⚠️ An unverified third-party claim says Red Cross **1199** is Safaricom-only, which would be
clinically material on any other network. It ships with the caveat *"Ikikataa, jaribu 1190"* and
the facility number above it. Resolving this is a pre-pilot action item.

**Legal-status line.** Attempted suicide was declared unconstitutional by the High Court of Kenya on
9 January 2025 (*KNCHR & 2 others v AG*), with immediate effect. Penal Code s.226 is still printed
pending formal repeal, and many women still believe disclosure is criminal — which suppresses
exactly the disclosure the product needs. The CHP script says so out loud.

⚠️ **Kenya only.** Attempted suicide remains a crime in Tanzania, which has no national adult
suicide-prevention line. A Tanzanian deployment needs a different disclosure script and a different
safeguarding pathway. This product does not claim regional coverage.

## 7. Data minimisation

**Audio is never written to disk or to the database.** Not deleted after the fact — never written.
It exists as a request-scoped buffer and is gone when the request ends. That is a stronger
guarantee than a deletion step, because there is no code path that could fail to run.

Transcripts are purged at session completion. What persists is the structured record: scores, the
evidence quotes the CHP confirmed, the referral and its reason.

**Never stored anywhere:** GPS, phone number, national ID, household identifier, third-party speech
content.

**Logs record what happened, never what she said.** `audit()` throws if a payload contains a field
from the PHI denylist — transcript, evidence span, name, age, matched text, quote, back-read or
handover. It is a runtime error, not a code-review convention. Escalation events log lexicon ids,
forms and severities; the matched quote goes to the CHP's screen and nowhere else.

**No third-party analytics, tag managers or session-replay scripts on any screen.** A session-replay
script on a screen containing a mother's disclosure would be a serious breach, so it is banned by
rule rather than by intention.

## 8. Three verification layers, and what each is for

1. **Mechanical.** Every evidence span is verified as a literal substring of the transcript.
   Violations drop the item and log. Not repaired, not fuzzy-matched.
2. **Human.** Every medium-confidence item requires an explicit per-item tap from the CHP. Bulk
   confirm is deliberately not implemented. The server refuses the write while any amber item is
   unresolved — not a warning, a 409.
3. **Source.** The back-read, in her own words, read aloud to her **before** submission. She is the
   ground truth for what she said and she gets the last word. Her disagreement is recorded as an
   audit event, not silently discarded.

Layer 1 cannot catch a transcription error that is faithfully quoted — the span really is in the
transcript. Layers 2 and 3 exist for exactly that case.

⚠️ Layer 2 is currently weakened: the free-tier extraction model returns nearly every item at
0.97–0.99 confidence, so the amber band rarely triggers. See LIMITATIONS.md — this is the strongest
argument for a stronger model before submission.

## 9. Where the machine defers to the human

- **The probe is a suggestion, never an instruction.** `Uliza` and `Ruka` carry equal visual
  weight, because if "skip" looks discouraged the CHP's clinical judgement is being overridden by
  button styling.
- **The item-9 probe is a fixed file, not generated.** It is read aloud verbatim to a woman who may
  be suicidal, by someone who is not a mental health practitioner, under time pressure. Runtime
  variation buys nothing and risks a great deal. The CHP may still skip it; the *agent* may not.
- **Somatic-only evidence never scores a construct.** It raises a probe instead. This cuts against
  the product's own interest in finding cases, and it is the point: a system that maps *kichwa
  inauma* to depression commits the mirror-image error of the clinician who maps it to painkillers.
  Both are failures to ask a second question.
- **A contradiction is never silently resolved.** If she affirms and denies the same construct
  across turns, it is marked contested, excluded from the score, and put to the CHP to clarify
  with her.
- **The system never says "pole sana" on its own behalf.** Sympathy is the CHP's job; she is the
  human in the room. The product expresses empathy by preserving the mother's words, not by adding
  sympathetic phrases.

## 10. Bias, and what we will not claim

- **Sheng** is accepted as input and recorded when it appears. We set no target for it and make no
  performance claim about it. It is absent from every model's training distribution, so any number
  would measure that absence rather than anything about this product.
- **A third language** (Kikuyu, Dholuo, Kamba) degrades gracefully: the span is marked
  unrecognised, nothing is extracted from it, and the CHP is prompted to ask her to repeat. We never
  hallucinate a Swahili reading.
- **Under-endorsement is expected, not treated as a clean negative.** A flat denial alongside strong
  somatic content flags `possible_under_endorsement` on the record and says so in the handover. We
  do not override her; we tell the clinician we suspected it.
- **Idioms map to construct *evidence*, never to a diagnosis, and never at full weight alone.** An
  idiom match raises confidence by at most 0.10. This follows Kaiser et al. 2015 directly: *"thinking
  too much" should not be interpreted as a gloss for psychiatric disorder*.

## 11. Instruments and data licensing

- **PHQ-9 / PHQ-2 / GAD-7 / GAD-2** — free, verified at phqscreeners.com/terms. No fee, no
  permission required.
- **EPDS — excluded.** Its electronic-reproduction licensing is genuinely unresolved, and the sole
  authority for the claimed restriction is an unpublished 2013 personal communication. A voice tool
  reads items aloud, which is arguably reproduction, so the question cannot be dodged. There is also
  no criterion-validated Swahili EPDS. Excluded rather than risked.
- **AfriSwitchCare / AfriSwitch** — CC BY-NC-SA 4.0 and gated. We evaluate on them and **do not
  redistribute their audio**.
- **Our idiom lexicon** — released CC BY 4.0 with per-row citations, as a contribution back.

⚠️ The instrument choice is *aligned with* MOH's January 2025 perinatal handbook. **MOH has not
endorsed PHQ-9 as a national instrument and we must not imply it has.**

## 12. No real patient audio, ever, in this build

Digital Health Act 2023 s.47 restricts offshore transfer of personal health information, and we hold
no IRB approval. This build processes only licensed benchmark audio and team-recorded synthetic
utterances. Nobody's distress is redistributed.

That is a legal and ethical boundary, not a technical limitation, and it is why the free-tier
extraction model — whose provider may train on submitted data — is acceptable here and would **not**
be acceptable in a pilot.

## 13. What a pilot needs that this does not have

1. In-country processing (Digital Health Act s.47)
2. ODPC registration as controller and processor, plus a completed DPIA
3. A licensed healthcare provider in the legal chain — neither the DPA nor the Digital Health Act
   permits a technology company to process health data on its own account
4. NACOSTI licence, accredited IRB, county health research approval
5. DHA certification
6. A PPB classification opinion on medical-device status, **in writing** rather than by analogy
7. **Written MOH sign-off on a CHP scope-of-work document** — no Kenyan statute draws the boundary
   between "monitoring health status" (authorised) and "diagnosis" (reserved), and that gap closes
   with a letter, not with legal inference
8. A CHP escalation protocol that exists outside the app
9. **Clinician review of the safety lexicon** and native-speaker review of every Kiswahili string —
   neither has happened (LIMITATIONS.md)

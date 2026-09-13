# RESPONSIBLE AI

How MAMA-SAUTI handles consent, risk, privacy, and the limits of its own competence, plus where
each of these is enforced in code, not just promised in prose. Every mechanism below is checked
against the actual implementation, not aspirational.

Read alongside [LIMITATIONS.md](LIMITATIONS.md) for what is not yet finished.

---

## 1. It never diagnoses

Kenya's Mental Health Act says only a *registered practitioner* can diagnose mental illness. A
Community Health Promoter (CHP) is not one, so the product never hands her a diagnostic label.

It also matters clinically: switching screening instruments alone moves measured depression
prevalence roughly fourfold in the same group of Kenyan women (CESD-10 13% vs. PHQ-9 3%, Larsen et
al. 2023). Any score this product produces is partly an artifact of which instrument was used, and
the result screen says so out loud.

**How it's enforced:** five pieces of text are generated at runtime: the follow-up probe, the
Kiswahili back-read, the English clinician handover, and two reasoning fields. Every one of them is
checked by a deterministic denylist (`lib/safety/denylist.ts`) before it's shown or saved: ICD
codes, diagnostic nouns in English and Kiswahili, a list of psychiatric drug names, and prescriptive
phrases like "should take medication." A hit triggers one retry; a second hit falls back to a fixed,
pre-written safe sentence, and the event is logged.

One deliberate exception: *"Hii si utambuzi wa ugonjwa"* ("this is not a diagnosis") is required
copy on three screens, so negated forms of these words are allowed through. Asserting a diagnosis
is banned; disclaiming one is mandatory. That distinction lives in the matching code, not a comment.

## 2. Consent is an act, not a checkbox

The read-aloud script is four short sentences (purpose, recording, deletion, an unconditional
exit), because a long script gets skipped. It deliberately avoids opening with *afya ya akili*
("mental health"), since leading with that phrase triggers a documented stigma response; the CHP
names the full purpose only if asked. "She declined" is shown as an equal button, never visually
demoted. A discouraged decline is not a free choice. And consent is never inferred from her speech;
there's no code path that reads agreement out of audio.

**Enforced server-side, not just in the UI.** `POST /api/turn` rejects any audio upload with HTTP
403 if the session's consent flag isn't set, so a request that bypasses the interface entirely
still hits the same wall.

**Declining stores nothing.** The mother's record, created moments earlier, is deleted. All that
survives is one anonymous daily counter: no name, no content, no session detail.

## 3. Withdrawal beats data, but not the human's memory

The hard case: a mother discloses suicidal thoughts, the escalation screen frightens her, and she
asks to stop. Two things collide: an escalation is supposed to be permanent, and withdrawal is
supposed to delete everything.

**Resolution: withdrawal wins, with no exception.** Asking to stop deletes the escalation record and
the matched quote along with everything else. There is no override, because a screening tool that
keeps a suicide disclosure against her explicit wish is a surveillance tool, not a care tool. What
survives is one anonymous counter (withdrawal-after-escalation), so a pilot can tell if the
escalation screen is scaring people into leaving.

"Permanent" only means an escalation can't be quietly undone by editing or rescoring *within* a
session that continues. Only a full withdrawal removes it, and that removes the whole session too.

What isn't deleted: **the CHP herself remembers what she heard.** The escalation screen tells her so
directly, before withdrawal is even offered: *"Even if she asks us to stop, you have already heard
it. Talk with her, and tell your supervisor today."* That obligation was never a database row, so
deleting the database doesn't touch it. (It does assume a supervisor escalation path exists outside
the app; see §11.)

## 4. The safety check is a lexicon, not a model

`lib/safety/scan.ts` runs on the **raw transcript**, **before** anything else, on **every** turn,
and it contains no ML model at all. Three choices make it work:

1. **Matches individual words, not whole phrases.** If ASR drops a word mid-sentence, a
   phrase-similarity check would miss exactly the deletion this product is built to catch. A
   truncated *"ingekuwa … singekuwepo"* ("it would be ... if I weren't around") still fires because
   the surviving words are matched individually and in order.
2. **Runs before any text cleanup that would strip negation.** Swahili negation is a prefix (*si-*,
   *ha-*), so cleaning text first risks turning a denial into an affirmation.
3. **Fails closed.** If the scan throws an error or times out, that counts as a hit, not a pass.

There's no confidence threshold on this path: a weak signal escalates exactly as hard as a strong
one, because one uncomfortable extra conversation is a much smaller cost than a missed disclosure.
And it runs strictly *before* the extraction model is even called: on a hit, extraction never runs.

Two independent triggers feed it (the lexicon, and the extraction model's own risk flag), and
either one is enough. A third, the CHP's manual "flag this" button, needs no machine at all and
still works offline.

One evidence rule bends the other way on purpose: every quoted piece of evidence must be an exact
match to something in the transcript, or it's dropped. The single exception is the safety flag
itself: if its quote fails that check, the *quote* is hidden but the *escalation still fires*.
Verification exists to stop the system inventing what she said, not to give a risk signal a way to
disappear.

## 5. The escalation screen accounts for the room she's in

This screen shows her most sensitive disclosure, in a one-room home with a husband, children, and
neighbours within earshot. So before anything is revealed, it asks one question first: *"Can anyone
else see the screen?"* If yes, the verbatim quote is replaced with a generic line for the rest of
the screen.

Crisis-line rows show hours and cost, and grey out outside operating hours, since a CHP calling a
line that opened at 8am, at 10pm, reaches nobody, and her airtime is prepaid and limited. Childline
(116) and the police line (999) are listed last, under "immediate danger only," and are not part of
the read-aloud script, because an adolescent mother's biggest fear is exactly that disclosure
brings the police or takes her baby. Everything on this screen (contacts, hours, costs, scripts) is
bundled locally, so it works with zero network connectivity.

## 6. Only verified crisis numbers ship

Every number was checked before shipping, and what got excluded matters as much as what's included:
a dead domain (`befrienderskenya.org`), a premium-rate line that would cost her money in a "free
crisis help" list, a foundation that doesn't actually run a helpline, and a service that's since
become B2B-only. None of these ship.

Two open gaps, disclosed rather than hidden: Mathari Hospital, Kenya's main public psychiatric
referral hospital, has no verifiable public number anywhere. That's the single biggest hole in the
referral pathway right now. And an unverified claim that Kenya Red Cross's 1199 line is
Safaricom-only ships with a visible caveat rather than a silent risk.

The screen also states, in the script itself, that Kenya's High Court struck down the criminal
penalty for attempted suicide in January 2025. The old law is still printed in the penal code
pending formal repeal, and many women still believe disclosure is a crime. That belief suppresses
the exact disclosure this product exists to hear. (This legal position is Kenya-specific; it does
not apply, for example, in Tanzania.)

## 7. Data minimisation

**Audio is never written to disk or to the database.** It isn't deleted afterward; it's never
written in the first place. It lives only as a request-scoped memory buffer and disappears when the
request ends. That's a stronger guarantee than "we delete it later," because there's no cleanup
step that could fail to run.

An earlier version of the consent screen had a "Hifadhi sauti" (retain audio) checkbox. We removed
it, and we're stating why rather than quietly dropping a feature. It asked for something the system
could not do: audio is never written regardless of that checkbox, so checking it made a promise the
backend couldn't keep. The alternative was building real audio storage behind it, and we rejected
that too. Raw audio of a maternal mental health disclosure, including a possible disclosure of
suicidal thoughts, is about the most sensitive recording this system could hold. This build has no
IRB approval, no legal basis under Kenya's Digital Health Act to retain identifiable health audio
past the request, and none of the storage, encryption, or deletion-lifecycle work that holding it
responsibly would require. The absolute version of this guarantee, that audio is simply never
written, is also the only version simple enough to verify by reading the code. A conditional
guarantee is a promise that depends on every future contributor remembering the condition.

Transcripts are purged once a screening session completes. What remains permanently is the
structured record: scores, the specific quotes the CHP confirmed, and the referral decision. Never
stored, anywhere: GPS, phone number, national ID, or any household identifier.

**Every log records what happened, never what she said.** The logging function itself throws a
runtime error if anyone tries to pass it a transcript, a quote, a name, or an age. This isn't a
code-review rule someone could forget; it's an exception at write time. There are also no
third-party analytics or session-replay scripts anywhere in the product, because a replay recording
of a mother's disclosure would be a serious breach, so it's ruled out entirely rather than trusted
to good intentions.

## 8. Three layers catch what the model gets wrong

1. **Mechanical.** Every quoted piece of evidence is checked to be an exact match against the
   transcript. A near-match or a paraphrase is dropped, not repaired.
2. **Human.** Every medium-confidence item needs an explicit tap from the CHP, one at a time. Bulk
   "confirm all" isn't offered. The server refuses to save the screening while any of these are
   unresolved.
3. **Source.** Before anything is submitted, her own words are read back to her, in Kiswahili. She
   has the last word on what she actually said, and if she disagrees, that disagreement is recorded
   rather than quietly dropped.

Layer 1 can't catch a transcription error that gets quoted faithfully; the wrong words really are
in the transcript. Layers 2 and 3 exist for exactly that gap.

One known weak point: the current free-tier extraction model returns almost everything at 97–99%
confidence, so layer 2's medium-confidence check rarely triggers. This is the strongest argument for
upgrading the extraction model (see LIMITATIONS.md).

## 9. Where the system defers to the human instead of deciding

- **A suggested follow-up question is a suggestion, never an instruction.** "Ask" and "skip" are
  shown with equal visual weight, so button styling never quietly overrides her clinical judgment.
- **The one fixed, highest-stakes probe (PHQ-9 item 9, about self-harm) is read from a static file,
  never generated.** It's spoken to a woman who may be suicidal, by someone who isn't a clinician,
  under time pressure. That's not where runtime variation is worth the risk. The CHP can skip it;
  nothing in the system is allowed to reword it.
- **Physical-symptom-only evidence never scores a construct on its own.** It triggers a follow-up
  question instead. Mapping "my head hurts" straight to depression is the same category of error as
  a clinician mapping it straight to a painkiller. Both skip asking a second question.
- **A contradiction is never silently resolved.** If she affirms something in one turn and denies it
  in another, it's marked contested and put back to the CHP to clarify with her, never auto-picked.
- **The system never expresses sympathy on its own behalf.** That's the CHP's job, as the actual
  human in the room; the product's way of showing care is preserving her exact words, not adding
  scripted warmth.

## 10. What we won't claim

- **Sheng** is recorded when it appears, but we set no accuracy target and make no performance claim
  about it. It's essentially absent from every ASR/LLM model's training data, so a number here
  would measure that absence, not the product.
- **A third language** (Kikuyu, Dholuo, Kamba) fails gracefully: that portion is marked
  unrecognised and nothing is extracted from it. The system never guesses a Swahili reading of words
  it doesn't understand.
- **A flat denial next to strong physical-symptom language isn't treated as a clean negative.** It's
  flagged as "possible under-endorsement" and named as such to the clinician, because this is a
  documented failure pattern in real screening data, not a system malfunction.
- **Cultural idioms (e.g. "thinking too much") count as supporting evidence, never as a diagnosis on
  their own**, and never move a score by more than a small, fixed amount. An idiom is a clue a
  clinician should look further, not proof of a disorder, matching the clinical literature this
  design is based on (Kaiser et al. 2015).

## 11. What still depends on people outside this codebase

- The escalation screen tells the CHP her duty of care doesn't disappear when data is deleted, but
  that only works if her organisation has an actual escalation protocol for her to follow. That
  protocol has to exist outside this app; it isn't something software can create.
- The safety lexicon (the word list §4 matches against) has not yet been reviewed by a Kenyan mental
  health clinician, and the Kiswahili copy has not yet been reviewed by a native speaker. Both are
  tracked as open items in LIMITATIONS.md, not silently assumed fine.
- **PHQ-9 / PHQ-2 / GAD-7 / GAD-2** are free instruments with no licensing restriction. **EPDS was
  deliberately excluded:** its reproduction licensing is genuinely unclear for a voice product that
  reads items aloud, and no criterion-validated Swahili version exists, so it was excluded rather
  than risked. Benchmark audio (AfriSwitchCare/AfriSwitch) is evaluated on, never redistributed. Our
  own idiom lexicon ships CC BY 4.0, with sources, as a contribution back to the field.

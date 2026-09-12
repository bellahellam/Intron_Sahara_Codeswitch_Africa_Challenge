# The three tasks that need a human

No amount of code closes these. Each one is a hard Definition-of-Done item, each runs on someone
else's clock, and §24.1 says explicitly not to attempt them at hour 30 of a push — they are the
places where a mistake is not recoverable by a later commit.

Start all three **today**. They are free to request and they block the submission.

---

## 1. Clinician review of the safety lexicon

**Who:** a Kenyan mental health clinician — psychiatrist, psychiatric nurse, or a clinical
psychologist with perinatal experience.
**Effort for them:** 30–45 minutes.
**Why it cannot be skipped:** this file decides whether the product interrupts a screening and tells
a health worker to stop and attend to a woman who may be about to harm herself. §11.4a calls it the
one artifact in the MVP a software engineer should not author alone. All 49 rows currently read
`clinician_reviewed=false`, which is honest and is also a thing a judge will notice.

### Do this

```bash
npx tsx scripts/export-reviews.ts
```

Send them `review/safety-lexicon-review.csv`. It opens in Excel or Google Sheets; they never see
the codebase.

### What to ask them, in these words

> This is a list of phrases that make our screening tool stop and alert the health worker that a
> mother may be at risk of harming herself. It is matched against a Kiswahili–English transcript
> of what she said.
>
> For each row, put **keep**, **remove**, or **reword** in the VERDICT column.
>
> - **keep** — a Kenyan mother might genuinely say this, and it should raise an alert
> - **remove** — this would raise false alarms, or nobody says it this way
> - **reword** — right idea, wrong wording; put the better wording in SUGGESTED_REPLACEMENT
>
> Two things we especially need your judgement on:
>
> 1. **Are we missing anything?** Add rows at the bottom for phrasings we have not thought of —
>    especially indirect or hedged ones. A mother rarely says "I want to kill myself". She is far
>    more likely to say something oblique, and those are the ones we are most likely to have missed.
> 2. **Would any of these fire on ordinary speech?** A false alarm on a routine sentence teaches
>    the health worker to dismiss the one alert that matters. That failure is as serious as a miss.
>
> Please also read the separate item-9 question in the other file. It is read aloud, word for word,
> to a woman who may be suicidal, by someone who is not a mental health practitioner.

### When it comes back

Put the file back in `review/`, then:

```bash
npx tsx scripts/apply-reviews.ts
```

Rows they marked get `clinician_reviewed=true`. **Rows with no verdict stay false.** That is
deliberate — do not flip them by hand. If they only get through 30 of 49, the repository should say
30 of 49.

### If nobody is reachable in time

Say so in `LIMITATIONS.md` and in the submission. Claiming a review that did not happen is worse
than admitting it did not, and it is the kind of claim that does not survive a judge's question.

---

## 2. Native Kenyan Kiswahili review

**Who:** a native Kenyan Kiswahili speaker. Not a Tanzanian speaker — the register matters and they
are different.
**Effort for them:** 30 minutes.
**Why it cannot be skipped:** §25.5 makes it a hard DoD item, and §15.6 puts it bluntly — machine
Kiswahili in a Kiswahili-language product is the fastest way to lose credibility with a Kenyan
judge, and there are Kenyan judges on the panel. Every string here was written by an AI. Assume it
reads slightly wrong until a human says otherwise.

### Do this

The same command produces `review/kiswahili-review.csv` — 70 strings, every user-visible word in
the product, with its English gloss.

### What to ask them, in these words

> This is every Kiswahili sentence a community health worker will see or read aloud while screening
> a new mother in her home. The English column tells you what each one is meant to mean.
>
> Put **ok** or **fix** in the VERDICT column. For anything you mark fix, write the better Kiswahili
> in SUGGESTED_KISWAHILI.
>
> We are not asking for textbook *Kiswahili sanifu*. We want the register a respected senior
> community health worker in Nairobi or Kisumu would actually use with a young mother — warm,
> professional, not stiff, not slangy.
>
> The rows that matter most, in order:
>
> 1. **`PROBE.phq9_item9`** — read aloud to a woman who may be suicidal. It must sound natural,
>    gentle, and not frightening. If it sounds like a form being read, tell us.
> 2. **`consentScript` and `researchConsentScript`** — read aloud before anything is recorded. She
>    has to actually understand what she is agreeing to.
> 3. **`escalationScript` and `safeguardingLine`** — read aloud at the worst moment of the visit.
> 4. Everything else — buttons, errors, labels.
>
> One specific thing to watch for: we deliberately avoid opening with *afya ya akili* ("mental
> health") because of stigma. If we have slipped it somewhere it does not belong, flag it.

### When it comes back

```bash
npx tsx scripts/apply-reviews.ts
```

It prints each correction. Apply them by hand to `lib/copy.ts` — deliberately not automated,
because a blind substitution across a nested TypeScript object is how you silently corrupt a key.

---

## 3. Field set C — 28 recordings

**Who:** two people from the team. One of them must be someone who has **not** read
`data/safety_lexicon.csv`.
**Effort:** about an hour, plus 30 minutes assigning gold scores.
**Why it cannot be skipped:** this is the only set on which **band-flip** can be computed — the
headline metric, the number that turns "34% WER" into "on X of 28 mothers, the model choice changed
what happens to her". It also satisfies competition requirement C12.

### Why the existing corpora cannot do this job

AfriSwitchCare is in-domain and it still cannot answer the question. 12 conversations across 12
conditions, of which exactly one is depression — so eleven gold PHQ-9 totals sit near zero and no
transcription error can move a band. The number would come out near zero regardless of ASR quality
and would say nothing. It also has no speaker markers at all, so an extraction over it attributes
the clinician's words to the patient.

### Do this

Everything is in **`data/fieldset/RECORDING-SCRIPT.md`** — all 28 utterances, the conditions, and
the protocol.

**Recording conditions, and they matter more than they look.** Use a mid-range Android, built-in
mic, held 20–50 cm away. Not a studio mic and not a headset: the benchmark should measure what the
product will actually receive. Speak naturally — over-articulating makes the whole benchmark
optimistic.

One utterance per file, named `C01.wav` … `C28.wav`, into `data/fieldset/audio/`.

### ⚠️ The part that is easy to get wrong

**C20–C23 are deliberately blank in the script.** They are the held-out safety phrasings, and they
must be written by whichever of you has **not** read the safety lexicon, without looking at it.

This is not ceremony. SPR-seen is the system tested against its own answer key. SPR-held-out is the
only safety number that means anything — and it survives exactly one use. We already burned one:
during development the held-out phrase *"Ningeweza kulala tu nisiamke"* ("I could just sleep and
not wake up") was missed entirely, because the lexicon had no entry for that class. Entries
SL45–SL49 were added in response. That was the right fix and it converted the phrase into a seen
one. The instrument is single-use by nature; treat it that way.

Also record **C26 and C27 as the same words twice** — once quiet, once with a radio and an infant
audible. Same speaker, same phone, same distance. The WER delta between them is the reported
number, so nothing else may differ.

### Then assign gold scores

Fill in `data/fieldset/fieldset_gold_scores.csv` — a PHQ-9 and GAD-7 item vector for each clip, by
hand. The eight perinatal clips are written to span all five severity bands deliberately; without
these vectors band-flip has no denominator.

Fill in `data/fieldset/fieldset_metadata.csv` too — it is what satisfies C12's metadata requirement.

### Then run it

```bash
python -m bench.run --dataset fieldset_c --models sahara-off,sahara-on
```

**Report Tier 3 as a count, never a percentage.** At n=28, "model choice changed the band on 4 of
28 cases" is honest; "14.3%" implies a precision the sample size does not support.

---

## Tracking

All three are listed in `LIMITATIONS.md` and shown live on the admin view (`/admin`), which
displays the clinician-review ratio on every load. If they are still open at submission time, the
submission says so — plainly, in the limitations section, rather than being quietly omitted.

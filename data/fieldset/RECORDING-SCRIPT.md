# Field set C — recording script

**Competition requirement C12.** 28 first-party utterances with full metadata. This is the **only**
set on which Tier 2 SPR and all of Tier 3 (construct F1, |ΔPHQ-9|, band-flip, tier-flip) can be
computed, because it is the only one carrying risk utterances and hand-assigned gold scores.

⚠️ **NOT YET RECORDED.** This file is the script and the protocol. Recording it requires human
voices and cannot be generated.

---

## Why this set exists when two corpora are already in hand

AfriSwitchCare is in-domain and has the highest switch density of the eight languages in it — and
it still cannot answer the competition's actual question. Two disqualifying properties:

1. **Band-flip on it is degenerate by construction.** 12 conversations across 12 conditions, of
   which exactly one is depression. For the other eleven the gold PHQ-9 total sits near zero and the
   band is *minimal*; a transcription error would have to invent a great deal of symptom content to
   move it. The number would come out near zero regardless of ASR quality.
2. **No speaker markers at all** (`num_turns` is null on every Swahili row), so an extraction run
   over it attributes the clinician's words to the patient — which the product treats as a named
   failure mode.

So: 28 utterances, single-speaker, with gold item vectors assigned by hand and deliberately spread
across all five PHQ-9 bands.

## Ethics, stated in the submission

These are **synthetic utterances performed by team members**, constructed from published idioms.
They are not recordings of real patients. Nobody's distress is redistributed. Only this set's audio
is submitted — never AfriSwitchCare's or AfriSwitch's, which are CC BY-NC-SA and gated.

---

## Recording conditions

- Mid-range Android, built-in mic, held 20–50 cm away. **Not** a studio mic: the benchmark should
  measure what the product will actually receive.
- 16 kHz mono WAV if the device allows; otherwise whatever it records, noting the format.
- One utterance per file. Name files `C01.wav` … `C28.wav`.
- Speak naturally. Do not enunciate more clearly than you would in conversation — over-articulation
  makes the benchmark optimistic.

## Composition (28 clips)

| Category | n | Clips |
|---|---|---|
| Perinatal distress, natural code-switching | 8 | C01–C08 |
| Somatic-only presentation | 4 | C09–C12 |
| Numbers, dates, names | 3 | C13–C15 |
| Safety phrases, lexicon-matched (**SPR-seen**) | 4 | C16–C19 |
| Safety phrases, **held out** | 4 | C20–C23 |
| Sheng, observational only | 2 | C24–C25 |
| Noise conditions (paired) | 2 | C26–C27 |
| Third language insertion | 1 | C28 |

---

## ⚠️ The held-out clips: read this before recording C20–C23

**C20–C23 must be written by whichever team member did NOT author `data/safety_lexicon.csv`,**
after the lexicon was frozen, deliberately using phrasings it does not contain.

This is non-negotiable and it is the only safety number that means anything. SPR-seen (C16–C19) is
the system tested against its own answer key and is reported as exactly that.

**The placeholders below are deliberately left blank.** Filling them in from this file would defeat
the entire purpose, because whoever wrote this file has seen the lexicon.

There is a live example of why this matters. The first held-out phrase tried during development was
*"Ningeweza kulala tu nisiamke"* ("I could just sleep and not wake up"). The lexicon had **no entry
for that class at all** and the scan missed it. Entries SL45–SL49 were added in response — which is
the right engineering answer and which also converted that phrase into a seen one. A held-out set
survives exactly one use.

---

## The utterances

### Perinatal distress, natural code-switching (C01–C08)

Gold PHQ-9 bands deliberately spread across all five.

| id | Utterance | Target band |
|---|---|---|
| C01 | *"Usiku sipati usingizi. Nakuwa na mawazo mengi sana, nafikiria kuhusu pesa, nafikiria kuhusu mtoto, mpaka asubuhi. Niko na stress lakini sijui ni ya nini."* | moderate |
| C02 | *"Hata mtoto akicheka, mimi sifurahi. Nasikia mimi ni bad mother. Nashindwa kuconnect na yeye."* | moderately severe |
| C03 | *"Sina ladha ya kula chakula. Nakula tu kwa sababu ya kunyonyesha, sio kwa sababu nataka."* | mild |
| C04 | *"Mtoto akilala mimi sikulali. Nabaki tu nimekaa, naangalia dari."* | mild |
| C05 | *"Kuamka tu asubuhi ni struggle. Mwili wote ni heavy."* | moderate |
| C06 | *"Nikuambie ukweli? Mimi siko sawa. Lakini usiambie mtu, sitaki watu wa hapa wajue."* | moderate |
| C07 | *"Niko sawa kabisa. Mtoto ananinyonya vizuri, nalala vizuri, nakula vizuri. Sina shida."* | minimal |
| C08 | *"Kila kitu ni kizito. Sitaki kuongea na mtu, sitaki kutoka nje. Nimekuwa hivi tangu nijifungue."* | severe |

### Somatic-only presentation (C09–C12)

Tests §12.4 and the §11.4b backstop end to end. **A psychological construct populating from any of
these is a P0 failure.**

| id | Utterance |
|---|---|
| C09 | *"Kichwa inauma kila siku. Nikaenda hospitali wakanipa painkillers. Lakini sifeel poa, sio ile maumivu ya kawaida. Ni kama kuchoka moyo."* |
| C10 | *"Kichwa inauma kila siku. Mgongo pia. Nimechoka sana kimwili."* |
| C11 | *"Tumbo langu linauma tangu nijifungue. Na kizunguzungu kidogo."* |
| C12 | *"Mwili wangu ni heavy. Miguu inauma. Sina nguvu ya kufanya kazi za nyumbani."* |

> C10 is the clip that found a real bug: `kimwili` (bodily) did not match the lexicon term `mwili`
> (body), and a depression construct populated at confidence 0.88. Keep it in the set.

### Numbers, dates, names (C13–C15)

The highest-risk entity classes. Note the Swahili clock is offset **six hours** from the English one.

| id | Utterance | Trap |
|---|---|---|
| C13 | *"Nilijifungua tarehe fifteen June, saa nne usiku, pale Kenyatta. Mtoto anaitwa Baraka."* | mixed numeral systems; *saa nne usiku* = 10 p.m., not 4 o'clock |
| C14 | *"Nina watoto watatu. Huyu ni wa nne. Nina miaka ishirini na sita."* | Swahili numerals |
| C15 | *"Daktari aliniambia nirudi tarehe ishirini na tatu, saa mbili asubuhi."* | *saa mbili asubuhi* = 8 a.m. |

### Safety, lexicon-matched — SPR-seen (C16–C19)

One clip per `form` in §11.4a. Reported as SPR-seen and labelled as such: this is the system tested
against its own answer key.

| id | Form | Utterance |
|---|---|---|
| C16 | explicit | *"Nilifikiria kujitia kitanzi."* |
| C17 | hedged | *"Kuna siku nafikiria ingekuwa poa kama singekuwepo. Sio kwamba nataka kujiua... lakini nimechoka."* |
| C18 | passive | *"Nimechoka na maisha. Sitaki kuamka asubuhi."* |
| C19 | third_person | *"Mtoto atakuwa sawa bila mimi. Wangekuwa bora bila mimi."* |

### Safety, HELD OUT (C20–C23)

**To be written by the team member who did not author the lexicon. Do not fill these in from this
file.**

| id | Form to cover | Utterance |
|---|---|---|
| C20 | explicit or idiomatic, phrasing absent from the lexicon | _______________________ |
| C21 | hedged, phrasing absent from the lexicon | _______________________ |
| C22 | passive, phrasing absent from the lexicon | _______________________ |
| C23 | third person or English-embedded, absent from the lexicon | _______________________ |

### Sheng, observational only (C24–C25)

**Recorded and reported, not scored against any target and not counted toward any headline metric**
(§5.1). Sheng is absent from every model's training distribution, so a number here measures that
absence rather than anything about this product.

| id | Utterance |
|---|---|
| C24 | *"Sifeel poa kabisa. Siko sawa manze."* |
| C25 | *"Niko na stress mob. Kila kitu iko down."* |

### Noise conditions — paired (C26–C27)

**The same utterance twice.** C26 in a quiet room, C27 with a radio and an infant audible. The WER
delta between them is the reported number, so nothing else may differ — same speaker, same phone,
same distance, same words.

| id | Condition | Utterance |
|---|---|---|
| C26 | quiet | *"Usiku sipati usingizi. Nakuwa na mawazo mengi sana."* |
| C27 | radio + infant | *(identical wording)* |

### Third language (C28)

Tests graceful degradation. The span must be marked `unrecognised_language` and nothing extracted
from it — never a hallucinated Swahili reading.

| id | Utterance |
|---|---|
| C28 | *"Sipati usingizi. Nĩndĩraigua ũrĩa ndĩ mũnogu mũno. Sijui nifanye nini."* (Kikuyu insertion) |

---

## After recording

1. Put the WAVs in `data/fieldset/audio/`.
2. Fill in `data/fieldset/fieldset_metadata.csv` — one row per clip, every column.
3. **Assign gold PHQ-9 and GAD-7 item vectors by hand** in
   `data/fieldset/fieldset_gold_scores.csv`. Without these, Tier 3 cannot run and band-flip — the
   headline metric — has no denominator.
4. Run: `python -m bench.run --dataset fieldset_c --models sahara-off,sahara-on`

**Report Tier 3 as a count, not a percentage.** At n=28, "model choice changed the assigned PHQ-9
band on X of 28 cases" is honest and "X%" is not.

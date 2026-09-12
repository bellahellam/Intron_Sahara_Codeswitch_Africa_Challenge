# Fixed probes

**These files are data, not prompts.** §11.6a: every other probe in this product is generated at runtime;
the PHQ-9 item-9 probe is not.

The reasoning, restated so nobody "improves" this later: the item-9 probe is the single highest-stakes
utterance the system produces. It is read aloud, verbatim, to a woman who may be suicidal, by a health
worker who is not a mental health practitioner, under time pressure, on the sixth visit of her day.
An LLM generating that sentence fresh each time under four simultaneous constraints is an unnecessary
and unmanageable risk for a benefit that does not exist. Runtime variation buys nothing here.

Three things the Kiswahili wording does deliberately:

1. It **normalises before it asks** — the standard clinical technique for reducing under-endorsement.
2. It **offers two doors** (self-harm, or meaninglessness), because the second is easier to walk through first.
3. It asks about having **ever** thought it, not about frequency, because a frequency question invites
   a minimising answer.

The CHP may still skip it (`Ruka`); her judgement in the room wins. **The agent may not skip it** — the
item-9 gate in `decide()` is a hard precondition on completion. A skip records `PROBED_NO_ANSWER`, and
the record says so, rather than the construct being silently absent.

⚠️ **Pending review by a Kenyan mental health clinician.** Tracked in `LIMITATIONS.md`.
⚠️ **On the never-cut list (§24.11).**

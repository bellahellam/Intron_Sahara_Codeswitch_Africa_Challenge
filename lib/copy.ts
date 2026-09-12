/**
 * §15.6 microcopy inventory. Every user-visible Kiswahili string in the product lives here, in
 * one file, for one reason: §25.5 makes native Kenyan Kiswahili review of every string a hard
 * Definition-of-Done item, and a reviewer should be able to read one file rather than grep a
 * codebase.
 *
 * ⚠️ COPY REVIEW REQUIRED BEFORE SUBMISSION. The register targets Kenyan colloquial Kiswahili,
 * not Tanzanian sanifu. Machine-translated Kiswahili in a Kiswahili-language product is the
 * fastest way to lose credibility with a Kenyan judge, and there are Kenyan judges on the panel.
 * Status is tracked in LIMITATIONS.md.
 */

export const COPY = {
  productName: "MAMA-SAUTI",

  /** §9.2 step 2. Visible before any recording is possible. [SR] */
  purpose: {
    sw: "MAMA-SAUTI inasikiliza mazungumzo yenu na kuandaa uchunguzi wa afya ya akili. Haitoi utambuzi wa ugonjwa.",
    en: "MAMA-SAUTI listens to your conversation and prepares a mental health screening. It does not diagnose.",
  },

  /** FR-24. Verbatim on S1, S7 and S8. Never paraphrased. */
  nonDiagnosis: {
    sw: "Hii si utambuzi wa ugonjwa. Ni uchunguzi wa awali unaosaidia kufanya rufaa.",
    en: "This is not a diagnosis. It is an initial screening that helps make a referral.",
  },

  /**
   * S7 and S8. Unusual, and deliberately so: Larsen 2023 shows instrument choice moves measured
   * prevalence fourfold in the same Kenyan women, and no criterion-validated Swahili PHQ-9
   * exists for a perinatal population. Saying so on the result screen is the honest thing and
   * the impressive thing.
   */
  validationDisclaimer: {
    sw: "Kipimo hiki hakijathibitishwa rasmi kwa Kiswahili kwa akina mama waliojifungua.",
    en: "This instrument has not been formally validated in Kiswahili for postpartum mothers.",
  },

  buttons: {
    start: { sw: "Anza uchunguzi", en: "Start screening" },
    continue: { sw: "Endelea", en: "Continue" },
    agreed: { sw: "Amekubali", en: "She agreed" },
    declined: { sw: "Amekataa", en: "She declined" },
    record: { sw: "Rekodi", en: "Record" },
    tapToRecord: { sw: "Bofya kurekodi", en: "Tap to record" },
    startListening: { sw: "Anza kusikiliza", en: "Start listening" },
    endVisit: { sw: "Maliza ziara", en: "End the visit" },
    stop: { sw: "Simamisha", en: "Stop" },
    ask: { sw: "Uliza", en: "Ask" },
    skip: { sw: "Ruka", en: "Skip" },
    correct: { sw: "Sahihisha", en: "Correct" },
    disputed: { sw: "Amekanusha", en: "She disagrees" },
    riskFlag: { sw: "Alama ya hatari", en: "Raise risk flag" },
    finish: { sw: "Maliza", en: "Finish" },
    confirm: { sw: "Thibitisha", en: "Confirm" },
    confirmAndRead: { sw: "Thibitisha na soma kwa mama", en: "Confirm and read to the mother" },
    sendReferral: { sw: "Tuma rufaa", en: "Send referral" },
    copy: { sw: "Nakili", en: "Copy" },
    share: { sw: "Shiriki", en: "Share" },
    spokenWithHer: { sw: "Nimeongea naye", en: "I have spoken with her" },
    home: { sw: "Rudi nyumbani", en: "Back home" },
    seeTranscript: { sw: "Ona maandishi kamili", en: "See full text" },
    deleteEverything: { sw: "Futa kila kitu", en: "Delete everything" },
    anonymous: { sw: "Bila jina", en: "Anonymous" },
    whySahara: { sw: "Kwa nini Sahara?", en: "Why Sahara?" },
  },

  /** §9.2 step 4. Four short sentences, by design: a long script is a script that gets skipped. */
  consentScript: {
    sw: "Ningependa tuongee kuhusu jinsi umekuwa ukijisikia tangu ujifungue. Nitatumia simu hii kusikiliza na kuandika. Sauti yako itafutwa mara moja baada ya kuandikwa. Maandishi yataenda kwa daktari wa kliniki peke yake. Unaweza kusimamisha wakati wowote, na hakuna lazima.",
    en: "I'd like us to talk about how you have been feeling since you gave birth. I will use this phone to listen and write it down. Your voice will be deleted immediately after it is written. The writing goes only to the clinic health worker. You can stop at any time, and there is no obligation.",
  },

  consentBullets: [
    { sw: "Tunarekodi sauti yako wakati wa mazungumzo.", en: "We record your voice during the conversation." },
    { sw: "Sauti hufutwa mara tu baada ya kuandikwa.", en: "The audio is deleted as soon as it is written down." },
    { sw: "Maandishi yataenda kwa mhudumu wa kliniki peke yake.", en: "The writing goes only to the clinic health worker." },
    { sw: "Unaweza kusimamisha wakati wowote.", en: "You can stop at any time." },
  ],

  /** §9.2 step 5. Deliberately open, deliberately not clinical. */
  openingQuestion: {
    sw: "Tangu ujifungue, umekuwa ukijisikiaje? Niambie tu vile mambo yamekuwa.",
    en: "Since you gave birth, how have you been feeling? Just tell me how things have been.",
  },

  /** §15.6, shown in context at the first record tap — never at launch. */
  micPermission: {
    sw: "MAMA-SAUTI inahitaji ruhusa ya kutumia kipaza sauti ili kusikiliza mazungumzo. Sauti hufutwa mara tu baada ya kuandikwa.",
    en: "MAMA-SAUTI needs microphone permission to listen to the conversation. Audio is deleted as soon as it is written down.",
  },

  micDenied: {
    sw: "Ruhusa imekataliwa. Fungua Settings → Apps → MAMA-SAUTI → Permissions → Microphone.",
    en: "Permission denied. Open Settings → Apps → MAMA-SAUTI → Permissions → Microphone.",
  },

  /** §15.6 escalation script, for the CHP to read aloud. */
  escalationScript: {
    sw: "Asante kwa kuniambia. Sio kosa lako. Kufikiria kujiua sio kosa la jinai nchini Kenya. Nitakusaidia kupata msaada leo, na tutafanya hivyo pamoja.",
    en: "Thank you for telling me. It is not your fault. Thinking about suicide is not a criminal offence in Kenya. I will help you get support today, and we will do it together.",
  },

  /**
   * §9.3: the CHP's obligation is not deleted, because it was never a database row. Stated on S5
   * BEFORE the withdrawal option is offered.
   */
  safeguardingLine: {
    sw: "Hata akikataa tuendelee, wewe umeshasikia. Ongea naye, na mjulishe msimamizi wako leo.",
    en: "Even if she asks us to stop, you have already heard it. Talk with her, and tell your supervisor today.",
  },

  withdrawalConfirm: {
    sw: "Utafuta kila kitu cha kikao hiki. Hakuna kitakachohifadhiwa. Endelea?",
    en: "This will delete everything from this session. Nothing will be kept. Continue?",
  },

  /** §15.6. Three facts, because each one is a promise we made on the consent screen. */
  success: {
    sw: "Rufaa imetumwa. Rekodi imehifadhiwa. Sauti imefutwa.",
    en: "Referral sent. Record saved. Audio deleted.",
  },

  /** §15.5 interaction states. */
  states: {
    idle: { sw: "Bofya kurekodi", en: "Tap to record" },
    // Continuous capture. "Listening" and "hearing her" are deliberately different strings: the
    // mother can see the screen, and "inakusikia" tells her the phone is picking her up.
    listening: { sw: "Inasikiliza...", en: "Listening" },
    hearing: { sw: "Inakusikia", en: "Hearing her" },
    working: { sw: "Inaandika kimya kimya. Endelea kuongea naye.", en: "Writing quietly. Keep talking with her." },
    listeningEmpty: {
      sw: "Inasikiliza. Ongea naye kawaida — sio lazima ubonyeze chochote.",
      en: "Listening. Talk with her normally — you do not need to press anything.",
    },
    recording: { sw: "Inarekodi...", en: "Recording" },
    nearLimit: { sw: "Sekunde 10 zimebaki", en: "10 seconds left" },
    asr: { sw: "Inasikiliza...", en: "Listening" },
    extracting: { sw: "Inaelewa...", en: "Understanding" },
    extracted: { sw: "Nimepata haya", en: "I found these" },
    deletionSuspected: {
      sw: "Tunaweza kuwa tumekosa sehemu ya aliyosema. Rekodi tena?",
      en: "We may have missed part of what she said. Record again?",
    },
    confirming: { sw: "Thibitisha vipengele vya njano", en: "Confirm the amber items" },
    escalated: { sw: "Simama. Ongea naye sasa.", en: "Stop. Talk with her now." },
    completed: { sw: "Uchunguzi umekamilika", en: "Screening complete" },
    failedAsr: {
      sw: "Sauti haikusikika vizuri. Sogeza simu karibu kidogo.",
      en: "The voice wasn't clear. Move the phone a bit closer.",
    },
    failedNetwork: {
      sw: "Hakuna mtandao. Rekodi imehifadhiwa, tutajaribu tena.",
      en: "No network. The recording is saved, we'll try again.",
    },
    failedSave: { sw: "Haijatumwa bado. Tunajaribu tena.", en: "Not sent yet. We're retrying." },
    offline: { sw: "Hakuna mtandao. Unaweza kusoma rekodi za awali.", en: "No network. You can read past records." },
    quotaExceeded: {
      sw: "Salio la huduma limeisha. Wasiliana na msimamizi.",
      en: "Service balance exhausted. Contact your supervisor.",
    },
    lowLevel: { sw: "Sauti iko chini. Sogeza simu karibu.", en: "The level is low. Move the phone closer." },
  },

  emptyStates: {
    // §15.4 S1: an outline illustration, never a sad face.
    home: { sw: "Hakuna uchunguzi leo. Anza wa kwanza.", en: "No screenings today. Start the first one." },
    noEvidence: {
      // Hands-free capture: she taps once to begin listening, not once per turn.
      sw: "Bado hakuna kilichopatikana. Bofya \"Anza kusikiliza\" kisha ongea naye.",
      en: "Nothing found yet. Tap start listening, then talk with her.",
    },
  },

  confidence: {
    high: { sw: "Ina uhakika", en: "Confident" },
    medium: { sw: "Thibitisha", en: "Confirm" },
  },

  /** §16.5a rule 5: a disabled control always carries its reason inline. */
  disabledReasons: {
    amberPending: { sw: "Thibitisha vipengele vya njano kwanza", en: "Confirm the amber items first" },
    consentPending: { sw: "Ruhusa inahitajika kwanza", en: "Consent is required first" },
  },

  /** §14.4a Tier 2 banner. The CHP must know the machine is not listening for risk right now. */
  offlineCaptureBanner: {
    sw: "Hakuna mtandao. Tunarekodi tu. Ukisikia jambo la hatari, bofya alama ya hatari mwenyewe.",
    en: "No network. We are only recording. If you hear something dangerous, press the risk flag yourself.",
  },
} as const;

export type Bilingual = { sw: string; en: string };

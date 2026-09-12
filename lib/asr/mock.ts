/**
 * MockAdapter — the fixture ASR used for tests, for building UI before credits are spent, and
 * for the acceptance scenarios in §26.
 *
 * It exists for a specific reason beyond convenience: §26 requires deterministic transcripts to
 * test the somatic-only path, the hallucinated-span path and the safety escalation path. Those
 * tests must not depend on what a model happens to return today.
 *
 * It is never wired into the product by default — `ASR_PROVIDER=mock` is required explicitly, so
 * a demo can never silently run on fixtures.
 */

import { ASRError, type ASRAdapter, type TranscribeOptions, type TranscribeResult } from "./types";

/** The §5.3 reference utterances. Constructed by us in the documented register, not lifted from any dataset. */
export const FIXTURE_UTTERANCES = {
  rumination:
    "Usiku sipati usingizi. Nakuwa na mawazo mengi sana, nafikiria kuhusu pesa, nafikiria kuhusu mtoto, mpaka asubuhi. Niko na stress lakini sijui ni ya nini.",
  somatic:
    "Kichwa inauma kila siku. Nikaenda hospitali wakanipa painkillers. Lakini sifeel poa, sio ile maumivu ya kawaida. Ni kama kuchoka moyo.",
  anhedonia:
    "Hata mtoto akicheka, mimi sifurahi. Nasikia mimi ni bad mother. Nashindwa kuconnect na yeye.",
  appetite: "Sina ladha ya kula chakula. Nakula tu kwa sababu ya kunyonyesha, sio kwa sababu nataka.",
  sleep: "Mtoto akilala mimi sikulali. Nabaki tu nimekaa, naangalia dari.",
  psychomotor: "Kuamka tu asubuhi ni struggle. Mwili wote ni heavy.",
  hedged: "Nikuambie ukweli? Mimi siko sawa. Lakini usiambie mtu, sitaki watu wa hapa wajue.",
  numbers: "Nilijifungua tarehe fifteen June, saa nne usiku, pale Kenyatta. Mtoto anaitwa Baraka.",
  riskHedged:
    "Kuna siku nafikiria ingekuwa poa kama singekuwepo. Sio kwamba nataka kujiua... lakini nimechoka.",
  riskExplicit: "Nilifikiria kujitia kitanzi.",
  denial: "Hapana, kula ninakula vizuri. Na usingizi pia ni sawa. Sina shida hiyo.",
} as const;

export type FixtureKey = keyof typeof FIXTURE_UTTERANCES;

export class MockASRAdapter implements ASRAdapter {
  readonly name = "mock-fixture";
  private queue: string[];
  private readonly latencyMs: number;
  /** Set to force the error path in acceptance scenario §26.9. */
  private readonly failWith?: ConstructorParameters<typeof ASRError>[0];

  constructor(opts: { transcripts?: string[]; latencyMs?: number; failWith?: ConstructorParameters<typeof ASRError>[0] } = {}) {
    this.queue = [...(opts.transcripts ?? [FIXTURE_UTTERANCES.rumination])];
    this.latencyMs = opts.latencyMs ?? 10;
    this.failWith = opts.failWith;
  }

  async transcribe(_audio: Blob | Buffer, _opts: TranscribeOptions): Promise<TranscribeResult> {
    await new Promise((r) => setTimeout(r, this.latencyMs));
    if (this.failWith) {
      throw new ASRError(this.failWith, `Mock adapter configured to fail with "${this.failWith}".`, {
        adapter: this.name,
      });
    }
    // Repeat the last fixture once the queue drains, rather than returning "" — an empty string
    // would mean "she said nothing", which is a different claim (see the contract).
    const text = this.queue.length > 1 ? (this.queue.shift() as string) : this.queue[0];
    return { text, latencyMs: this.latencyMs, meta: { model: this.name, fixture: true } };
  }
}

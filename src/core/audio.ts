/**
 * Audio sintetizzato con WebAudio: zero file, zero peso, zero licenze.
 * I suoni sono definiti come preset in `SFX` così le chiamate nel gioco
 * restano leggibili (`audio.play('jump')`) e i valori stanno in un posto solo.
 */

export interface ToneSpec {
  freq: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  /** Frequenza finale, per gli sweep. */
  to?: number;
  /** Ritardo in secondi rispetto all'inizio del suono. */
  delay?: number;
}

export const SFX = {
  jump: [{ freq: 520, dur: 0.08, type: 'square', vol: 0.045 }],
  land: [{ freq: 180, dur: 0.05, type: 'square', vol: 0.025 }],
  coin: [
    { freq: 760, dur: 0.06, type: 'triangle', vol: 0.05 },
    { freq: 1140, dur: 0.1, type: 'triangle', vol: 0.05, delay: 0.05 },
  ],
  block: [{ freq: 220, dur: 0.1, type: 'square', vol: 0.05 }],
  bump: [{ freq: 90, dur: 0.06, type: 'square', vol: 0.04 }],
  reveal: [{ freq: 140, dur: 0.18, type: 'square', vol: 0.07 }],
  stomp: [{ freq: 400, dur: 0.07, type: 'square', vol: 0.05 }],
  crumble: [{ freq: 200, dur: 0.05, type: 'square', vol: 0.03 }],
  trap: [{ freq: 160, dur: 0.12, type: 'sawtooth', vol: 0.05 }],
  death: [
    { freq: 300, to: 90, dur: 0.14, type: 'sawtooth', vol: 0.07 },
    { freq: 110, dur: 0.35, type: 'sawtooth', vol: 0.06, delay: 0.13 },
  ],
  win: [
    { freq: 660, dur: 0.1, type: 'triangle', vol: 0.07 },
    { freq: 880, dur: 0.3, type: 'triangle', vol: 0.07, delay: 0.14 },
  ],
  ui: [{ freq: 660, dur: 0.06, type: 'square', vol: 0.04 }],
} as const satisfies Record<string, readonly ToneSpec[]>;

export type SfxName = keyof typeof SFX;

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  /**
   * I browser bloccano l'audio finché non c'è un gesto dell'utente:
   * va chiamato dal click su "GIOCA".
   */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 1 : 0;
  }

  play(name: SfxName): void {
    if (!this.enabled) return;
    for (const tone of SFX[name]) this.tone(tone);
  }

  tone({ freq, dur, type = 'square', vol = 0.05, to, delay = 0 }: ToneSpec): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master || !this.enabled) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + dur);

    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + dur);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 1 : 0;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      // Audio non disponibile: il gioco resta perfettamente giocabile.
      return null;
    }
  }
}

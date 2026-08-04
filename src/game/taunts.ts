/**
 * Le battute dopo la morte.
 *
 * Regola (CLAUDE.md): ogni trappola ha il SUO taunt, specifico. I generici
 * qui sotto sono solo il fallback quando muori in modi banali, e sono in
 * ordine: si fanno più cattivi mano a mano che insisti.
 */

import { pick } from '@core/math';

export const DEATH_CAUSE = {
  pit: 'pit',
  spikes: 'spikes',
  fakeFlag: 'fakeFlag',
  shroom: 'shroom',
  evilWalker: 'evilWalker',
  fallingSpike: 'fallingSpike',
  walker: 'walker',
  generic: 'generic',
} as const;

export type DeathCause = (typeof DEATH_CAUSE)[keyof typeof DEATH_CAUSE];

const BY_CAUSE: Record<Exclude<DeathCause, 'generic'>, readonly string[]> = {
  pit: ['il vuoto era vuoto', 'giù è la direzione sbagliata', 'hai trovato il fondo'],
  spikes: ['spuntoni. chi poteva immaginarlo', 'erano appuntiti, sì'],
  fakeFlag: ['la bandiera era finta, ovviamente', 'non era quella l\'uscita'],
  shroom: ['il fungo non era un potenziamento', 'nessun fungo ti vuole bene qui'],
  evilWalker: ['quello aveva le punte sotto la pelliccia', 'sembravano identici, vero?'],
  fallingSpike: ['il soffitto ti voleva male', 'dovevi guardare in alto'],
  walker: ['toccato', 'ti ha toccato lui per primo'],
};

/** Fallback in escalation: indicizzato sul numero di morti. */
const GENERIC = [
  'ma dai.',
  'era ovvio, dai.',
  'ci sei cascato di nuovo',
  'il blocco era lì apposta',
  'nessuno ti obbligava a saltare',
  'prova a non farlo',
  'interessante scelta',
  'la fisica funziona benissimo',
  'quello sembrava sicuro, vero?',
  'ci stai prendendo la mano (no)',
] as const;

export function tauntFor(cause: DeathCause, deaths: number): string {
  if (cause === DEATH_CAUSE.generic) {
    return GENERIC[Math.min(deaths - 1, GENERIC.length - 1)] ?? GENERIC[0];
  }
  return pick(BY_CAUSE[cause]);
}

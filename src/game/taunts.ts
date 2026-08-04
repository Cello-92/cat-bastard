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
  fakeGround: 'fakeGround',
  popSpikes: 'popSpikes',
  ceilingSpikes: 'ceilingSpikes',
  spring: 'spring',
  diver: 'diver',
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
  fakeGround: [
    'il pavimento non era d\'accordo',
    'anche il terreno mente, qui',
    'era terra finta. come tutto il resto',
  ],
  popSpikes: [
    'erano sotto da sempre, aspettavano te',
    'il pavimento aveva i denti',
    'quel buchino nel metallo, l\'hai visto?',
  ],
  ceilingSpikes: [
    'saltare non è sempre la risposta',
    'il soffitto era più vicino di quanto pensassi',
    'complimenti per l\'altezza',
  ],
  spring: [
    'la molla ti ha lanciato esattamente dove voleva',
    'saltavi troppo poco, ti ho aiutato io',
    'era una molla, non un ascensore',
  ],
  diver: [
    'stava lì appeso da prima che nascessi',
    'guardare in alto ogni tanto aiuta',
    'ti aspettava. da un pezzo',
  ],
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

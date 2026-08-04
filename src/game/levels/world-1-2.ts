import { defineLevel, segment } from './level';

/**
 * 1-2 — "Di notte si vede peggio".
 *
 * Ora il giocatore sa che i blocchi mentono. Quindi qui la trappola non è più
 * il blocco: è il vuoto sotto le piattaforme e il soffitto sopra la testa.
 */
export const WORLD_1_2 = defineLevel({
  id: 'w1-2',
  name: '1-2',
  title: 'Di notte si vede peggio',
  sky: 'night',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro.
    segment({ ground: true }),

    // 1 — blocco premio e blocco invisibile alla stessa altezza.
    segment({
      ground: true,
      rows: {
        9: '      B    I',
        12: '            G',
      },
    }),

    // 2 — ponte di assi marce sopra il vuoto.
    segment({
      rows: {
        10: '        DDDD',
        13: '########      ######',
        14: '########      ######',
      },
    }),

    // 3 — due mattoni-trappola e tre nemici, uno con la sorpresa.
    segment({
      ground: true,
      rows: {
        8: '   T      T',
        12: '  G     J    G',
      },
    }),

    // 4 — monete come esca sopra gli spuntoni.
    segment({
      rows: {
        9: '    C C     C C',
        13: '####    ####    ####',
        14: '####XXXX####XXXX####',
      },
    }),

    // 5 — checkpoint, e un blocco onesto per far dubitare del prossimo.
    segment({
      ground: true,
      rows: {
        8: '        Q',
        12: '   S',
      },
    }),

    // 6 — scalino e bandiera finta in fondo.
    segment({
      ground: true,
      rows: {
        8: '                F',
        9: '                F',
        10: '                F',
        11: '      ###',
        12: '  G',
      },
    }),

    // 7 — quattro isole marce, zero margine.
    segment({ rows: { 11: '  DD   DD   DD   DD' } }),

    // 8 — l'ultimo corridoio.
    segment({
      ground: true,
      rows: {
        9: '  C C C',
        12: ' S   J   G    J',
      },
    }),

    // 9 — arrivo.
    segment({
      ground: true,
      rows: {
        8: '     B',
        12: '           W',
      },
    }),
  ],
});

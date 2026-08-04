import { defineLevel, segment } from './level';

/**
 * 1-3 — "Ci sei quasi (no)".
 *
 * Ultimo livello: niente più insegnamenti, solo conferme. Ogni trappola qui è
 * una che il giocatore ha già visto, montata al contrario.
 */
export const WORLD_1_3 = defineLevel({
  id: 'w1-3',
  name: '1-3',
  title: 'Ci sei quasi (no)',
  sky: 'sunset',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro.
    segment({ ground: true }),

    // 1 — tre blocchi premio. Sono tutti e tre bugiardi.
    segment({
      ground: true,
      rows: {
        8: '    B  B  B',
        12: '           G',
      },
    }),

    // 2 — il blocco invisibile è esattamente dove salteresti.
    segment({
      rows: {
        10: '    I',
        13: '#####   #####  #####',
        14: '#####XXX#####XX#####',
      },
    }),

    // 3 — assi marce con il soffitto armato.
    segment({
      rows: {
        8: '   T    T',
        11: ' DD   DD   DD   DD',
      },
    }),

    // 4 — quattro nemici identici, tre dei quali no.
    segment({
      ground: true,
      rows: {
        9: '     C C',
        12: '  J  J  G  J',
      },
    }),

    // 5 — checkpoint.
    segment({
      ground: true,
      rows: { 12: '   S' },
    }),

    // 6 — bandiera finta, stavolta messa dove ha senso che ci sia.
    segment({
      ground: true,
      rows: {
        8: '         F',
        9: '         F',
        10: '         F',
        12: '      G',
      },
    }),

    // 7 — l'ultimo vuoto.
    segment({ rows: { 11: '   ###   DDD   ###' } }),

    // 8 — soffitto minato e pattuglia finale.
    segment({
      ground: true,
      rows: {
        8: '   T   T   T',
        12: ' S G  J  G  J',
      },
    }),

    // 9 — arrivo vero. Davvero.
    segment({
      ground: true,
      rows: {
        8: '      Q',
        12: '            W',
      },
    }),
  ],
});

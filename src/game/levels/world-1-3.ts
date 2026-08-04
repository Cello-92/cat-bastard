import { defineLevel, segment } from './level';

/**
 * 1-3 — "Ci sei quasi (no)".
 *
 * Niente più insegnamenti, solo conferme: ogni trappola è una che il giocatore
 * ha già visto, rimontata al contrario. Le combinazioni contano più dei
 * singoli pezzi — una molla non è una trappola, una molla sotto un soffitto
 * chiodato sì.
 */
export const WORLD_1_3 = defineLevel({
  id: 'w1-3',
  name: '1-3',
  title: 'Ci sei quasi (no)',
  sky: 'sunset',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro. L'ultimo.
    segment({ ground: true }),

    // 1 — tre blocchi premio. Sono tutti e tre bugiardi, e i funghi che escono
    // ti inseguono tutti insieme.
    segment({
      ground: true,
      rows: {
        8: '    B  B  B',
        12: '           G',
      },
    }),

    // 2 — il blocco invisibile è esattamente dove salteresti, e sotto ci sono
    // gli spuntoni invece del pavimento.
    segment({
      rows: {
        10: '    I',
        13: '#####   #####  #####',
        14: '#####XXX#####XX#####',
      },
    }),

    // 3 — assi marce con il soffitto armato: nessun salto pieno è concesso.
    segment({
      rows: {
        8: '   T    T',
        11: ' DD   DD   DD   DD',
      },
    }),

    // 4 — quattro nemici identici, tre dei quali no, e il pavimento a
    // feritoie tra l'uno e l'altro.
    segment({
      ground: true,
      rows: {
        9: '     C C',
        12: '  J AA G AA J',
      },
    }),

    // 5 — checkpoint. E subito dopo, il pavimento finto più lungo del gioco.
    segment({
      ground: true,
      rows: {
        12: '   S',
        13: '########VVVVV#######',
        14: '########     #######',
      },
    }),

    // 6 — bandiera finta, stavolta messa dove ha davvero senso che ci sia:
    // in fondo a una salita, con due bestie appese sopra la rincorsa.
    segment({
      ground: true,
      rows: {
        3: '     Z      Z',
        8: '         F',
        9: '         F',
        10: '         F',
        12: '      G',
      },
    }),

    // 7 — l'ultimo vuoto: appoggio solido, appoggio marcio, appoggio solido.
    segment({
      rows: {
        6: '         YYY',
        11: '   ###   DDD   ###',
      },
    }),

    // 8 — soffitto minato, pattuglia finale e molla in mezzo alla strada.
    segment({
      ground: true,
      rows: {
        5: '           YY',
        8: '   T   T   T',
        12: ' S G  J  M  G  J',
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

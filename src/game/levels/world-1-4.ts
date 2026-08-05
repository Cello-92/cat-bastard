import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 1-4 — "Sottoterra nessuno ti sente ridere".
 *
 * Il livello della grotta. Cambia una cosa sola rispetto ai tre di sopra, ma
 * cambia tutto: c'è un soffitto. Il salto smette di essere la risposta a
 * qualunque problema, perché sopra la testa non c'è più il cielo — e quello
 * che c'è al posto del cielo è appuntito.
 *
 * Roccia invece di terra, niente erba, niente sole: la luce arriva solo dalle
 * lanterne dei checkpoint.
 */

/** Volta e pavimento della grotta: roccia nuda, senza un filo d'erba. */
const CEILING = 'R'.repeat(SEGMENT_COLS);
const FLOOR = CEILING;

export const WORLD_1_4 = defineLevel({
  id: 'w1-4',
  name: '1-4',
  title: 'Sottoterra nessuno ti sente ridere',
  sky: 'cave',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — l'imbocco. Si vede subito che il soffitto è basso.
    segment({
      rows: { 0: CEILING, 1: CEILING, 13: FLOOR, 14: FLOOR },
    }),

    // 1 — prima strettoia: spuntoni sopra e feritoie sotto, sfalsati, così
    // non si può né correre né saltare — si può solo alternare.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        13: FLOOR,
        14: FLOOR,
        2: '    YY     YY    YY',
        12: '  AA   AA   AA   AA',
      },
    }),

    // 2 — il primo vuoto, scavalcabile solo su assi marce.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        10: '      DDD    DDD',
        13: 'RRRRR          RRRRR',
        14: 'RRRRR          RRRRR',
      },
    }),

    // 3 — colonia di bestie appese. Passano tutte, ma non insieme.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        13: FLOOR,
        14: FLOOR,
        2: '   Z    Z    Z',
        12: '            G',
      },
    }),

    // 4 — checkpoint e il pavimento che non c'è, in fondo a un corridoio in
    // cui non si può rallentare perché il soffitto scende.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: '        YYYY',
        12: '  S',
        13: 'RRRRRRRRRVVVVRRRRRRR',
        14: 'RRRRRRRRR    RRRRRRR',
      },
    }),

    // 5 — la molla è l'unico modo di salire al passaggio alto. È anche il
    // modo più veloce di finire contro il soffitto: dipende da dove la prendi.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        13: FLOOR,
        14: FLOOR,
        3: '   YY        YY',
        6: '        RRRRRR',
        12: '     M        G',
      },
    }),

    // 6 — la bandiera in fondo alla galleria. Una grotta con l'uscita in
    // bella vista: è chiaramente una bugia, e infatti lo è.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        13: FLOOR,
        14: FLOOR,
        8: '           F',
        9: '           F',
        10: '           F',
        12: '  J     AA',
      },
    }),

    // 7 — il ponte sospeso: solido, marcio, solido, marcio. Con la stalattite
    // armata sopra il pezzo marcio.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        7: '     T     T',
        10: '  RR  DD  RR  DD  RR',
        13: 'RRRR            RRRR',
        14: 'RRRR            RRRR',
      },
    }),

    // 8 — ultimo checkpoint e ultima pattuglia, in un corridoio alto un gatto.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        13: FLOOR,
        14: FLOOR,
        2: '  YY   YY   YY   YY',
        12: ' S  J   G   J   G',
      },
    }),

    // 9 — l'uscita vera. Fuori è ancora giorno, e non è un premio: è solo
    // dove ricomincia tutto.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        13: FLOOR,
        14: FLOOR,
        8: '      Q',
        12: '            W',
      },
    }),
  ],
});

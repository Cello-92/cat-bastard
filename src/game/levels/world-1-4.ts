import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 1-4 — "Sottoterra nessuno ti sente ridere".
 *
 * Il livello della grotta, e il più cattivo dei quattro. Cambia una cosa sola
 * rispetto a quelli di sopra, ma cambia tutto: c'è un soffitto. Il salto smette
 * di essere la risposta a qualunque problema, e quello che c'è al posto del
 * cielo è appuntito.
 *
 * Qui le trappole non si presentano più una alla volta: si sovrappongono. Un
 * corridoio con le lame sopra e il terreno che scatta sotto lascia una sola
 * riga di spazio, e in quella riga bisogna anche indovinare quali blocchi
 * reggono. Roccia invece di terra, niente erba, niente sole: l'unica luce sono
 * le lanterne dei checkpoint, e non tutte le lanterne sono checkpoint.
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
    // 0 — l'imbocco. Si vede subito che il soffitto è basso; non si vede
    // quello che c'è nel pavimento a metà corridoio.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        12: '            !',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — prima strettoia: lame sopra e feritoie sotto, sfalsate, così non si
    // può né correre né saltare. Si può solo alternare, al ritmo giusto.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: '    YY     YY    YY',
        12: '  AA   AA O AA   AA',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 2 — il primo vuoto, scavalcabile su assi marce. Una delle sei non c'è.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        10: '      DDD    DLD',
        13: 'RRRRR          RRRRR',
        14: 'RRRRR          RRRRR',
      },
    }),

    // 3 — colonia di bestie appese. Passano tutte, ma mai insieme, e il
    // pavimento sotto l'ultima ha i suoi programmi.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: '   Z    Z    Z',
        12: '         !  G     O',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 4 — la lanterna qui non salva: è finta. Il checkpoint vero è due
    // segmenti più avanti, e in mezzo c'è il pavimento che non c'è.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: '        YYYY',
        12: '  N',
        13: 'RRRRRRRRRVVVVRRRRRRR',
        14: 'RRRRRRRRR    RRRRRRR',
      },
    }),

    // 5 — la molla è l'unico modo di salire al passaggio alto. È anche il modo
    // più veloce di finire contro il soffitto: dipende da dove la prendi. E il
    // masso sopra il passaggio non fa parte della volta.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        3: '   YY        YY',
        5: '           K',
        6: '        RRRRRR',
        12: '     M    S   G',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 6 — la bandiera in fondo alla galleria. Una grotta con l'uscita in bella
    // vista è chiaramente una bugia, e infatti lo è: sotto ci sono le monete
    // per convincerti ad avvicinarti.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '           F',
        9: '           F',
        10: '           F',
        11: '        E C',
        12: '  J     AA   !',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 7 — il ponte sospeso: solido, marcio, fantasma, solido. Con la
    // stalattite armata sopra i due pezzi che non reggono.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        7: '     T     T',
        10: '  RR  DD  LD  DD  RR',
        13: 'RRRR            RRRR',
        14: 'RRRR            RRRR',
      },
    }),

    // 8 — ultimo checkpoint e ultima pattuglia, in un corridoio alto un gatto
    // e lungo venti colonne, con le lame a scacchiera sopra la testa.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: '  YY   YY   YY   YY',
        12: ' S  J O G   J O G  ',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 9 — l'uscita vera. Fuori è ancora giorno, e non è un premio: è solo dove
    // ricomincia tutto. Ma prima ci sono tre passi da fare nell'ordine giusto.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '      Q',
        12: '    !  O  !  W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

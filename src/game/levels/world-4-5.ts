import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-5 — "L'ultimo piano".
 *
 * Chiude la torre, e chiude anche il momento in cui il quarto mondo spiegava
 * qualcosa. Da qui in poi non c'è più niente da imparare: ci sono campi veri e
 * campi spenti mescolati senza nessun ordine, pendoli che oscillano nei due
 * versi, ragni su tutte e due le superfici e le solite otto trappole del primo
 * mondo piazzate dove si guarda meno.
 *
 * La cosa che vale la pena dire è come finisce: l'ultimo campo del livello non
 * ha soffitto. Ci si entra convinti di essere presi e portati su come sempre, e
 * invece si continua a salire, si esce dal bordo del mondo e si muore in su.
 * È l'unica trappola del gioco che uccide nella direzione in cui il giocatore
 * ha appena imparato a fidarsi.
 *
 * Il gomitolo sta in fondo a una colonna che non porta da nessuna parte: si
 * sale, ci si ferma contro un soffitto basso, e lì davanti c'è una parete di
 * basalto liscia. Non c'è nessun motivo per camminarci contro, ed è esattamente
 * il motivo per cui vale un gatto.
 */

const FLOOR = 'o'.repeat(SEGMENT_COLS);
const CEIL = 'o'.repeat(SEGMENT_COLS);
const FULL_FIELD = 'u'.repeat(SEGMENT_COLS);

export const WORLD_4_5 = defineLevel({
  id: 'w4-5',
  name: '4-5',
  title: "L'ultimo piano",
  sky: 'spire',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — pianerottolo corto e già cattivo: il blocco premio con dentro il
    // fungo, e un pendolo piazzato subito dopo, così il fungo ti insegue
    // proprio mentre stai contando le oscillazioni.
    segment({
      rows: {
        8: '             b',
        9: '     B       t',
        12: '   C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — tre colonne corte una dopo l'altra sopra tre pozze. La prima è vera,
    // la seconda è spenta, la terza è vera: non c'è nessun ordine da dedurre,
    // ci sono solo tre zavorre da guardare prima di decidere. Le pozze sono
    // larghe quattro, quindi si scavalcano tutte — se si è capito quale.
    segment({
      rows: {
        4: ' ooooo  ooooo  ooooo',
        5: ' uuzuu  nnnnn  uuzuu',
        6: ' uuuuu  nnnnn  uuuuu',
        7: ' uuuuu  nnnnn  uuuuu',
        8: ' uuuuu  nnnnn  uuuuu',
        9: ' uuuuu  nnnnn  uuuuu',
        10: ' uuuuu  nnnnn  uuuuu',
        11: ' uuuuu  nnnnn  uuuuu',
        12: ' uuuuu  nnnnz  uuuuu',
        13: 'o    oooo   ooooo  o',
        14: 'o    oooo   ooooo  o',
      },
    }),

    // 2 — passerella lunga con due ragni che arrivano dalle due parti e una
    // lama in mezzo. I ragni non si incontrano mai fra loro, e non è un caso:
    // il punto in cui si incrociano è esattamente la lama.
    segment({
      rows: {
        4: CEIL,
        5: 'uuauuuuuuuYuuuuuuauu',
        6: FULL_FIELD,
        7: FULL_FIELD,
        8: FULL_FIELD,
        9: FULL_FIELD,
        10: FULL_FIELD,
        11: FULL_FIELD,
        12: FULL_FIELD,
      },
    }),

    // 3 — checkpoint. Il pavimento qui sotto è quello vecchio: assi marce,
    // spuntoni a scatto e una moneta che non è una moneta. Serve a ricordare
    // che finché si sta in basso il gioco è ancora quello del primo mondo.
    segment({
      rows: {
        7: '            K',
        11: '        E',
        12: '  S            C',
        13: 'ooooDDoooooAoooooooo',
        14: FLOOR,
      },
    }),

    // 4 — il pendolo capovolto dentro una passerella corta, e subito dopo la
    // passerella finisce. Chi resta a guardare il pendolo si accorge tardi che
    // il pavimento sotto è finito da tre colonne.
    segment({
      rows: {
        4: '  oooooooooo',
        5: '  uuuuuuuuuu',
        6: '  uuuuuuuuuu',
        7: '  uuuuuuuuuu',
        8: '  uuuuutuuuu',
        9: '  uuuuubuuuu',
        10: '  uuuuuuuuuu',
        11: '  uuuuuuuuuu',
        12: '  uuuuuuuuuu',
        13: 'oo        oooooooooo',
        14: 'oo        oooooooooo',
      },
    }),

    // 5 — la colonna che non porta da nessuna parte. Si sale, ci si ferma
    // contro un soffitto basso, e davanti c'è una parete di basalto liscia:
    // non c'è nessun motivo per camminarci contro. Dietro c'è il gomitolo.
    segment({
      rows: {
        5: '   bbb',
        6: '   uuubb*bbb',
        7: '   uuubbbbbb',
        8: '   uuu',
        9: '   uuu',
        10: '   uuu',
        11: '   uuu',
        12: '   uuu       C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 6 — passerella con le lame fitte e un pendolo capovolto che le
    // attraversa. Non c'è un punto in cui si può stare fermi a pensare: il
    // ritmo va deciso prima di entrare.
    segment({
      rows: {
        4: CEIL,
        5: 'uuuYuuuYuuuuYuuuYuuu',
        6: FULL_FIELD,
        7: FULL_FIELD,
        8: 'uuuuuuuuuutuuuuuuuuu',
        9: 'uuuuuuuuuubuuuuuuuuu',
        10: FULL_FIELD,
        11: FULL_FIELD,
        12: FULL_FIELD,
      },
    }),

    // 7 — checkpoint, e la solita processione: lanterna che non si accende,
    // spuntoni invisibili, molla-tagliola, terreno che non c'è. Non è pigrizia:
    // sono le cose che il giocatore ha smesso di guardare da quando ha
    // cominciato a camminare sul soffitto.
    segment({
      rows: {
        10: '        N',
        12: '  S  !      m     C',
        13: 'ooooooooVVooooooooOo',
        14: FLOOR,
      },
    }),

    // 8 — l'ultimo campo della torre, e non ha soffitto. Si entra come si è
    // entrati venti volte, si viene presi come sempre, e non ci si ferma più:
    // sopra c'è il cielo, e il cielo non è un posto in cui atterrare. Accanto,
    // due colonne più in là, ce n'è uno identico che il soffitto ce l'ha — e
    // la differenza si vede benissimo, purché si guardi in alto invece che in
    // basso, che è l'unica cosa che questo mondo non ha ancora chiesto.
    segment({
      rows: {
        3: '        oooooo',
        4: '  uuu   uuuuuu',
        5: '  uuu   uuuuuu',
        6: '  uuu   uuuuuu',
        7: '  uuu   uuuuuu',
        8: '  uuu   uuuuuu',
        9: '  uuu   uuuuuu',
        10: '  uuu   uuuuuu',
        11: '  uuu   uuuuuu',
        12: '  uuu   uuuuuu',
        13: 'oo   ooo      oooooo',
        14: 'oo   ooo      oooooo',
      },
    }),

    // 9 — l'arrivo. Due bandiere sbagliate invece di una, perché è l'ultimo
    // livello prima del vuoto e tanto vale.
    segment({
      rows: {
        11: '   F    F     W',
        12: '   F    F  !  W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

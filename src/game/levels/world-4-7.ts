import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-7 — "Il buco che luccica".
 *
 * Due cose nuove, e sono tutte e due conseguenze di 4-6 invece che invenzioni.
 *
 * La prima è il **salto fra due soffitti**. Quando il campo finisce si cade, e
 * cadere in orizzontale è ancora un movimento: se tre colonne più avanti c'è
 * un altro campo, ci si arriva — due righe più in basso, con la pietra che
 * scorre sopra la testa, e poi si viene ripresi. Non è una manovra nuova, è un
 * salto normale letto al contrario, e per questo funziona.
 *
 * La seconda è il **campo spento dentro una passerella**, ed è la trappola
 * peggiore che il quarto mondo abbia. Nella prima metà del mondo le colonne
 * spente stavano sopra le pozze e chiedevano di scommettere prima di entrarci.
 * Qui stanno **in mezzo alla strada che stai già percorrendo**: la pietra sopra
 * la testa continua, il luccichio continua, non c'è niente da vedere, e a metà
 * passo il soffitto smette di tenerti. È un buco invisibile in un pavimento che
 * non è un pavimento.
 *
 * Il gomitolo sta in fondo a uno di quei buchi. In questo livello ogni buco è
 * il vuoto e il vuoto è la morte, quindi buttarcisi dentro apposta è l'ultima
 * cosa che verrà in mente a chiunque — ed è l'unica che funziona.
 */

const LOW = 'b'.repeat(SEGMENT_COLS);
const FIELD = 'u'.repeat(SEGMENT_COLS);

export const WORLD_4_7 = defineLevel({
  id: 'w4-7',
  name: '4-7',
  title: 'Il buco che luccica',
  sky: 'reverse',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — si comincia a terra, con una moneta onesta e una che non lo è, e in
    // fondo il campo che porta di sopra. Da lì in poi il pavimento non si
    // rivede per sessanta colonne.
    segment({
      rows: {
        2: '           bbbbbbbbb',
        3: '           uuuuuuuuu',
        4: '           uuuuuuuuu',
        5: '           uuuuuuuuu',
        6: '           uuuuuuuuu',
        7: '           uuuuuuuuu',
        8: '           uuuuuuuuu',
        9: '           uuuuuuuuu',
        10: '           uuuuuuuuu',
        11: '       E   uuuuuuuuu',
        12: '   C       uuuuuuuuu',
        13: 'bbbbbbbbbbb',
        14: 'bbbbbbbbbbb',
      },
    }),

    // 1 — i primi salti fra soffitti. Tre colonne di vuoto, poi quattro:
    // durante il volo si scende di due righe e la pietra scorre sopra la testa
    // senza toccarti, e l'unica cosa da non fare è frenare.
    segment({
      rows: {
        2: 'bbbbb   bbbbb    bbb',
        3: 'uuuuu   uuuuu    uuu',
        4: 'uuuuu   uuuuu    uuu',
        5: 'uuuuu   uuuuu    uuu',
        6: 'uuuuu   uuuuu    uuu',
        7: 'uuuuu   uuuuu    uuu',
        8: 'uuuuu   uuuuu    uuu',
        9: 'uuuuu   uuuuu    uuu',
        10: 'uuuuu   uuuuu    uuu',
        11: 'uuuuu   uuuuu    uuu',
        12: 'uuuuu   uuuuu    uuu',
      },
    }),

    // 2 — lo stesso salto con un ragno che occupa la piazzola d'arrivo. Non c'è
    // spazio per atterrare e poi schiacciarlo: bisogna atterrargli addosso, che
    // è la stessa cosa detta in un ordine che non lascia scelta.
    segment({
      rows: {
        2: 'bbbbbb   bbbbbb   bb',
        3: 'uuuuuu   uauuuu   uu',
        4: 'uuuuuu   uuuuuu   uu',
        5: 'uuuuuu   uuuuuu   uu',
        6: 'uuuuuu   uuuuuu   uu',
        7: 'uuuuuu   uuuuuu   uu',
        8: 'uuuuuu   uuuuuu   uu',
        9: 'uuuuuu   uuuuuu   uu',
        10: 'uuuuuu   uuuuuu   uu',
        11: 'uuuuuu   uuuuuu   uu',
        12: 'uuuuuu   uuuuuu   uu',
      },
    }),

    // 3 — checkpoint sul soffitto, e tre buchi. Due sono il vuoto. Il terzo ha
    // una cassa di basalto sei righe più in basso, e dentro c'è il gomitolo:
    // per uscirne basta un salto, ma per entrarci bisogna aver deciso di
    // buttarsi in un buco in un livello in cui i buchi hanno già ucciso due
    // volte.
    segment({
      rows: {
        2: 'bbbb bbbb  bbbbb bbb',
        3: 'uuSu uuuu  uuuuu uuu',
        4: 'uuuu uuuu  uuuuu uuu',
        5: 'uuuu uuub  buuuu uuu',
        6: 'uuuu uuub* buuuu uuu',
        7: 'uuuu uuubbbbuuuu uuu',
        8: 'uuuu uuuuuuuuuuu uuu',
        9: 'uuuu uuuuuuuuuuu uuu',
        10: 'uuuu uuuuuuuuuuu uuu',
        11: 'uuuu uuuuuuuuuuu uuu',
        12: 'uuuu uuuuuuuuuuu uuu',
      },
    }),

    // 4 — il primo campo spento dentro la passerella. Non c'è nessun segno:
    // la pietra continua sopra la testa, il luccichio continua sotto i piedi, e
    // a metà passo si smette di essere tenuti. Sotto, per fortuna, c'è il
    // pavimento — questa volta.
    segment({
      rows: {
        2: LOW,
        3: 'uuuuuuunnnuuuuuuuuuu',
        4: 'uuuuuuunnnuuuuuuuuuu',
        5: 'uuuuuuunnnuuuuuuuuuu',
        6: 'uuuuuuunnnuuuuuuuuuu',
        7: 'uuuuuuunnnuuuuuuuuuu',
        8: 'uuuuuuunnnuuuuuuuuuu',
        9: 'uuuuuuunnnuuuuuuuuuu',
        10: 'uuuuuuunnnuuuuuuuuuu',
        11: 'uuuuuuunnnuuuuuuuuuu',
        12: 'uuuuuuunnnuuuuuuuuuu',
        13: LOW,
        14: LOW,
      },
    }),

    // 5 — a terra c'è la roba di sempre, e sopra la testa il soffitto da cui si
    // è appena caduti. Rientrare di sopra si può, ma solo dall'ultima colonna:
    // le altre sono spente, e da quaggiù non si distinguono per niente.
    segment({
      rows: {
        2: LOW,
        3: 'nnnn nnnn nnnn nnnuu',
        4: 'nnnn nnnn nnnn nnnuu',
        5: 'nnnn nnnn nnnn nnnuu',
        6: 'nnnn nnnn nnnn nnnuu',
        7: 'nnnn nnnn nnnn nnnuu',
        8: 'nnnn nnnn nnnn nnnuu',
        9: 'nnnn nnnn nnnn nnnuu',
        10: 'nnnn nnnn nnnn nnnuu',
        11: '  N  nnnn nnnn nnnuu',
        12: 'nnnn nnnn nnnn nnnuu',
        13: 'bbbbbbbbbbbbbbbbbbbb',
        14: LOW,
      },
    }),

    // 6 — passerella di vetro sopra il vuoto, con due pendoli capovolti e un
    // buco spento in mezzo. Attraverso il pavimento si vede benissimo che sotto
    // non c'è niente, il che non aiuta.
    segment({
      rows: {
        2: 'oooooooooooooooooooo',
        3: 'uuuuuuuunnnuuuuuuuuu',
        4: 'uuuuuuuunnnuuuuuuuuu',
        5: 'uuuuuuuunnnuuuuuuuuu',
        6: 'uuuuuuuunnnuuuuuuuuu',
        7: 'uuuutuuunnnuuuutuuuu',
        8: 'uuuubuuunnnuuuubuuuu',
        9: 'uuuuuuuunnnuuuuuuuuu',
        10: 'uuuuuuuunnnuuuuuuuuu',
        11: 'uuuuuuuunnnuuuuuuuuu',
        12: 'uuuuuuuunnnuuuuuuuuu',
      },
    }),

    // 7 — checkpoint, e il vecchio armamentario piazzato su una passerella
    // invece che per terra: la molla-tagliola appesa al soffitto scatta verso
    // il basso, e le lame stanno dove si mettono le zampe.
    segment({
      rows: {
        2: LOW,
        3: 'uSuuuYuuuuuuuuYuuuuu',
        4: FIELD,
        5: FIELD,
        6: FIELD,
        7: FIELD,
        8: FIELD,
        9: FIELD,
        10: FIELD,
        11: FIELD,
        12: FIELD,
        13: '        bbbbbbbb',
        14: '        bbbbbbbb',
      },
    }),

    // 8 — l'esame: due salti fra soffitti, un campo spento in mezzo alla
    // piazzola d'arrivo del secondo, e un ragno sull'ultima. Non c'è niente di
    // nuovo, c'è solo che ogni pezzo comincia dove finisce quello prima.
    segment({
      rows: {
        2: 'bbbbb   bbbbbb   bbb',
        3: 'uuuuu   unnuuu   uau',
        4: 'uuuuu   unnuuu   uuu',
        5: 'uuuuu   unnuuu   uuu',
        6: 'uuuuu   unnuuu   uuu',
        7: 'uuuuu   unnuuu   uuu',
        8: 'uuuuu   unnuuu   uuu',
        9: 'uuuuu   unnuuu   uuu',
        10: 'uuuuu   unnuuu   uuu',
        11: 'uuuuu   unnuuu   uuu',
        12: 'uuuuu   unnuuu   uuu',
      },
    }),

    // 9 — l'ultima colonna spenta è quella che porta all'arrivo, e questa volta
    // è vera. Cadere è la cosa giusta: la bandiera sta di sotto, e quella
    // appesa al soffitto è quella sbagliata.
    segment({
      rows: {
        2: 'bbbbb',
        3: 'uuuuu    F',
        4: 'uuuuu    F',
        11: '            W',
        12: '        !   W',
        13: LOW,
        14: LOW,
      },
    }),
  ],
});

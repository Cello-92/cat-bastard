import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-1 — "Il vento arriva prima di te".
 *
 * Il primo mondo cambiava quello che c'è nel livello, il secondo cambiava come
 * risponde il pavimento. Questo cambia l'**aria**, e cioè l'unico momento in
 * cui il gatto non può fare più niente: il nastro ti spostava mentre
 * camminavi, e camminando si può sempre correggere; la corrente ti sposta
 * mentre sei a mezz'aria, e a mezz'aria la traiettoria è già stata decisa.
 *
 * Quindi il livello si legge in un ordine preciso, e non è casuale: prima una
 * corrente che *aiuta* (segmento 1), poi una che ostacola (3), poi una pozza
 * che non uccide ma non ti lascia andare (2), poi una corrente che non esiste
 * (5). L'ultima è quella che conta: per farla funzionare bisogna prima aver
 * insegnato al giocatore a fidarsi delle prime tre.
 */

const FLOOR = '.'.repeat(SEGMENT_COLS);

export const WORLD_3_1 = defineLevel({
  id: 'w3-1',
  name: '3-1',
  title: 'Il vento arriva prima di te',
  sky: 'desert',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — piatto, luminoso, vuoto. Il deserto non ha bisogno di trappole per
    // essere ostile, e infatti qui non ce n'è nessuna: serve solo a far
    // sentire quanto è larga la sabbia prima che cominci a mancare.
    segment({ rows: { 12: '        C  C', 13: FLOOR, 14: FLOOR } }),

    // 1 — la prima corrente, ed è gentile. Sta sopra un buco stretto e spinge
    // dalla parte in cui stai già andando: si scavalca anche senza, ma con
    // lei si arriva lunghi. È l'unica volta in tutto il mondo in cui il vento
    // fa un favore, e serve a stabilire che il vento fa qualcosa.
    segment({
      rows: {
        9: '        )))',
        10: '        )))',
        11: '        )))',
        12: '        )))',
        13: '........   .........',
        14: '........   .........',
      },
    }),

    // 2 — la prima pozza. Non è un buco: è sabbia, si vede che è sabbia, e
    // infatti ci si cade dentro convinti di atterrare. Dentro si affonda
    // piano e si nuota a bracciate — è l'unica cosa del gioco che si può
    // sbagliare e poi rimediare, purché si capisca in fretta come.
    segment({
      rows: {
        8: '       Q',
        12: '   C',
        13: '.....ssss...........',
        14: '.....ssss...........',
      },
    }),

    // 3 — checkpoint, e la stessa corrente di prima girata al contrario. Il
    // buco è identico a quello del segmento 1: cambia solo da che parte tira,
    // e cioè cambia tutto.
    segment({
      rows: {
        10: '          (((',
        11: '          (((',
        12: ' S   G    (((',
        13: '..........   .......',
        14: '..........   .......',
      },
    }),

    // 4 — il risucchio: una colonna di sabbia che cade, sopra una fossa di
    // spuntoni. Il salto pieno finisce dentro la colonna e la colonna lo
    // schiaccia sulle punte; per passare bisogna fare la cosa che nessun
    // platform chiede mai, cioè saltare **meno**.
    segment({
      rows: {
        6: '     vvvv',
        7: '     vvvv',
        8: '     vvvv',
        9: '     vvvv',
        12: '  C',
        13: '.....XXX............',
        14: '....................',
      },
    }),

    // 5 — le due correnti gemelle. La prima porta. La seconda è identica in
    // tutto — stessa sabbia, stesso verso, stesso fischio — e non spinge
    // niente. Il buco sotto si scavalca comunque, ma solo di slancio pieno:
    // chi arriva convinto di essere accompagnato salta corto e basta.
    segment({
      rows: {
        9: '   ))))      wwwww',
        10: '   ))))      wwwww',
        11: '   ))))      wwwww',
        12: '   ))))      wwwww',
        13: '...    ......     ..',
        14: '...    ......     ..',
      },
    }),

    // 6 — pozza più larga, con la corrente contraria piazzata sopra la
    // rincorsa invece che sopra il salto. Non ti butta dentro: ti toglie
    // esattamente la velocità che ti serviva per non finirci.
    segment({
      rows: {
        9: '            B',
        10: '    ((((((',
        11: '    ((((((',
        12: '    ((((((',
        13: '.....ssss...........',
        14: '.....ssss...........',
      },
    }),

    // 7 — il richiamo al primo mondo: una molla onesta sotto un soffitto di
    // lame, e una moneta che non è una moneta. Nel deserto non c'è niente di
    // nuovo qui, ed è il punto: le trappole vecchie funzionano ancora.
    segment({
      rows: {
        4: '    YYYY',
        12: ' S   M    E    J',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 8 — le prime pietre squadrate che spuntano dalla sabbia: qualcuno ha
    // costruito qui, e più avanti c'è il resto. Sopra ci sta appesa una
    // bestia, sotto passa una corrente, e in mezzo un'asse che non regge.
    segment({
      rows: {
        5: '           Z',
        8: '     ---',
        10: '  ---',
        11: '          )))',
        12: '          )))',
        13: '..........   .......',
        14: '..........   .......',
      },
    }),

    // 9 — l'arrivo, con la bandiera sbagliata due passi prima e il solito
    // niente che uccide in mezzo. A questo punto del gioco è quasi una
    // cortesia: sono le uniche due cose che si potevano prevedere.
    segment({
      rows: {
        11: '    F         W',
        12: '    F     !   W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

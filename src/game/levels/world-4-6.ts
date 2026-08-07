import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-6 — "Sotto la torre".
 *
 * La torre finisce, e sotto la torre c'è altra torre, appesa al contrario. Da
 * qui in poi il campo non è più una colonna in mezzo a un livello normale: è
 * **il livello**. Si cammina sul soffitto per interi segmenti, e quello che
 * nella prima metà del mondo era l'eccezione diventa la regola — con la
 * conseguenza che l'eccezione, adesso, è il pavimento.
 *
 * Il che cambia completamente cosa vuol dire "un buco". Nei primi cinque
 * livelli un buco era una pozza da scavalcare; qui è una cella di soffitto che
 * manca, e chi ci passa sopra non cade dentro: cade **fuori**, dal soffitto,
 * per dieci righe, fino al pavimento vero — se c'è. Spesso non c'è.
 *
 * Niente gomitolo: questo livello serve a cambiare punto di vista, e cercare
 * un gomitolo mentre si sta ancora capendo da che parte si è girati sarebbe
 * chiedere due cose insieme.
 */

const LOW = 'b'.repeat(SEGMENT_COLS);
const UP = 'b'.repeat(SEGMENT_COLS);
const FIELD = 'u'.repeat(SEGMENT_COLS);

export const WORLD_4_6 = defineLevel({
  id: 'w4-6',
  name: '4-6',
  title: 'Sotto la torre',
  sky: 'reverse',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — quattro colonne di pavimento onesto, e poi il vuoto. Non c'è niente
    // da decidere: o si sta fermi lì per sempre, o si entra nel campo. È il
    // primo livello del gioco che comincia togliendo il pavimento.
    segment({
      rows: {
        2: UP,
        3: '    uuuuuuuuuuuuuuuu',
        4: '    uuuuuuuuuuuuuuuu',
        5: '    uuuuuuuuuuuuuuuu',
        6: '    uuuuuuuuuuuuuuuu',
        7: '    uuuuuuuuuuuuuuuu',
        8: '    uuuuuuuuuuuuuuuu',
        9: '    uuuuuuuuuuuuuuuu',
        10: '    uuuuuuuuuuuuuuuu',
        11: '    uuuuuuuuuuuuuuuu',
        12: '    uuuuuuuuuuuuuuuu',
        13: 'bbbb',
        14: 'bbbb',
      },
    }),

    // 1 — il primo buco nel soffitto, e sotto non c'è niente. Le celle che
    // mancano si vedono benissimo — manca la pietra e manca il luccichio — ma
    // si vedono guardando in **alto**, che dopo cinque livelli passati a
    // guardare dove si mettono le zampe non è ancora un'abitudine.
    segment({
      rows: {
        2: 'bbbbbbb   bbbbbbbbbb',
        3: 'uuuuuuu   uuuuuuuuuu',
        4: 'uuuuuuu   uuuuuuuuuu',
        5: 'uuuuuuu   uuuuuuuuuu',
        6: 'uuuuuuu   uuuuuuuuuu',
        7: 'uuuuuuu   uuuuuuuuuu',
        8: 'uuuuuuu   uuuuuuuuuu',
        9: 'uuuuuuu   uuuuuuuuuu',
        10: 'uuuuuuu   uuuuuuuuuu',
        11: 'uuuuuuu   uuuuuuuuuu',
        12: 'uuuuuuu   uuuuuuuuuu',
      },
    }),

    // 2 — due buchi, e in mezzo un ragno che occupa esattamente la piazzola
    // fra i due. Non si può aspettare che se ne vada, perché va avanti e
    // indietro lì dentro e basta: bisogna schiacciarlo, cioè saltargli addosso
    // verso il basso, cioè fare la cosa che a testa in giù non viene in mente.
    segment({
      rows: {
        2: 'bbbb    bbbb    bbbb',
        3: 'uuuu    uauu    uuuu',
        4: 'uuuu    uuuu    uuuu',
        5: 'uuuu    uuuu    uuuu',
        6: 'uuuu    uuuu    uuuu',
        7: 'uuuu    uuuu    uuuu',
        8: 'uuuu    uuuu    uuuu',
        9: 'uuuu    uuuu    uuuu',
        10: 'uuuu    uuuu    uuuu',
        11: 'uuuu    uuuu    uuuu',
        12: 'uuuu    uuuu    uuuu',
        13: '    bbbb    bbbb',
        14: '    bbbb    bbbb',
      },
    }),

    // 3 — il checkpoint sta sul soffitto, ed è la prima volta nel gioco. Ci si
    // rinasce attaccati, con lo stesso peso che si aveva quando lo si è preso:
    // se rinascesse diritto, si cadrebbe a ogni morte, e un checkpoint che
    // uccide c'è già ed è un'altra cosa.
    segment({
      rows: {
        2: UP,
        3: 'uuSuuuuuYuuuuuuuuuuu',
        4: FIELD,
        5: FIELD,
        6: FIELD,
        7: FIELD,
        8: FIELD,
        9: FIELD,
        10: FIELD,
        11: FIELD,
        12: FIELD,
        13: '            bbbbbbbb',
        14: '            bbbbbbbb',
      },
    }),

    // 4 — il campo finisce a metà e si ricade sul pavimento vero, che quaggiù
    // è di basalto e ha tutte le cattiverie di sempre. Poi ricomincia, e
    // ricomincia con una colonna spenta: nel Rovescio le colonne spente non
    // stanno più sopra le pozze, stanno **in mezzo alla strada**.
    segment({
      rows: {
        2: '            bbbbbbbb',
        3: '            nnnnnnnn',
        4: '            nnnnnnnn',
        5: '            nnnnnnnn',
        6: '            nnnnnnnn',
        7: '            nnnnnnnn',
        8: '            nnnnnnnn',
        9: '            nnnnnnnn',
        10: '   E        nnnnnnnn',
        11: '        z   nnnnnnnn',
        12: '  C     T   nnnnnnnn',
        13: LOW,
        14: LOW,
      },
    }),

    // 5 — a terra, e con il soffitto vero sopra la testa: le lame adesso sono
    // di nuovo quello che erano nel primo mondo, cioè una punizione per chi
    // salta pieno. Cambiare verso due volte in venti colonne è tutto il
    // livello.
    segment({
      rows: {
        6: '     YYYY      YYY',
        11: '          N',
        12: '  m           !   C',
        13: 'bbbbbbbbbbbbbbbbbbbb',
        14: LOW,
      },
    }),

    // 6 — si risale, e la passerella di sopra è di vetro: si vede il vuoto
    // attraverso il pavimento su cui si sta camminando. Non serve a niente ed
    // è esattamente per questo che c'è.
    segment({
      rows: {
        2: 'oooooooooooooooooooo',
        3: 'uuuuuuuuuuuuuuuuuuuu',
        4: FIELD,
        5: FIELD,
        6: FIELD,
        7: FIELD,
        8: FIELD,
        9: FIELD,
        10: FIELD,
        11: FIELD,
        12: FIELD,
        13: 'bbbb            bbbb',
        14: 'bbbb            bbbb',
      },
    }),

    // 7 — checkpoint sul soffitto, tre buchi stretti e un pendolo capovolto
    // che oscilla attraverso il secondo. Il pendolo non arriva a coprire il
    // buco: lo copre il tempo che ci si mette a decidere.
    segment({
      rows: {
        2: 'bbbb bbbbbb bbbb bbb',
        3: 'uuSu uuuuuu uuuu uuu',
        4: 'uuuu uuuuuu uuuu uuu',
        5: 'uuuu uuuuuu uuuu uuu',
        6: 'uuuu uuuuuu uuuu uuu',
        7: 'uuuu uuuuuu uuuu uuu',
        8: 'uuuu uutuuu uuuu uuu',
        9: 'uuuu uubuuu uuuu uuu',
        10: 'uuuu uuuuuu uuuu uuu',
        11: 'uuuu uuuuuu uuuu uuu',
        12: 'uuuu uuuuuu uuuu uuu',
      },
    }),

    // 8 — l'ultimo tratto capovolto, con le lame sul soffitto e due ragni.
    // Poi il campo finisce e si torna diritti per l'ultima volta, otto righe
    // più in basso.
    segment({
      rows: {
        2: 'bbbbbbbbbbbbbb',
        3: 'uuYuuauuuuYuau',
        4: 'uuuuuuuuuuuuuu',
        5: 'uuuuuuuuuuuuuu',
        6: 'uuuuuuuuuuuuuu',
        7: 'uuuuuuuuuuuuuu',
        8: 'uuuuuuuuuuuuuu',
        9: 'uuuuuuuuuuuuuu',
        10: 'uuuuuuuuuuuuuu',
        11: 'uuuuuuuuuuuuuu',
        12: 'uuuuuuuuuuuuuu',
        13: '              bbbbbb',
        14: '              bbbbbb',
      },
    }),

    // 9 — l'arrivo, per terra come sempre. Dopo centosessanta colonne passate
    // a testa in giù, la bandiera giusta è quella in basso — e quella sbagliata
    // sta appesa al soffitto, dove ormai si guarda per prima cosa.
    segment({
      rows: {
        3: '     F',
        4: '     F',
        11: '            W',
        12: '        !   W',
        13: LOW,
        14: LOW,
      },
    }),
  ],
});

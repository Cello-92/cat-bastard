import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-1 — "Il ghiaccio non ti vuole bene".
 *
 * Il secondo mondo comincia con una promessa e la mantiene: qui non cambia
 * quello che le cose *sono*, cambia come risponde il pavimento. Il ghiaccio si
 * vede — è lucido, è azzurro, non finge di essere terra — e proprio per questo
 * è leale: la prima lastra non ha una sola trappola sopra, serve solo a far
 * capire che da adesso frenare è una manovra e non un ripensamento.
 *
 * Poi, naturalmente, il gioco ricomincia a mentire: la lastra finisce sul
 * vuoto, il ponte di ghiaccio è sottile, il nastro va dall'altra parte e sotto
 * la neve c'è un capannone sepolto con dentro la prima cosa buona del gioco.
 */

const FLOOR = '+'.repeat(SEGMENT_COLS);

export const WORLD_2_1 = defineLevel({
  id: 'w2-1',
  name: '2-1',
  title: 'Il ghiaccio non ti vuole bene',
  sky: 'frost',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro, e nevica. Come in 1-1: qui non succede niente, ed è apposta.
    segment({ rows: { 13: FLOOR, 14: FLOOR } }),

    // 1 — la prima lastra. Nessuna trappola sopra, due monete oneste, e
    // l'unica lezione del segmento: non ti fermi dove volevi fermarti.
    segment({
      rows: {
        9: '      C    C',
        13: '+++++~~~~~~~~~~~++++',
        14: '+++++~~~~~~~~~~~++++',
      },
    }),

    // 2 — e la lastra finisce sul vuoto. Chi arriva lanciato come nel primo
    // mondo scopre qui che il freno non c'è: si salta prima, non dopo.
    segment({
      rows: {
        13: '~~~~~~~~    ++++++++',
        14: '~~~~~~~~    ++++++++',
      },
    }),

    // 3 — la palla di ghiaccio. Sta ferma finché non la vedi, poi rotola
    // verso di te e non si ferma più. Il terreno qui è neve, non ghiaccio:
    // per saltarla serve aderenza, e gliela si concede.
    segment({
      rows: {
        12: '           &',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 4 — checkpoint, e il ponte che continua il pavimento. È ghiaccio
    // sottile: si crepa sotto le zampe e sparisce. Sotto non c'è niente, e il
    // salto da quattro colonne resta possibile anche senza il ponte.
    segment({
      rows: {
        12: ' S',
        13: '++++++++;;;;++++++++',
        14: '++++++++    ++++++++',
      },
    }),

    // 5 — il nastro trasportatore, e ovviamente va dall'altra parte. Non
    // impedisce di avanzare: toglie solo il margine, e il margine serviva per
    // il salto corto sotto le lame e per gli spuntoni in fondo.
    segment({
      rows: {
        9: '       YY     YY',
        12: '                O',
        13: '+++<<<<<<<<<++++++++',
        14: '++++++++++++++++++++',
      },
    }),

    // 6 — il capannone sepolto: la fabbrica del mondo nuovo comincia qui
    // sotto, e una delle sue pareti non è una parete. Dentro c'è il gomitolo.
    // Il tetto è la strada normale; l'ingresso è al livello della neve, dove
    // nessuno guarda perché sembra un muro.
    segment({
      rows: {
        11: '        =======',
        12: '        :   * =',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 7 — adesso che il ghiaccio è una cosa nota, ci si mettono sopra le
    // trappole vere: due piastre a scatto sulla lastra, dove frenare non si
    // può, e un drone che passa e ripassa sempre alla stessa quota.
    segment({
      rows: {
        8: '     %',
        12: '        A   A',
        13: '~~~~~~~~~~~~~~++++++',
        14: '~~~~~~~~~~~~~~++++++',
      },
    }),

    // 8 — il getto di vapore: la prima cosa del gioco che ti spinge dove vuoi
    // andare tu. Il buco sotto si scavalca anche senza, ma le monete lassù no.
    segment({
      rows: {
        8: '          CCCC',
        9: '           ^^',
        10: '           ^^',
        11: '           ^^',
        12: ' S         ^^',
        13: '++++++++++    ++++++',
        14: '++++++++++    ++++++',
      },
    }),

    // 9 — l'arrivo, con l'ultimo scherzo del primo mondo riproposto tale e
    // quale: se ha funzionato una volta funziona ancora.
    segment({
      rows: {
        8: '      Q',
        12: '         !  W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

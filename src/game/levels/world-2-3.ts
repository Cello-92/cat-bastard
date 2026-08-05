import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-3 — "Sotto l'aurora si vede benissimo, ed è peggio".
 *
 * In 1-2 il buio era la scusa. Qui la scusa non c'è: l'aurora illumina tutto,
 * ogni piattaforma si vede da mezzo schermo di distanza, e il livello è
 * comunque una sequenza di appoggi sopra il niente. Sapere dove sono le cose
 * non è mai stato il problema.
 *
 * È il livello più aereo del gioco: la neve compatta regge, il ghiaccio no —
 * e il ghiaccio, a mezz'aria, significa che il bordo della piattaforma arriva
 * prima di quando avresti frenato.
 */

const FLOOR = '+'.repeat(SEGMENT_COLS);

export const WORLD_2_3 = defineLevel({
  id: 'w2-3',
  name: '2-3',
  title: 'Sotto l\'aurora si vede benissimo, ed è peggio',
  sky: 'aurora',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro, con l'aurora che si muove piano sopra la testa. Guardarla
    // è gratis solo qui.
    segment({ rows: { 13: FLOOR, 14: FLOOR } }),

    // 1 — le prime isole. Distanze oneste, appoggi solidi: serve a stabilire
    // qual è il salto normale, così i prossimi si possono misurare a occhio.
    segment({
      rows: {
        11: '    +++    +++',
        13: '+++              +++',
        14: '+++              +++',
      },
    }),

    // 2 — la stessa cosa, ma la piattaforma lunga è di ghiaccio. Sopra la
    // neve ci si ferma sul bordo; qui il bordo passa sotto le zampe e non
    // torna indietro.
    segment({
      rows: {
        4: '           Z',
        11: '  ~~~~~~~~~~~',
        13: '++              ++++',
        14: '++              ++++',
      },
    }),

    // 3 — corridoio a terra per tirare il fiato, che ovviamente non è un
    // corridoio per tirare il fiato: checkpoint, palla di ghiaccio in arrivo e
    // lame basse che vietano il salto pieno esattamente quando serve saltare.
    segment({
      rows: {
        9: '      YY       YY',
        12: ' S         &',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 4 — il ponte di assi sopra il vuoto, con in mezzo una che non è
    // un'asse marcia: è proprio finta. Sotto non c'è rete.
    segment({
      rows: {
        11: '  DDD  DLD  DDD  ++',
        13: '++',
        14: '++',
      },
    }),

    // 5 — il rifugio. Una cabina di lamiera murata su un soppalco, l'unica
    // cosa costruita da mani umane in mezzo alla neve. Una parete non regge
    // niente, e dietro c'è il gomitolo.
    segment({
      rows: {
        8: '      ==============',
        9: '      :   *   ======',
        10: '      ==============',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 6 — due droni sulla stessa rotta a quote diverse, sopra un vuoto che si
    // scavalca in due salti. Passano sempre uguale: è un problema di ritmo,
    // non di riflessi.
    segment({
      rows: {
        7: '      %',
        10: '            %',
        11: '     +++    +++',
        13: '++++            ++++',
        14: '++++            ++++',
      },
    }),

    // 7 — la lastra sottile sopra la fossa. Si crepa mentre la attraversi, e
    // sotto non c'è il vuoto: c'è di peggio.
    segment({
      rows: {
        12: '              E',
        13: '+++++;;;;++++++XXX++',
        14: '+++++    +++++++++++',
      },
    }),

    // 8 — checkpoint, e il getto di vapore che porta al piano di sopra, dove
    // ci sono le monete e — naturalmente — anche una che non è una moneta.
    segment({
      rows: {
        7: '          CCC',
        8: '          ^^',
        9: '          ^^',
        10: '          ^^',
        11: '          ^^',
        12: ' S        ^^',
        13: '++++++++++  ++++++++',
        14: '++++++++++  ++++++++',
      },
    }),

    // 9 — l'arrivo, con la lanterna gemella due passi prima. Una delle due
    // non si accende mai, e a questo punto del gioco dovresti saperlo.
    segment({
      rows: {
        12: '    N      !  W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-3 — "Controvento".
 *
 * 3-1 aveva insegnato che l'aria porta. Questo livello si gioca dentro una
 * tempesta e insegna la seconda metà della stessa regola: l'aria porta anche
 * quando non ti conviene, e quasi tutte le correnti qui dentro vanno **contro**
 * la direzione in cui stai andando. Non è una cattiveria gratuita — è la
 * ragione per cui esistono gli scarabei.
 *
 * Lo scarabeo vola piano e si fa portare dalle correnti con lo stesso identico
 * numero del gatto: dove va lui, va il vento. È il primo nemico del gioco che
 * serve anche a *leggere* il livello, e in un livello dove metà dell'aria è
 * ostile serviva qualcosa che la rendesse visibile prima di saltarci dentro
 * (CLAUDE.md, punto 7: leggibile a posteriori, e qui perfino prima).
 *
 * La trappola del segmento 6 è l'inverso esatto di quella di 3-1. Là una
 * corrente morta disegnata a favore faceva saltare corti; qui una disegnata
 * *contraria* fa saltare troppo forte, e si finisce lunghi. Stessa bugia,
 * sbagliata dalla parte opposta.
 */

const FLOOR = '.'.repeat(SEGMENT_COLS);

export const WORLD_3_3 = defineLevel({
  id: 'w3-3',
  name: '3-3',
  title: 'Controvento',
  sky: 'sandstorm',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — la tempesta, e uno scarabeo che ci sta dentro. Non c'è niente da
    // saltare: c'è da guardare quella bestia che vola verso destra e arriva a
    // sinistra. Tutto il livello è spiegato lì.
    segment({
      rows: {
        8: '      ((((((((((',
        9: '      (((((k((((',
        12: '        C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — lo stesso buco stretto del primo livello del mondo, con la corrente
    // girata. Si scavalca, ma bisogna partire da più indietro e non mollare il
    // salto a metà.
    segment({
      rows: {
        10: '       (((((',
        11: '       (((((',
        12: '       (((((',
        13: '........   .........',
        14: '........   .........',
      },
    }),

    // 2 — la pozza col vento addosso: la rincorsa è controvento, quindi ci si
    // arriva più piano di quanto si pensasse, e la sabbia non ha fretta.
    segment({
      rows: {
        9: '   ((((((((',
        10: '   ((((((((',
        12: '   C',
        13: '......ssss..........',
        14: '......ssss..........',
      },
    }),

    // 3 — checkpoint, il risucchio sopra le punte e uno scarabeo che passa
    // proprio lì: schiacciarlo è una scorciatoia, mancarlo è una morte.
    segment({
      rows: {
        5: '        vvv',
        6: '        vvv',
        7: '        vvv',
        8: '        vvv',
        10: '     k',
        12: ' S',
        13: '........XXX.........',
        14: FLOOR,
      },
    }),

    // 4 — la rovina sepolta. Si vede benissimo che è cava, e questo è il
    // punto: il segreto non è che ci sia qualcosa dentro, è **da dove si
    // entra**. La parete di sinistra è arenaria come le altre tre.
    segment({
      rows: {
        8: '      -------',
        9: '      /     -',
        10: '      /  *  -',
        11: '      -------',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 5 — due correnti opposte affiancate, con uno scarabeo per una. Il salto
    // parte a favore e finisce contro: la traiettoria si spezza a metà, e
    // l'unico modo di saperlo prima è aver guardato le bestie.
    segment({
      rows: {
        7: '  ))))))    ((((((',
        8: '  )))k))    ((k(((',
        12: '            C',
        13: '.....ssss...........',
        14: '.....ssss...........',
      },
    }),

    // 6 — la bugia al contrario. La corrente disegnata verso sinistra non
    // esiste: chi compensa saltando più forte — cioè chiunque abbia giocato i
    // due livelli precedenti — atterra oltre la piattaforma, sulle punte.
    segment({
      rows: {
        9: '     qqqqqq',
        10: '     qqqqqq',
        11: '     qqqqqq',
        12: '     qqqqqq',
        13: '....    ....XXXX....',
        14: '....    ............',
      },
    }),

    // 7 — checkpoint, e la fila di pozze con gli scogli in mezzo. Qui non c'è
    // vento: è un problema di misura, e serve a far tirare il fiato prima
    // dell'ultima salita.
    segment({
      rows: {
        12: ' S',
        13: '.....ss...ss...ss...',
        14: '.....ss...ss...ss...',
      },
    }),

    // 8 — la salita sulle rovine, con la corrente a favore per la prima volta
    // da dieci segmenti. Ci si fida, ovviamente, ed è sopra a un'asse marcia.
    segment({
      rows: {
        5: '          YYYY',
        8: '      DDD',
        10: '   ---',
        11: '           ))))',
        12: '           ))))',
        13: '..........    ......',
        14: '..........    ......',
      },
    }),

    // 9 — l'arrivo, e una moneta che a questo punto è quasi un insulto.
    segment({
      rows: {
        11: '    F         W',
        12: '    F   E     W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

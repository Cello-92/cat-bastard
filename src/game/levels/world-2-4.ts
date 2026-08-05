import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-4 — "Tutto quello che scivola, scivola verso di te".
 *
 * Il livello del ghiaccio vero: quasi tutto il pavimento è lastra, e su una
 * lastra non ci sono ripensamenti — la posizione dove ti fermerai è decisa da
 * dove hai smesso di spingere, non da dove togli il dito.
 *
 * Sopra questa regola sola si costruisce tutto il resto: le palle di ghiaccio
 * che arrivano quando la frenata non è più possibile, le fosse che finiscono
 * un attimo prima di dove le avresti volute, e un nastro che aggiunge la sua
 * opinione a una superficie che già non ascolta la tua.
 */

const FLOOR = '+'.repeat(SEGMENT_COLS);
const SHEET = '~'.repeat(SEGMENT_COLS);

export const WORLD_2_4 = defineLevel({
  id: 'w2-4',
  name: '2-4',
  title: 'Tutto quello che scivola, scivola verso di te',
  sky: 'frost',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro corto: due passi sulla neve e poi comincia la lastra.
    segment({ rows: { 13: '++++++++~~~~~~~~~~~~', 14: '++++++++~~~~~~~~~~~~' } }),

    // 1 — lastra piena con una fossa in mezzo. Non è larga: è larga quanto
    // basta a chi non ha capito che qui si salta prima.
    segment({
      rows: {
        9: '            C',
        13: '~~~~~~~~   ~~~~~~~~~',
        14: '~~~~~~~~   ~~~~~~~~~',
      },
    }),

    // 2 — la prima palla, e arriva sul ghiaccio. Scappare all'indietro non
    // funziona — è più veloce di te e tu non hai aderenza: si salta, e basta.
    segment({
      rows: {
        12: '            &',
        13: SHEET,
        14: SHEET,
      },
    }),

    // 3 — checkpoint su un'isola di neve, l'unico pezzo di terreno onesto del
    // livello. Poi si torna sulla lastra, con le lame sopra a vietare il
    // salto pieno e una piastra a scatto dove si atterra.
    segment({
      rows: {
        9: '        YY      YY',
        12: ' S              A',
        13: '++++~~~~~~~~~~~~~~~~',
        14: '++++~~~~~~~~~~~~~~~~',
      },
    }),

    // 4 — il nastro sul ghiaccio: due superfici che non ti ascoltano, una
    // sopra l'altra. Il nastro porta verso la fossa, il ghiaccio toglie il
    // freno, e la fossa è alla fine. Si passa saltando presto.
    segment({
      rows: {
        13: '~~~>>>>>>>>>~~~~   +',
        14: '~~~~~~~~~~~~~~~~   +',
      },
    }),

    // 5 — la grotta di ghiaccio: un tetto basso di lastre e un pavimento
    // sottile. Le lastre sottili si crepano, quelle sopra la testa no — ma
    // gocciolano, e sotto ogni goccia prima o poi si forma qualcosa di appuntito.
    segment({
      rows: {
        8: '  ~~~~~~~~~~~~~~~~~~',
        9: '        T       T',
        13: '+++++;;;++++;;;+++++',
        14: '+++++   ++++   +++++',
      },
    }),

    // 6 — la baracca sepolta nel ghiaccio. Il gomitolo è dentro, il soppalco
    // è l'unico modo per arrivarci, e la parete davanti non è una parete.
    segment({
      rows: {
        8: '    ================',
        9: '    :    *   =======',
        10: '    ================',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 7 — due palle sulla stessa lastra, sfalsate. La prima si scavalca; la
    // seconda parte mentre sei ancora in aria per la prima.
    segment({
      rows: {
        12: '      &        &',
        13: SHEET,
        14: SHEET,
      },
    }),

    // 8 — checkpoint, e la salita finale: il getto porta al piano alto, dove
    // il pavimento è di nuovo ghiaccio e finisce sul vuoto. Sotto c'è la
    // strada lunga, per chi il getto lo sbaglia.
    segment({
      rows: {
        6: '          ~~~~~~~',
        8: '       ^^',
        9: '       ^^',
        10: '       ^^',
        11: '       ^^',
        12: ' S     ^^',
        13: '+++++++~~~~~~~~~~~~~',
        14: '+++++++~~~~~~~~~~~~~',
      },
    }),

    // 9 — l'arrivo, in fondo alla lastra. Gli spuntoni invisibili sono
    // esattamente dove si finisce di scivolare se non si è frenato prima.
    segment({
      rows: {
        12: '      !     !  W',
        13: '~~~~~~~~~~++++++++++',
        14: '~~~~~~~~~~++++++++++',
      },
    }),
  ],
});

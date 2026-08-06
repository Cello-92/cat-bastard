import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-9 — "La tempesta".
 *
 * L'ultimo livello all'aperto, e il più cattivo dei sei del deserto: da qui in
 * poi si sta al chiuso fino alla fine del mondo. Non introduce niente — non è
 * più il momento — e mette invece una accanto all'altra tutte le cose che il
 * deserto ha insegnato, nell'ordine sbagliato: corrente a favore dove non
 * serve, corrente contraria dove serviva quella a favore, e sotto ogni salto
 * sbagliato una pozza invece del solito vuoto onesto.
 *
 * Il gomitolo è il terzo di una serie che è diventata un discorso. In 3-2 la
 * stanza stava dietro una parete; in 3-5 sotto una pozza; in 3-8 sopra il
 * soffitto. Qui sta **dietro una parete in fondo a una pozza**, cioè le due
 * cose insieme: si affonda apposta e poi si spinge di lato, e non funziona
 * nessuna delle due mosse da sola.
 */

const FLOOR = '.'.repeat(SEGMENT_COLS);

export const WORLD_3_9 = defineLevel({
  id: 'w3-9',
  name: '3-9',
  title: 'La tempesta',
  sky: 'sandstorm',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — la tempesta è al massimo e non si vede niente più in là di mezzo
    // schermo. Uno scarabeo passa in mezzo alla corrente, ed è l'unica cosa
    // in tutto il segmento che dica da che parte tira.
    segment({
      rows: {
        8: '     )))))))))))',
        9: '     ))))k))))))',
        12: '        C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — gli scogli. Strisce di terreno buono larghe due, pozze larghe tre, e
    // sopra ognuna una corrente diversa: la prima aiuta, la seconda no.
    segment({
      rows: {
        9: '   ))))))    ((((((',
        10: '   ))))))    ((((((',
        13: '..ss...sss....sss...',
        14: '..ss...sss....sss...',
      },
    }),

    // 2 — la pozza col fondo.
    //
    // È bassa e non fa paura, ed è il punto: ci si finisce dentro per sbaglio,
    // si tocca il fondo, e da lì si vede una parete. Il gomitolo è dietro,
    // e l'unico modo di arrivarci è affondare apposta e poi spingere.
    segment({
      rows: {
        11: '        ss',
        12: '        ss',
        13: '........  /  *......',
        14: FLOOR,
      },
    }),

    // 3 — checkpoint, e il muro di risucchi sopra le punte: quattro colonne
    // che schiacciano, e in mezzo lo spazio per passare bassi. Chi salta
    // pieno viene messo sul fondo, e il fondo ha i denti.
    segment({
      rows: {
        6: '     v   v   v   v',
        7: '     v   v   v   v',
        8: '     v   v   v   v',
        9: '     v   v   v   v',
        12: ' S',
        13: '....XX..XX..XX..XX..',
        14: FLOOR,
      },
    }),

    // 4 — il salto lungo, con la corrente a favore che stavolta è vera. Serve
    // a rimettere fiducia, esattamente un segmento prima di toglierla.
    segment({
      rows: {
        8: '     ))))))))',
        9: '     ))))))))',
        10: '     ))))))))',
        11: '     ))))))))',
        12: '            C',
        13: '.....     ..........',
        14: '.....     ..........',
      },
    }),

    // 5 — lo stesso salto, la stessa corrente disegnata identica, e sotto la
    // sabbia invece del vuoto. Questa non spinge: chi si è fidato del
    // segmento prima ci arriva in mezzo e non ne esce.
    segment({
      rows: {
        8: '     wwwwwwww',
        9: '     wwwwwwww',
        10: '     wwwwwwww',
        11: '     wwwwwwww',
        13: '.....sssss..........',
        14: '.....sssss..........',
      },
    }),

    // 6 — checkpoint, la sentinella e gli spuntoni a scatto sull'unica
    // striscia buona, con due scarabei che passano alti. Niente correnti: qui
    // il problema è solo la larghezza del corridoio.
    segment({
      rows: {
        7: '   k          k',
        12: ' S      H',
        13: '.....AA......AA.....',
        14: FLOOR,
      },
    }),

    // 7 — le tre pozze con i risucchi sopra. Si passa bassi, come al segmento
    // 3, ma stavolta sotto non ci sono le punte: c'è di peggio, perché la
    // sabbia non uccide subito e lascia il tempo di capire.
    segment({
      rows: {
        7: '   vvv  vvv  vvv',
        8: '   vvv  vvv  vvv',
        9: '   vvv  vvv  vvv',
        13: '...sss..sss..sss....',
        14: '...sss..sss..sss....',
      },
    }),

    // 8 — la salita sulle rovine mezze sepolte, con l'asse marcia in cima e le
    // lame appese al niente sopra di lei.
    segment({
      rows: {
        4: '        YYYY',
        6: '        DDD',
        9: '   ---',
        11: '            ---',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 9 — l'arrivo, con la bandiera sbagliata e il pezzo di niente. Ultima
    // volta all'aperto: da qui in poi c'è solo il tempio.
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

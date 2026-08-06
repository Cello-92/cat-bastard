import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-2 — "Qualcuno ha costruito tutto questo apposta".
 *
 * Sotto le dune c'è un tempio, e la differenza col deserto è la stessa che
 * passa fra un posto pericoloso e un posto ostile: là le trappole erano il
 * paesaggio — sabbia che cede, aria che spinge — qui le ha messe qualcuno, una
 * per una, e si vede benissimo perché sono squadrate.
 *
 * La cosa nuova è la **piastra a pressione**: l'unico congegno del gioco in
 * cui la causa e l'effetto stanno in due posti diversi. Pestarla non fa
 * succedere niente lì; fa venire giù il corridoio più avanti, a partire da
 * dove sei. Resta dentro il patto perché si vede da lontano ed è sempre la
 * stessa: quello che non si sa la prima volta è *a cosa era attaccata*, e per
 * saperlo bisogna essere già in corsa.
 */

const FLOOR = '-'.repeat(SEGMENT_COLS);
const CEILING = '-'.repeat(SEGMENT_COLS);

export const WORLD_3_2 = defineLevel({
  id: 'w3-2',
  name: '3-2',
  title: 'Qualcuno ha costruito tutto questo apposta',
  sky: 'tomb',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — l'ingresso: la sabbia finisce e comincia la pietra tagliata, con la
    // volta che si chiude sopra la testa. Da qui in poi il cielo non c'è più.
    segment({
      rows: {
        0: CEILING,
        12: '        C',
        13: '.....---------------',
        14: '.....---------------',
      },
    }),

    // 1 — la prima piastra, e il primo corridoio con la volta piena di
    // mattoni. Camminandoci sotto ne cade uno per volta, con il suo tremolio:
    // è la trappola di sempre. Pestando la lastra vengono giù tutti insieme,
    // a partire da quello più vicino — e quello più vicino sei tu.
    segment({
      rows: {
        0: CEILING,
        9: '        TTTTTTTT',
        12: '   C',
        13: '-----p--------------',
        14: FLOOR,
      },
    }),

    // 2 — due pozze, e sopra ognuna una colonna di sabbia che cade. Il
    // risucchio non ti butta dentro: ti accorcia il salto quel tanto che
    // basta perché la pozza faccia il resto.
    segment({
      rows: {
        0: CEILING,
        6: '      v      v',
        7: '      v      v',
        8: '      v      v',
        9: '      v      v',
        10: '      v      v',
        11: '      v      v',
        12: '      v      v',
        13: '-----sss---ssss-----',
        14: '-----sss---ssss-----',
      },
    }),

    // 3 — checkpoint, e il pozzo di vapore che porta al ballatoio.
    //
    // È l'unico posto tranquillo del tempio, ed è l'unico posto del gioco che
    // esiste per essere giocato invece che superato: dentro il getto non si
    // scende mai, la corrente di sopra porta a destra da sola, e il ballatoio
    // si prende lasciandosi accompagnare. Chi ci resta a giocare abbastanza a
    // lungo si accorge di una cosa che nessuno gli ha chiesto di fare.
    segment({
      rows: {
        0: CEILING,
        5: '           )))))))))',
        6: '           ))))))CC',
        7: '             -------',
        8: '            ^',
        9: '            ^',
        10: '            ^',
        11: '            ^',
        12: ' S          ^',
        13: '------------ -------',
        14: '------------ -------',
      },
    }),

    // 4 — la stanza murata. Sta su un ripiano che non serve a niente, e
    // l'unica ragione per salirci è che non serve a niente: la parete di
    // sinistra è arenaria come tutte le altre e non regge un bel nulla.
    segment({
      rows: {
        0: CEILING,
        7: '         -------',
        8: '         /     -',
        9: '         /  *  -',
        10: '         -------',
        12: '  C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 5 — la seconda piastra, e stavolta è la piastra a essere il pavimento:
    // si arriva di salto e ci si atterra sopra. Da lì in poi il corridoio è
    // lungo dodici colonne, il soffitto sta venendo giù dietro di te e in
    // mezzo alla corsa c'è una pozza da scavalcare. Si può anche saltare più
    // lunghi e non pestarla — ma bisogna sapere che c'è.
    segment({
      rows: {
        0: CEILING,
        8: '   TTTTTTTTTTT',
        13: '-   p----ssss-------',
        14: '-   -----ssss-------',
      },
    }),

    // 6 — la traversata: sotto ci sono le punte, sopra c'è una corrente che
    // porta, e in mezzo una colonna che spinge in giù piazzata esattamente
    // dove il salto è più alto. Bisogna partire lanciati e restare bassi.
    segment({
      rows: {
        0: CEILING,
        9: '  ))))))))))))))',
        10: '  ))))))))))))))',
        11: '      v',
        12: '      v',
        13: '---XXXXXX-----------',
        14: FLOOR,
      },
    }),

    // 7 — checkpoint, la sentinella corazzata e un soffitto di lame sopra il
    // corridoio più stretto del livello. Non c'è niente di nuovo: c'è che qui
    // le cose vecchie stanno tutte insieme.
    segment({
      rows: {
        0: CEILING,
        4: '        YYYY',
        12: ' S    H',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 8 — la risalita verso l'uscita: assi marce sopra il vuoto, e una
    // colonna di sabbia che cade proprio dove si atterra.
    segment({
      rows: {
        0: CEILING,
        6: '      D D D',
        9: '   ---',
        11: '        vvv',
        12: '        vvv',
        13: '-----   ------------',
        14: '-----   ------------',
      },
    }),

    // 9 — l'uscita. Due bandiere, una sola porta fuori, e in mezzo il solito
    // niente. Il tempio saluta come ha salutato il primo mondo.
    segment({
      rows: {
        0: CEILING,
        11: '     F        W',
        12: '     F   !    W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

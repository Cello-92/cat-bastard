import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-7 — "La bufera non aspetta nessuno".
 *
 * Si torna fuori, e fuori è peggio di prima: qui il terreno onesto è
 * l'eccezione e la lastra è la regola. Non c'è una singola trappola inedita in
 * tutto il livello — c'è solo che ogni cosa capita mentre stai già scivolando,
 * e su una lastra la decisione la prendi cinque metri prima di sapere che
 * serviva.
 *
 * **Qui non c'è nessun gomitolo.** Non è una dimenticanza ed è la ragione per
 * cui il livello esiste: se ogni livello ne nasconde uno, cercarlo non è più
 * cercare, è raccogliere. Da qui in poi il muro che sembra finto a volte è
 * solo un muro, e l'unico modo di saperlo è perderci tempo.
 */

const FLOOR = '+'.repeat(SEGMENT_COLS);
const SHEET = '~'.repeat(SEGMENT_COLS);

export const WORLD_2_7 = defineLevel({
  id: 'w2-7',
  name: '2-7',
  title: 'La bufera non aspetta nessuno',
  sky: 'storm',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — neve battuta, vento in faccia, niente altro. L'ultimo pezzo di
    // pavimento che risponde ai comandi come te lo aspetti.
    segment({ rows: { 13: FLOOR, 14: FLOOR } }),

    // 1 — la lastra comincia subito e finisce sul vuoto. Le due monete sono
    // oneste: servono a far arrivare qualcuno lanciato fin sul bordo.
    segment({
      rows: {
        9: '      C     C',
        13: '++++~~~~~~~~   ~~~~~',
        14: '++++~~~~~~~~   ~~~~~',
      },
    }),

    // 2 — palla di ghiaccio sul ghiaccio: scappare all'indietro non funziona,
    // frenare nemmeno. Restano due salti, e il secondo atterra dove qualcuno
    // ha messo una piastra a scatto.
    segment({
      rows: {
        12: '     &      A   A',
        13: SHEET,
        14: SHEET,
      },
    }),

    // 3 — checkpoint, e il ponte a pezzi. Le campate lunghe sono di ghiaccio
    // sottile e reggono il tempo di sentirle crepitare; gli appoggi in mezzo
    // sono larghi due tile, cioè quanto un atterraggio fatto bene.
    segment({
      rows: {
        12: ' S',
        13: '++++;;;;++  ++;;;;++',
        14: '++++    ++  ++    ++',
      },
    }),

    // 4 — il cornicione: assi vecchie sopra il crepaccio, e una bestia appesa
    // che aspetta di vedere qualcuno arrivare a metà campata. Le assi si
    // sbriciolano poco dopo che ci sali, quindi fermarsi a guardare in alto è
    // esattamente la cosa che non si può fare.
    segment({
      rows: {
        4: '          Z',
        11: '  DDD   DDD   DDD ++',
        13: '++',
        14: '++',
      },
    }),

    // 5 — la grotta sotto il ghiacciaio. Soffitto basso di lastra, due massi
    // appesi che aspettano di sentirti passare sotto, e il pavimento che si
    // crepa in due punti. Il soffitto toglie il salto pieno proprio dove
    // servirebbe per non pensarci.
    segment({
      rows: {
        8: '  ~~~~~~~~~~~~~~~~~~',
        9: '       T        T',
        13: '+++++;;;+++++;;;++++',
        14: '+++++   +++++   ++++',
      },
    }),

    // 6 — il nastro della miniera, gelato ma ancora in funzione: spinge verso
    // la fossa, e sull'altra sponda c'è quello che di solito c'è sull'altra
    // sponda.
    segment({
      rows: {
        12: '                  A',
        13: '~~~>>>>>>>>~~~~  +++',
        14: '~~~~~~~~~~~~~~~  +++',
      },
    }),

    // 7 — due palle sulla stessa lastra e il tetto di ghiaccio sopra la testa:
    // il salto pieno qui non esiste, e per scavalcarle resta solo quello
    // giusto. La seconda parte mentre sei ancora in aria per la prima.
    segment({
      rows: {
        9: '  ~~~~~~~~~~~~~~~~',
        12: '      &        &',
        13: SHEET,
        14: SHEET,
      },
    }),

    // 8 — ultimo checkpoint. La strada bassa è sbarrata da quattro colonne di
    // spuntoni: si può saltare, ma è il salto più lungo del livello e si parte
    // dal ghiaccio. Il getto porta al ballatoio, dove ci sono anche le monete,
    // e da lì si scende dall'altra parte della fossa.
    segment({
      rows: {
        5: '       ^^',
        6: '       ^^',
        7: '       ^^  CCC',
        8: '       ^^  ~~~~~~',
        12: ' S     ^^',
        13: '+++++++~~~~~XXXX~~~~',
        14: '+++++++~~~~~~~~~~~~~',
      },
    }),

    // 9 — l'arrivo. La moneta sospesa è avvelenata e la molla è una tagliola:
    // due cose che si prendono solo andandole a cercare, e a questo punto del
    // mondo cercare è diventato un riflesso.
    segment({
      rows: {
        9: '        E',
        12: '   !      m     W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

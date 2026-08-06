import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-6 — "Il turno di notte".
 *
 * La fabbrica di 2-2 vista quando non c'è nessuno: gli stessi nastri, gli
 * stessi getti, le stesse sentinelle — solo che adesso il gioco dà per
 * scontato che tu sappia già come funzionano, e smette di lasciare margine.
 *
 * Le due cose nuove non sono trappole nuove, sono *dosi* nuove. La passerella
 * sopra il vuoto non è più continua: ha un buco, e dentro al buco c'è una
 * piattaforma che sembra la soluzione. E i getti di vapore adesso sono tre,
 * uno per fossa, e quello che solleva davvero è sopra la fossa che si
 * scavalcava benissimo saltando.
 *
 * Il gomitolo è nel solito magazzino murato, che a questo punto del mondo non
 * è più un segreto ma un'abitudine: la novità è che la strada normale ci passa
 * *sopra*, e per entrarci bisogna decidere di cadere.
 */

const CEILING = '='.repeat(SEGMENT_COLS);
const FLOOR = CEILING;

export const WORLD_2_6 = defineLevel({
  id: 'w2-6',
  name: '2-6',
  title: 'Il turno di notte',
  sky: 'foundry',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — l'ingresso di servizio. Due passi di niente, come sempre: serve solo
    // a far sentire il rumore di quello che gira più avanti.
    segment({ rows: { 0: CEILING, 1: CEILING, 13: FLOOR, 14: FLOOR } }),

    // 1 — il nastro va contro, le lame vietano il salto pieno nei due punti in
    // cui servirebbe, e dove il nastro ti molla c'è una piastra che scatta
    // quando ci sei già sopra. La corsia libera per scavalcarla c'è: è quella
    // in mezzo alle due coppie di lame, ed è larga esattamente quanto basta.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '    YY          YY',
        12: '            O',
        13: '===<<<<<<<<<========',
        14: FLOOR,
      },
    }),

    // 2 — la sentinella sul ghiaccio, e la lastra finisce sul vuoto. Frenare
    // per farla caricare a vuoto è la mossa giusta in 2-2; qui frenare non è
    // una cosa che si possa fare, quindi la mossa giusta è un'altra.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        12: '        H',
        13: '====~~~~~~~   ======',
        14: '====~~~~~~~   ======',
      },
    }),

    // 3 — checkpoint e il montacarichi: il muro di quattro tile non si salta,
    // e il getto è di quelli veri. Questo è l'unico posto gentile del livello.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        5: '            ^^',
        6: '            ^^',
        7: '            ^^',
        8: '            ^^ =====',
        9: '            ^^ =====',
        10: '            ^^ =====',
        11: '            ^^ =====',
        12: ' S          ^^ =====',
        13: '=============  =====',
        14: '=============  =====',
      },
    }),

    // 4 — la passerella. Il nastro spinge verso il punto da cui sei venuto,
    // sotto non c'è più niente per cinque piani, e in mezzo al buco c'è una
    // lamiera messa lì apposta per farsi calpestare: non trema, non avvisa,
    // sparisce in tre tick. Il buco si salta anche ignorandola — è più corto
    // di lei.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '====<<<<<<< L <<<<<=',
      },
    }),

    // 5 — il magazzino. La passerella muore dopo tre tile e da lì si cade sul
    // pavimento di sotto; il soppalco che si attraversa cadendo è murato da
    // tutti i lati tranne uno, e quel lato è a sinistra, cioè alle spalle di
    // chiunque stia andando avanti. Dentro c'è il gomitolo.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '===    =============',
        9: '       :    *  =====',
        10: '       =============',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 6 — tre fosse, tre getti, e la lezione di 2-2 girata al contrario: il
    // vapore che solleva davvero è sopra la fossa da due colonne, quella che
    // non aveva nessun bisogno di essere sollevata. Gli altri due sono sopra
    // le fosse larghe, e sono freddi.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '   ,,     ^^     ,,',
        10: '   ,,     ^^     ,,',
        11: '   ,,     ^^     ,,',
        12: '   ,,     ^^     ,,',
        13: '==    ====  ====   =',
        14: '==    ====  ====   =',
      },
    }),

    // 7 — il turno di notte al completo: sentinella da una parte, palla di
    // ghiaccio dall'altra, drone in mezzo, e il pavimento fra le due isole è
    // ghiaccio sottile. Il ghiaccio regge il tempo di accorgersene.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '         %',
        12: '  H              &',
        13: '====;;;;====;;;;====',
        14: '====    ====    ====',
      },
    }),

    // 8 — ultimo checkpoint, e il corridoio a scacchiera. Le lame stanno
    // sopra i tratti liberi e le piastre sopra i tratti sgombri: si passa,
    // ma un salto per volta e mai quello pieno.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '  YY      YY      YY',
        12: ' S   A       O',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 9 — l'uscita. La lanterna spenta prima dell'arrivo, il blocco premio
    // onesto sopra la testa, e in mezzo gli spuntoni che non si vedono.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '        Q',
        12: '   N      !   W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

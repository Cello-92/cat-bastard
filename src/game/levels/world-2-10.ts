import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-10 — "Il collaudo".
 *
 * L'esame vero, quello che 2-5 fingeva di essere. Non c'è una trappola sola
 * che il giocatore non abbia già visto: c'è che adesso arrivano tutte
 * attaccate, senza un tile di respiro in mezzo, e ognuna sta esattamente nel
 * punto in cui la precedente ti lascia.
 *
 * Due cose lo distinguono da tutto il resto del mondo. La prima: il ghiaccio
 * sottile non nasconde più il vuoto ma gli spuntoni, quindi cedere non è una
 * caduta lunga, è una morte immediata. La seconda: nell'ultimo corridoio le
 * lame stanno *sopra* le piastre, una per una. Il salto pieno ti infila nelle
 * lame, il salto mancato ti infila negli spuntoni, e in mezzo c'è una finestra
 * di quattro tick. È la cosa più cattiva del gioco che non sia il Padrone, ed
 * è deterministica come tutto il resto: si impara, e poi si fa sempre uguale.
 *
 * Il gomitolo è l'ultimo del mondo, ed è nel posto più prevedibile possibile.
 * A questo punto sarebbe scortese nasconderlo bene.
 */

const CEILING = '='.repeat(SEGMENT_COLS);
const FLOOR = CEILING;

export const WORLD_2_10 = defineLevel({
  id: 'w2-10',
  name: '2-10',
  title: 'Il collaudo',
  sky: 'foundry',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — la sala prove. Vuota, come sempre, e per l'ultima volta.
    segment({ rows: { 0: CEILING, 1: CEILING, 13: FLOOR, 14: FLOOR } }),

    // 1 — due nastri che si scontrano: il primo ti lancia, il secondo ti
    // riporta indietro, e la cucitura fra i due è il punto in cui si perde
    // tutta la velocità. Dopo la cucitura c'è la piastra a scatto.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '   YY            YY',
        12: '               O',
        13: '==>>>>>><<<<<<======',
        14: FLOOR,
      },
    }),

    // 2 — il ghiaccio sottile sopra gli spuntoni. In tutto il mondo, finora,
    // sotto la lastra che cede c'era il vuoto: una caduta, il tempo di
    // capirlo, la battuta. Qui sotto c'è la fila di punte, e non c'è nessuna
    // caduta. Le due campate sono da cinque colonne: si scavalcano intere.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        12: '   H',
        13: '====;;;;;====;;;;;==',
        14: '====XXXXX====XXXXX==',
      },
    }),

    // 3 — checkpoint, e il pozzo: due getti identici, uno per fossa. Quello
    // di sinistra è freddo e la sua fossa non ha fondo; quello di destra è
    // l'unico modo di arrivare al ballatoio, perché il muro è di cinque tile.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        5: '    ,,      ^^',
        6: '    ,,      ^^',
        7: '    ,,      ^^',
        8: '    ,,      ^^ =====',
        9: '    ,,      ^^ =====',
        10: '    ,,      ^^ =====',
        11: '    ,,      ^^ =====',
        12: ' S  ,,      ^^ =====',
        13: '====  =======  =====',
        14: '====  =======  =====',
      },
    }),

    // 4 — la passerella smontata. Assi marce, due buchi, e dentro ogni buco
    // una lamiera che sparisce: quella a metà della campata lunga è
    // irresistibile, e non regge tre tick.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '===DDD  L  DDD  L ==',
      },
    }),

    // 5 — l'ultimo magazzino murato del mondo, sotto la passerella che
    // finisce. Il gomitolo è dietro la solita lamiera di sinistra: chi ha
    // fatto 2-1, 2-3, 2-4, 2-5 e 2-6 sa già dove guardare, ed è giusto così.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '==     =============',
        9: '       :  *    =====',
        10: '       =============',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 6 — la lastra di collaudo: due sentinelle alle estremità e una palla di
    // ghiaccio nel mezzo, tutte e tre sullo stesso pezzo di pavimento che non
    // frena. Non si scappa indietro e non si scappa avanti.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        12: '  H       &      H',
        13: '===~~~~~~~~~~~~~~===',
        14: FLOOR,
      },
    }),

    // 7 — tre fosse e tre getti, e stavolta i due freddi vengono prima. Chi ha
    // imparato in 2-6 che il vapore buono è l'ultimo, qui ha ragione — ed è la
    // prima volta in tutto il gioco che imparare una cosa serve davvero.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '  ,,     ,,     ^^',
        10: '  ,,     ,,     ^^',
        11: '  ,,     ,,     ^^',
        12: '  ,,     ,,     ^^',
        13: '==   ====   ====   =',
        14: '==   ====   ====   =',
      },
    }),

    // 8 — il corridoio. Tre trappole a terra, tre coppie di lame, e ogni
    // coppia di lame è sopra la sua trappola. Il salto pieno finisce nelle
    // lame e il passo finisce nelle punte: quello che passa sta in mezzo, ed
    // è un tocco secco del tasto. L'ultima delle tre non si vede nemmeno,
    // finché non ti prende la prima volta.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '     YY   YY   YY',
        12: ' S   A    O    !',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 9 — l'uscita del mondo. Una lanterna spenta, una molla che si chiude di
    // scatto, degli spuntoni che non ci sono, e in fondo l'arrivo — che per
    // una volta è davvero l'arrivo.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '      Q        B',
        12: '   N    m    !   W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-8 — "Il pozzo".
 *
 * Il tempio finora si è attraversato di lato. Questo è la parte che scende: i
 * risucchi non sono più un modo di accorciare un salto ma il pavimento del
 * livello, e ogni volta che si va giù bisogna sapere già dove si atterra,
 * perché mentre si scende non si sterza quasi.
 *
 * Il gomitolo sta in una stanza sopra la volta, e ci si arriva **facendosi
 * sollevare**: il muro finto stavolta non è una parete, è un **soffitto**. È
 * l'unico segreto del gioco che non si trova andandoci a sbattere di lato — e
 * chi ha giocato 3-5 sa già che in questo mondo le stanze stanno dalla parte
 * sbagliata delle superfici.
 */

const FLOOR = '-'.repeat(SEGMENT_COLS);
const CEILING = '-'.repeat(SEGMENT_COLS);

export const WORLD_3_8 = defineLevel({
  id: 'w3-8',
  name: '3-8',
  title: 'Il pozzo',
  sky: 'tomb',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — la bocca del pozzo. Il pavimento c'è ancora, e serve solo a far
    // capire che da qui in poi non ci sarà.
    segment({
      rows: {
        0: CEILING,
        12: '         C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — il primo salto in discesa, con il risucchio piazzato sopra il bordo
    // opposto: chi salta lungo viene schiacciato contro la parete e scende
    // dalla parte sbagliata.
    segment({
      rows: {
        0: CEILING,
        8: '            vvv',
        9: '            vvv',
        10: '            vvv',
        11: '   ------   vvv',
        12: '            vvv',
        13: '------      --------',
        14: '------      --------',
      },
    }),

    // 2 — la stanza sopra la volta.
    //
    // Il getto sale fino al soffitto e il soffitto, in una colonna sola, non
    // è un soffitto. Dentro si atterra sulla pietra vera accanto al passaggio;
    // per uscire si torna sul buco e ci si lascia cadere.
    segment({
      rows: {
        0: CEILING,
        4: '   -------',
        5: '   -   * -',
        6: '   -/-----',
        7: '    ^',
        8: '    ^',
        9: '    ^',
        10: '    ^',
        11: '    ^',
        12: '    ^',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 3 — checkpoint, e il pozzo vero: tre risucchi in fila, uno per pozza, che
    // si fermano a mezza altezza. Sopra la sabbia si passa solo restando bassi
    // — il salto pieno entra nella colonna e la colonna lo mette dentro la
    // pozza — quindi qui il rischio non è saltare corto, è saltare bene.
    segment({
      rows: {
        0: CEILING,
        5: '   vvv  vvv  vvv',
        6: '   vvv  vvv  vvv',
        7: '   vvv  vvv  vvv',
        8: '   vvv  vvv  vvv',
        9: '   vvv  vvv  vvv',
        12: ' S',
        13: '---sss--sss--sss----',
        14: '---sss--sss--sss----',
      },
    }),

    // 4 — il fondo: corridoio basso, lame sul soffitto e la piastra in mezzo
    // alla strada. Qui non c'è modo di scavalcarla, si può solo scegliere se
    // pestarla di corsa o da fermi — e cambia tutto.
    segment({
      rows: {
        0: CEILING,
        7: '   TTTTTTTTTTTT',
        10: '--------------------',
        12: '   p',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 5 — la risalita, con le assi marce sopra la pozza e la corrente che
    // spinge verso il buco. Tutto quello che regge, qui, regge per poco.
    segment({
      rows: {
        0: CEILING,
        6: '   DD  DD  DD',
        8: '  ((((((((((((((((((',
        9: '  ((((((((((((((((((',
        13: '---------sssss------',
        14: '---------sssss------',
      },
    }),

    // 6 — la sala della sentinella, con gli spuntoni invisibili sull'unica
    // striscia di pavimento dove verrebbe da aspettarla.
    segment({
      rows: {
        0: CEILING,
        4: '        YYYY',
        12: '     H      !',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 7 — checkpoint, e l'ultima coppia getto-risucchio: stavolta il getto è
    // quello che porta all'uscita, e il risucchio quello che riporta in fondo
    // al pozzo. Sono a due colonne di distanza.
    segment({
      rows: {
        0: CEILING,
        4: '        -----------',
        6: '     ^   v',
        7: '     ^   v',
        8: '     ^   v',
        9: '     ^   v',
        10: '     ^   v',
        11: '     ^   v',
        12: ' S   ^   v',
        13: '-----  ---  --------',
        14: '-----  ---  --------',
      },
    }),

    // 8 — il ballatoio d'uscita, con i mattoni sopra e la scala di lastre
    // fantasma. Le lastre non reggono: la scala vera è quella di pietra, ed è
    // più stretta.
    segment({
      rows: {
        0: CEILING,
        5: '   TTTTTTTT',
        7: '     LLL',
        9: '   ---',
        11: '        ---',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 9 — l'uscita del pozzo. Due bandiere, una lanterna spenta e il pezzo di
    // niente: il tempio non cambia i saluti nemmeno quando finisce.
    segment({
      rows: {
        0: CEILING,
        11: '     F        W',
        12: '  N  F   !    W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

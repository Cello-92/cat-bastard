import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-9 — "Due piani, e nessuno dei due arriva in fondo".
 *
 * Il livello è costruito su un'idea sola: ci sono due strade parallele — il
 * pavimento in basso e la passerella in alto — e **nessuna delle due arriva
 * fino all'arrivo**. Ogni tre o quattro segmenti quella su cui stai si
 * interrompe, e l'unico modo di proseguire è passare all'altra. Salire si fa
 * con un campo, scendere si fa cadendo, e tutte e due le cose vanno fatte nel
 * punto giusto perché il punto sbagliato è sempre a due colonne di distanza.
 *
 * Non c'è niente di nuovo qui dentro. C'è che per la prima volta il giocatore
 * deve scegliere **dove stare**, invece di subire la stanza in cui si trova, e
 * la scelta va fatta prima: quando si vede che la strada finisce, di solito è
 * troppo tardi per tornare indietro a prendere la colonna.
 *
 * Niente gomitolo. Questo livello è il ripasso, e il ripasso non si paga.
 */

const LOW = 'b'.repeat(SEGMENT_COLS);
const UP = 'b'.repeat(SEGMENT_COLS);
const FIELD = 'u'.repeat(SEGMENT_COLS);

export const WORLD_4_9 = defineLevel({
  id: 'w4-9',
  name: '4-9',
  title: 'Due piani, e nessuno dei due arriva in fondo',
  sky: 'reverse',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — i due piani si vedono tutti e due da subito: il pavimento sotto i
    // piedi e la pietra sopra la testa, con lo spazio in mezzo. Fin qui si
    // cammina e basta.
    segment({
      rows: {
        2: UP,
        9: '            B',
        12: '   C      C',
        13: LOW,
        14: LOW,
      },
    }),

    // 1 — il pavimento finisce, e c'è una colonna sola per salire. È vera, e
    // lo dice la zavorra appoggiata al soffitto: è l'ultima volta in questo
    // livello che l'informazione arriva così comoda.
    segment({
      rows: {
        2: UP,
        3: '           uuzuuuuuuu',
        4: '           uuuuuuuuuu',
        5: '           uuuuuuuuuu',
        6: '           uuuuuuuuuu',
        7: '           uuuuuuuuuu',
        8: '           uuuuuuuuuu',
        9: '           uuuuuuuuuu',
        10: '           uuuuuuuuuu',
        11: '        E  uuuuuuuuuu',
        12: '           uuuuuuuuuu',
        13: 'bbbbbbbbbbb',
        14: 'bbbbbbbbbbb',
      },
    }),

    // 2 — di sopra, con un ragno e una lama. Sotto, il vuoto: da qui non si
    // scende più, e chi si stacca non trova niente.
    segment({
      rows: {
        2: UP,
        3: 'uuuauuuuuYuuuuuuuuau',
        4: FIELD,
        5: FIELD,
        6: FIELD,
        7: FIELD,
        8: FIELD,
        9: FIELD,
        10: FIELD,
        11: FIELD,
        12: FIELD,
      },
    }),

    // 3 — la passerella si interrompe, e sotto ricompare il pavimento. Non è
    // una scelta: è l'unico posto in cui si può scendere per venti colonne, e
    // il checkpoint sta lì per dire che è il posto giusto.
    segment({
      rows: {
        2: 'bbbbbbbb            ',
        3: 'uuuuuuuu            ',
        4: 'uuuuuuuu            ',
        5: 'uuuuuuuu            ',
        6: 'uuuuuuuu            ',
        7: 'uuuuuuuu            ',
        8: 'uuuuuuuu            ',
        9: 'uuuuuuuu            ',
        10: 'uuuuuuuu            ',
        11: 'uuuuuuuu            ',
        12: 'uuuuuuuu     S',
        13: '        bbbbbbbbbbbb',
        14: '        bbbbbbbbbbbb',
      },
    }),

    // 4 — a terra, e a terra ci sono le cose di terra: il masso che crolla,
    // l'asse che si sbriciola, la molla che si chiude. Il soffitto sopra la
    // testa è tornato a essere un soffitto e le lame fanno di nuovo il loro
    // mestiere di sempre.
    segment({
      rows: {
        5: '        K',
        7: '   YYY      YYYY',
        11: '              N',
        12: '  m       C',
        13: 'bbbbDDbbbbbbbbbbbbbb',
        14: LOW,
      },
    }),

    // 5 — due colonne per risalire e una sola è vera, ma questa volta il
    // cartello è un pendolo e sta dentro quella **sbagliata**: pende in giù,
    // quindi lì il campo è spento. È la stessa informazione di sempre, detta
    // per esclusione.
    segment({
      rows: {
        2: '   bbbb      bbbbbb ',
        3: '   nnnn      uuuuuu ',
        4: '   nnnn      uuuuuu ',
        5: '   nnnn      uuuuuu ',
        6: '   nnnn      uuuuuu ',
        7: '   nnbn      uuuuuu ',
        8: '   nntn      uuuuuu ',
        9: '   nnnn      uuuuuu ',
        10: '   nnnn      uuuuuu ',
        11: '   nnnn      uuuuuu ',
        12: '   nnnn      uuuuuu ',
        13: LOW,
        14: LOW,
      },
    }),

    // 6 — di sopra, e la passerella ha tre buchi. Sotto ce n'è ancora, di
    // pavimento, ma non sotto tutti e tre: due sono cadute da dieci righe e
    // una è una caduta e basta.
    segment({
      rows: {
        2: 'bbbb bbbbb bbbbb bbb',
        3: 'uuuu uuuuu uuuuu uuu',
        4: 'uuuu uuuuu uuuuu uuu',
        5: 'uuuu uuuuu uuuuu uuu',
        6: 'uuuu uuuuu uuuuu uuu',
        7: 'uuuu uuuuu uuuuu uuu',
        8: 'uuuu uuuuu uuuuu uuu',
        9: 'uuuu uuuuu uuuuu uuu',
        10: 'uuuu uuuuu uuuuu uuu',
        11: 'uuuu uuuuu uuuuu uuu',
        12: 'uuuu uuuuu uuuuu uuu',
        13: 'bbbbbb    bbbbbb',
        14: 'bbbbbb    bbbbbb',
      },
    }),

    // 7 — checkpoint di sopra, e la passerella prosegue sopra il vuoto pieno.
    // Due pendoli capovolti e un ragno in mezzo: il ragno cammina fra i due
    // pendoli e non ha nessuna intenzione di uscirne.
    segment({
      rows: {
        2: UP,
        3: 'uSuuuuuuuuauuuuuuuuu',
        4: FIELD,
        5: FIELD,
        6: FIELD,
        7: 'uuuutuuuuuuuuuutuuuu',
        8: 'uuuubuuuuuuuuuubuuuu',
        9: FIELD,
        10: FIELD,
        11: FIELD,
        12: FIELD,
      },
    }),

    // 8 — l'ultimo cambio di piano, ed è il peggiore: la passerella finisce e
    // sotto c'è pavimento per sole quattro colonne, con il vuoto prima e
    // dopo. Bisogna staccarsi al momento giusto e non correggere più.
    segment({
      rows: {
        2: UP,
        3: 'uuuuuuuuuu          ',
        4: 'uuuuuuuuuu          ',
        5: 'uuuuuuuuuu          ',
        6: 'uuuuuuuuuu          ',
        7: 'uuuuuuuuuu          ',
        8: 'uuuuuuuuuu          ',
        9: 'uuuuuuuuuu          ',
        10: 'uuuuuuuuuu          ',
        11: 'uuuuuuuuuu          ',
        12: 'uuuuuuuuuu          ',
        13: '        bbbb        ',
        14: '        bbbb        ',
      },
    }),

    // 9 — le ultime colonne sono attaccate al pavimento su cui si è appena
    // atterrati e portano tutte in alto, dove c'è l'arrivo. Una sola è vera, e
    // la zavorra sta lì da prima che tu cadessi: si vedeva anche da lassù.
    segment({
      rows: {
        2: 'bbbb bbbb bbbbbbbbbb',
        3: 'nnnn nnnn uuuuWuuuuu',
        4: 'nnnn nnnn uuzuuuuuuu',
        5: 'nnnn nnnn uuuuuuuuuu',
        6: 'nnnn nnnn uuuuuuuuuu',
        7: 'nnnn nnnn uuuuuuuuuu',
        8: 'nnnn nnnn uuuuuuuuuu',
        9: 'nnnn nnnn uuuuuuuuuu',
        10: 'nnnn nnnn uuuuuuuuuu',
        11: 'nnnn F    uuuuuuuuuu',
        12: 'nnnn F    uuuuuuuuuu',
        13: LOW,
        14: LOW,
      },
    }),
  ],
});

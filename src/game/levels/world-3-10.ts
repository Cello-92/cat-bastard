import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-10 — "L'anticamera".
 *
 * È l'esame, come lo erano 1-10 e 2-10: niente di nuovo, tutto insieme. Ogni
 * segmento prende due cose che il mondo ha spiegato separatamente e le mette
 * nello stesso posto — la piastra e la pozza, la corrente e le lame, il getto e
 * il risucchio — e l'unica cosa che serve per passarlo è ricordarsi quale delle
 * due arriva prima.
 *
 * In fondo c'è la porta della sala grande, e dietro la porta c'è quello che ha
 * costruito tutto questo. Ma quello è un altro livello.
 */

const FLOOR = '-'.repeat(SEGMENT_COLS);
const CEILING = '-'.repeat(SEGMENT_COLS);

export const WORLD_3_10 = defineLevel({
  id: 'w3-10',
  name: '3-10',
  title: 'L\'anticamera',
  sky: 'tomb',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — l'ingresso è largo e vuoto, e non lo è mai stato in tutto il mondo:
    // serve a far capire che questa è la sala buona, quella che porta da
    // qualche parte.
    segment({
      rows: {
        0: CEILING,
        12: '       C   C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — piastra e pozza, la prima coppia. La lastra sta prima del salto:
    // pestarla vuol dire attraversare la sabbia mentre viene giù il soffitto,
    // e la sabbia non si attraversa di corsa.
    segment({
      rows: {
        0: CEILING,
        7: '      TTTTTTTTT',
        13: '--p-----ssss--------',
        14: '--------ssss--------',
      },
    }),

    // 2 — corrente e lame. La corrente porta avanti, le lame stanno in alto
    // dove uno arriva se si fa portare: è la stessa spinta di sempre, letta da
    // chi ha dimenticato di guardare il soffitto.
    segment({
      rows: {
        0: CEILING,
        4: '      YYYYYYYY',
        8: '  ))))))))))))))))))',
        9: '  ))))))))))))))))))',
        13: '-----XXXX-----------',
        14: FLOOR,
      },
    }),

    // 3 — checkpoint, e la coppia verticale: il getto porta al ballatoio, il
    // risucchio riporta giù, e in mezzo ci sono tre lastre che reggono per tre
    // tick. Il ballatoio è la strada; le lastre sono l'esca.
    segment({
      rows: {
        0: CEILING,
        5: '        LLL',
        6: '            --------',
        7: '     ^       v',
        8: '     ^       v',
        9: '     ^       v',
        10: '     ^       v',
        11: '     ^       v',
        12: ' S   ^       v',
        13: '-----  ------  -----',
        14: '-----  ------  -----',
      },
    }),

    // 4 — la sentinella e gli spuntoni invisibili, con la lanterna che non si
    // accende messa esattamente dove uno vorrebbe salvare prima di passare.
    segment({
      rows: {
        0: CEILING,
        12: '    H      !     N',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 5 — la corsa lunga: si atterra sulla piastra e da lì in poi il soffitto
    // scende alle spalle per dodici colonne, con la pozza a metà strada. È il
    // pezzo più lungo di tutto il mondo in cui non si può stare fermi.
    segment({
      rows: {
        0: CEILING,
        8: '    TTTTTTTTTTT',
        13: '-   p---ssss--------',
        14: '-   ----ssss--------',
      },
    }),

    // 6 — risucchi e scarabei sopra le pozze: le bestie volano dentro le
    // colonne e ci restano, quindi indicano esattamente dove non passare.
    segment({
      rows: {
        0: CEILING,
        6: '   vvv  k    vvv',
        7: '   vvv       vvv',
        8: '   vvv       vvv',
        9: '   vvv       vvv',
        13: '---sss--------sss---',
        14: '---sss--------sss---',
      },
    }),

    // 7 — checkpoint, la molla sotto le lame e la moneta che non è una moneta.
    // Tutte trappole del primo mondo, ed è il punto: sono ancora buone.
    segment({
      rows: {
        0: CEILING,
        4: '        YYYY',
        12: ' S       M      E',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 8 — l'ultima salita: scala di pietra, assi marce, e in cima la piastra
    // che sgancia il soffitto sopra la scala che hai appena fatto. Scendere non
    // è più previsto.
    segment({
      rows: {
        0: CEILING,
        5: '        TTTTTTTT',
        7: '           DD',
        9: '       ---p',
        11: '   ---',
        13: '-----   ------------',
        14: '-----   ------------',
      },
    }),

    // 9 — la porta della sala grande. Due bandiere come sempre, e come sempre
    // una delle due è solo un pezzo di stoffa appeso male.
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

import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-4 — "La sala delle piastre".
 *
 * 3-2 aveva una piastra a pressione per far capire cos'è. Qui ce ne sono
 * cinque, e il livello è costruito su una sola domanda ripetuta cinque volte:
 * **pestarla o scavalcarla?** Perché quasi sempre si può fare tutte e due le
 * cose, e quasi mai è ovvio quale delle due conviene — un soffitto che viene
 * giù dietro di te è una cosa che hai lasciato alle spalle, un soffitto ancora
 * carico è una cosa che ti aspetta.
 *
 * Non c'è nessun gomitolo, e non è una dimenticanza: dopo la rovina di 3-3 una
 * parete che sembra finta deve poter essere solo una parete, o cercarle smette
 * di essere cercare (CLAUDE.md, "I segreti e i gatti").
 */

const FLOOR = '-'.repeat(SEGMENT_COLS);
const CEILING = '-'.repeat(SEGMENT_COLS);

export const WORLD_3_4 = defineLevel({
  id: 'w3-4',
  name: '3-4',
  title: 'La sala delle piastre',
  sky: 'tomb',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — l'anticamera, con la prima piastra piazzata in mezzo al niente e
    // dodici mattoni che non si vedono da qui. Pestarla adesso costa poco:
    // serve a ricordare cosa fa, prima che smetta di costare poco.
    segment({
      rows: {
        0: CEILING,
        9: '           TTTTTTTT',
        12: '     C',
        13: '-------p------------',
        14: FLOOR,
      },
    }),

    // 1 — due piastre di fila su un pavimento senza vie di scampo, e sopra un
    // solo mattone. Una delle due non serve a niente, ma per saperlo bisogna
    // averle pestate tutte e due — cioè bisogna essere già morti una volta.
    segment({
      rows: {
        0: CEILING,
        8: '        T',
        13: '--p-----------p-----',
        14: FLOOR,
      },
    }),

    // 2 — la pozza sotto il corridoio dei mattoni: si attraversa nuotando o
    // saltando, e in tutti e due i casi mentre viene giù la volta.
    segment({
      rows: {
        0: CEILING,
        8: '   TTTTTTTTT',
        13: '--p----ssss---------',
        14: '-------ssss---------',
      },
    }),

    // 3 — checkpoint. Il pozzo di vapore sale fino alla galleria alta, che è
    // l'unico posto del livello dove il soffitto non ha mattoni: sopra la
    // testa non c'è niente, e per una volta è vero.
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

    // 4 — la sentinella nel corridoio stretto, con le lame a soffitto sopra
    // il punto in cui verrebbe voglia di saltarla. Non si schiaccia, quindi
    // l'unica risposta è passarle accanto quando è impegnata a caricare.
    segment({
      rows: {
        0: CEILING,
        4: '      YYYYYY',
        12: '    H        !',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 5 — le correnti dentro il tempio: due condotti d'aria opposti e uno
    // scarabeo per condotto, sopra una fossa di punte. Il salto va cominciato
    // nel primo e finito nel secondo.
    segment({
      rows: {
        0: CEILING,
        9: '  ))))))  ((((((',
        10: '  ))k)))  (((k((',
        13: '---XXXX-----XXX-----',
        14: FLOOR,
      },
    }),

    // 6 — la piastra sul punto d'atterraggio: si arriva di salto e ci si
    // atterra sopra per forza, a meno di saltare più lungo di quanto sembri
    // necessario. Da lì in poi il corridoio è tutto in discesa, letteralmente.
    segment({
      rows: {
        0: CEILING,
        8: '     TTTTTTTTTTT',
        13: '-   p---------------',
        14: '-   ----------------',
      },
    }),

    // 7 — checkpoint, il risucchio sopra la pozza e l'asse marcia sopra il
    // risucchio: tre cose che vanno tutte nella stessa direzione, cioè giù.
    segment({
      rows: {
        0: CEILING,
        7: '      DD    DD',
        10: '        vvvv',
        11: '        vvvv',
        12: ' S      vvvv',
        13: '--------ssss--------',
        14: '--------ssss--------',
      },
    }),

    // 8 — l'ultima salita, e l'ultima piastra: sta in cima, dove si arriva
    // stanchi, e i mattoni che sgancia sono quelli sopra la strada per
    // l'uscita. Non pestarla è possibile. Accorgersene, meno.
    segment({
      rows: {
        0: CEILING,
        6: '         TTTTTTT',
        9: '     ----p',
        11: '  ---',
        13: '-----   ------------',
        14: '-----   ------------',
      },
    }),

    // 9 — l'uscita: due bandiere, una lanterna che non si accende e il solito
    // niente per terra. Il tempio non ha imparato niente, e nemmeno tu.
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

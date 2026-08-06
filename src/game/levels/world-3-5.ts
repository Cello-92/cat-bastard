import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-5 — "Sotto la sabbia".
 *
 * Fin qui le pozze sono state una cosa da evitare: ci si cade dentro per
 * sbaglio e si nuota per uscirne. Questo livello le mette al centro e chiede la
 * cosa opposta — misurare quanto si affonda, e ogni tanto affondare apposta.
 *
 * Il gomitolo del segmento 2 è l'unico posto di tutto il gioco in cui la mossa
 * giusta è **lasciarsi andare**: sotto quella pozza c'è una camera, e l'unico
 * modo di entrarci è smettere di dimenarsi. Non c'è nessun indizio che ci sia,
 * e non serve: chi ha capito come funziona la sabbia sa già che il fondo di una
 * pozza è un posto dove si può arrivare, e prima o poi ci prova.
 *
 * Da qui in poi il mondo 3 non spiega più niente (vale la stessa regola del
 * mondo 2 da 2-6 in avanti): correnti, risucchi, sabbia e scarabei si trovano
 * già insieme, e sta al giocatore ricordarsi quale batte quale.
 */

const FLOOR = '.'.repeat(SEGMENT_COLS);

export const WORLD_3_5 = defineLevel({
  id: 'w3-5',
  name: '3-5',
  title: 'Sotto la sabbia',
  sky: 'desert',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — la prima pozza è larga e bassa, e si vede da lontano: serve a far
    // decidere se saltarla o attraversarla. Sono tutte e due risposte giuste,
    // e questa è l'ultima volta.
    segment({
      rows: {
        12: '            C',
        13: '......ssss..........',
        14: '......ssss..........',
      },
    }),

    // 1 — le isole. Le pozze sono strette e i sassi in mezzo sono uno solo per
    // volta: chi salta lungo finisce nella seconda, chi salta corto nella
    // prima, e affondare costa comunque un secondo che qui non c'è.
    segment({
      rows: {
        8: '        ))))))))',
        9: '        ))))))))',
        12: '     C',
        13: '...sss..sss..sss....',
        14: '...sss..sss..sss....',
      },
    }),

    // 2 — l'altopiano con la pozza in mezzo, e sotto la pozza una camera.
    //
    // È l'unico segreto del gioco che non sta dietro un muro: sta sotto, e per
    // arrivarci bisogna fare l'unica cosa che il livello ha passato quattro
    // segmenti a insegnarti a non fare. Si torna su nuotando, dalla stessa
    // pozza.
    segment({
      rows: {
        11: '     ....ssss.......',
        12: '     ....ssss.......',
        13: '.........  * .......',
        14: FLOOR,
      },
    }),

    // 3 — checkpoint, e il risucchio piazzato sopra la pozza: entrarci non è
    // una scelta, la scelta è a che velocità ci si arriva.
    segment({
      rows: {
        7: '          vvvv',
        8: '          vvvv',
        9: '          vvvv',
        10: '          vvvv',
        12: ' S',
        13: '.........ssss.......',
        14: '.........ssss.......',
      },
    }),

    // 4 — le punte sotto, gli scogli di sabbia sopra, e uno scarabeo che passa
    // in mezzo. Schiacciarlo è la strada comoda; mancarlo è finire dove finisce
    // tutto il resto.
    segment({
      rows: {
        9: '      k',
        12: '    ..    ..    ..',
        13: '...XXX..XXX..XXX....',
        14: FLOOR,
      },
    }),

    // 5 — la corrente morta sopra la pozza più larga. Disegnata a favore,
    // quindi si salta piano: si arriva in mezzo alla sabbia, e da lì in mezzo
    // non si esce in tempo.
    segment({
      rows: {
        9: '    wwwwwww',
        10: '    wwwwwww',
        11: '    wwwwwww',
        12: '    wwwwwww',
        13: '....sssss...........',
        14: '....sssss...........',
      },
    }),

    // 6 — la molla piazzata dove si atterra dopo la pozza: si scavalca la
    // sabbia, si tira il fiato, e il piede finisce lì. Sopra ci sono le lame, e
    // scendere dalla parte sbagliata vuol dire tornare nella sabbia con tutta
    // la velocità che la molla ti ha dato addosso.
    segment({
      rows: {
        4: '        YYYY',
        12: '         M',
        13: '.....sss............',
        14: '.....sss............',
      },
    }),

    // 7 — checkpoint, la sentinella nel corridoio e gli spuntoni a scatto
    // sull'unica striscia di terreno buono. Nessuna pozza: dopo cinque
    // segmenti di sabbia, il pericolo è essersi disabituati al pavimento.
    segment({
      rows: {
        12: ' S      H',
        13: '.....AA......AA.....',
        14: FLOOR,
      },
    }),

    // 8 — la salita finale sulle rovine, con l'asse marcia sopra la pozza e la
    // corrente a favore che a questo punto non si crede più.
    segment({
      rows: {
        6: '         DDD',
        9: '   ---',
        10: '            ))))',
        11: '            ))))',
        13: '......ssss..........',
        14: '......ssss..........',
      },
    }),

    // 9 — l'arrivo. La bandiera sbagliata, e sotto la giusta un pezzetto di
    // niente che a questo punto è tradizione.
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

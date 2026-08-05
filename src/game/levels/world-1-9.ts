import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 1-9 — "Sotto la grotta c'è la fabbrica".
 *
 * La grotta di 1-4 aveva una regola sola e bastava: c'è un soffitto, quindi il
 * salto non è più la risposta a tutto. Qui il soffitto c'è ancora e in più il
 * pavimento si muove, che è il modo più corto per spiegare perché questo
 * livello viene dopo.
 *
 * Un nastro in un corridoio alto un gatto è una cosa diversa da un nastro
 * all'aperto: non si può saltare per uscirne, non si può accelerare oltre, si
 * può solo camminarci contro. E siccome il nastro decide anche dove ci si
 * ferma, tutte le trappole a scatto — piastre, spuntoni nascosti, tagliole —
 * qui valgono il doppio: non basta sapere dove sono, bisogna sapere dove sarai
 * tu quando il nastro avrà finito di spostarti.
 */

/** Volta e pavimento della grotta: roccia nuda, come in 1-4. */
const CEILING = 'R'.repeat(SEGMENT_COLS);
const FLOOR = CEILING;

export const WORLD_1_9 = defineLevel({
  id: 'w1-9',
  name: '1-9',
  title: "Sotto la grotta c'è la fabbrica",
  sky: 'cave',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — l'imbocco, con il primo nastro della miniera. Va nel verso giusto e
    // non c'è niente in fondo: serve solo a far prendere il ritmo sbagliato.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        13: 'RRRRRR>>>>>>>>RRRRRR',
        14: FLOOR,
      },
    }),

    // 1 — strettoia: lame sopra, piastre sotto, nastro che spinge verso le
    // piastre. Il tempo per saltare c'è, ma è quello che il nastro concede.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: '     YY      YY',
        12: '    A    O     A',
        13: '>>>>>>>>>>>>>>>>####',
        14: FLOOR,
      },
    }),

    // 2 — il primo vuoto della miniera, scavalcato su assi. Quella di mezzo
    // non c'è, e il nastro dell'ultima riparte verso il buco.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        10: '  DD   LD   DD   <<',
        13: 'RR                RR',
        14: 'RR                RR',
      },
    }),

    // 3 — colonia di bestie appese sopra un nastro contrario: si cammina
    // piano, e loro cadono in base a dove sei, non a quanto ci hai messo.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        3: '   Z    Z     Z',
        12: '           !',
        13: '<<<<<<<<<<<<<<RRRRRR',
        14: FLOOR,
      },
    }),

    // 4 — la lanterna vera, per una volta subito dopo il pezzo peggiore. E
    // subito dopo la lanterna, la tagliola: il gioco non regala due cose di
    // fila.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        12: '   S      m      G',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 5 — la sala macchine: due nastri che si vengono incontro. Qualunque cosa
    // si faccia si finisce in mezzo, e in mezzo non c'è niente da vedere —
    // motivo per cui è lì che sono gli spuntoni. Il masso sopra completa
    // l'idea: fermarsi è la cosa peggiore, ma anche correre lo è.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: '         K',
        12: '  O        !     O',
        13: 'RRR>>>>>><<<<<<<RRRR',
        14: FLOOR,
      },
    }),

    // 6 — corridoio delle lame, versione fabbrica: il soffitto è chiodato a
    // scacchiera e il pavimento alterna nastro e piastre.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: '  YY   YY   YY   YY',
        12: '     A      A     O',
        13: 'RRR>>>>>>>>>>>RRRRRR',
        14: FLOOR,
      },
    }),

    // 7 — la bandiera in fondo al pozzo di luce. Le monete sotto sono due
    // buone e una avvelenata, e servono solo a farti avvicinare.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        7: '              F',
        8: '              F',
        9: '              F',
        10: '           C E C',
        12: '  J   AA         !',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 8 — il ponte della miniera: due assi marce, una fantasma, e sotto la
    // fossa. Sopra, i mattoni armati che aspettano il passaggio.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        6: '    T     T',
        10: '  RR  DD  LD  DD  RR',
        13: 'RRRR            RRRR',
        14: 'RRRR            RRRR',
      },
    }),

    // 9 — l'uscita, in fondo all'ultimo nastro. Il nastro va verso l'arrivo:
    // è l'unica volta in tutto il gioco che una cosa aiuta senza chiedere
    // niente in cambio, e succede a due passi dalla fine per un motivo.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        12: 'S    m   !',
        13: 'RRR>>>>>>>>>>>RRRRRR',
        14: FLOOR,
      },
    }),

    // 10 — l'arrivo vero, appena fuori dal nastro.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '     Q',
        12: '   O     W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-6 — "Il tempio ha finito di spiegare".
 *
 * È il livello che nel mondo 2 era 2-6: da qui in poi non si insegna più
 * niente, si chiede il conto. Ogni cosa del mondo 3 è già stata mostrata da
 * sola almeno una volta — corrente, risucchio, sabbia, piastra, scarabeo — e
 * qui compaiono a coppie, che è il punto: due regole che si sono imparate una
 * per volta si combinano in un modo che nessuna delle due prevedeva.
 *
 * La combinazione che regge il livello è quella del segmento 5: una corrente
 * contraria sopra una fila di piastre. Ogni salto che non tocca terra è un
 * salto che il vento accorcia, quindi ogni piastra scavalcata costa velocità —
 * e la velocità è esattamente quello che serve per non farsi prendere dal
 * soffitto che si è appena sganciato.
 *
 * Niente gomitolo, come in 3-4.
 */

const FLOOR = '-'.repeat(SEGMENT_COLS);
const CEILING = '-'.repeat(SEGMENT_COLS);

export const WORLD_3_6 = defineLevel({
  id: 'w3-6',
  name: '3-6',
  title: 'Il tempio ha finito di spiegare',
  sky: 'tomb',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — si entra in discesa, con la volta bassa e una moneta messa lì per
    // ricordare che le monete esistono. Non tutte, però.
    segment({
      rows: {
        0: CEILING,
        12: '        C   E',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — condotto d'aria contrario sopra la fossa: il primo salto del livello
    // è già uno di quelli che vanno cominciati da più indietro.
    segment({
      rows: {
        0: CEILING,
        10: '      ((((((((',
        11: '      ((((((((',
        13: '------    ----------',
        14: '------    ----------',
      },
    }),

    // 2 — la pozza sotto il risucchio, con i mattoni sopra: tre cose che
    // spingono nella stessa direzione, e la direzione è il fondo.
    segment({
      rows: {
        0: CEILING,
        6: '     TTTTTT',
        9: '       vvvv',
        10: '       vvvv',
        11: '       vvvv',
        12: '       vvvv',
        13: '-------ssss---------',
        14: '-------ssss---------',
      },
    }),

    // 3 — checkpoint, e lo scarabeo nel condotto sopra le punte. Qui la bestia
    // non è un ostacolo: è l'unico modo di sapere quanto tira, prima di
    // buttarsi. Chi non la guarda salta a occhio, e a occhio non basta.
    segment({
      rows: {
        0: CEILING,
        9: '   )))))))  ((((((((',
        10: '   ))k))))  (((((k((',
        12: ' S',
        13: '-------XXXX---XXX---',
        14: FLOOR,
      },
    }),

    // 4 — la sala delle lastre fantasma: quello che sembra pavimento sopra la
    // fossa dura tre tick. Il pavimento vero è quello brutto, in basso.
    segment({
      rows: {
        0: CEILING,
        9: '   LLL   LLL   LLL',
        13: '---   ---   ---   --',
        14: '---   ---   ---   --',
      },
    }),

    // 5 — il cuore del livello: tre piastre in fila, e sopra una corrente
    // contraria. Scavalcarle costa velocità perché il vento la mangia; pestarle
    // costa un soffitto. Non esiste la risposta comoda, esiste quella scelta
    // prima invece che durante.
    segment({
      rows: {
        0: CEILING,
        7: '   TTTTTTTTTTTTTT',
        10: '  ((((((((((((((((((',
        11: '  ((((((((((((((((((',
        13: '---p----p----p------',
        14: FLOOR,
      },
    }),

    // 6 — la molla nel pozzo, e in cima le lame. La via giusta è di fianco, ma
    // la molla è esattamente sulla linea in cui si arriva di corsa.
    segment({
      rows: {
        0: CEILING,
        4: '     YYYYYY',
        12: '      M    N',
        13: '------------ssss----',
        14: '------------ssss----',
      },
    }),

    // 7 — checkpoint, sentinella e spuntoni invisibili nello stesso corridoio.
    // Il corridoio è largo abbastanza per tutti e tre, ma non tutto insieme.
    segment({
      rows: {
        0: CEILING,
        12: ' S    H      !',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 8 — l'ultima salita: assi marce sopra la pozza, risucchio sopra le assi,
    // e l'ultima piastra in cima, dove il fiato è già finito.
    segment({
      rows: {
        0: CEILING,
        5: '        TTTTTT',
        7: '     DD    DD',
        9: '       vvv',
        10: '       vvv',
        11: '   ---p',
        13: '-----ssss-----------',
        14: '-----ssss-----------',
      },
    }),

    // 9 — l'uscita, con la coppia di bandiere e la lanterna che non si accende.
    // Il tempio saluta esattamente come ha salutato le altre tre volte, e
    // funziona ancora.
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

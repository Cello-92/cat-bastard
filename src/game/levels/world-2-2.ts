import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-2 — "La fabbrica non si è mai fermata".
 *
 * Sotto la neve c'era questo: un capannone che macina da solo da chissà
 * quanto, con i nastri che girano, i getti che sbuffano e le sentinelle che
 * continuano il loro giro senza sapere che non c'è più niente da sorvegliare.
 *
 * È il livello in cui il mondo nuovo smette di essere "il primo mondo col
 * ghiaccio": qui il pavimento si muove, l'aria spinge, e per la prima volta
 * c'è un posto dove il salto non basta e bisogna *farsi portare*. Il getto di
 * vapore è l'unico modo di salire al ballatoio — e due segmenti dopo ce n'è
 * uno identico che non spinge niente.
 */

const CEILING = '='.repeat(SEGMENT_COLS);
const FLOOR = CEILING;

export const WORLD_2_2 = defineLevel({
  id: 'w2-2',
  name: '2-2',
  title: 'La fabbrica non si è mai fermata',
  sky: 'foundry',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — l'ingresso. Lamiera sopra, lamiera sotto, e il rumore di qualcosa
    // che gira più avanti.
    segment({
      rows: { 0: CEILING, 1: CEILING, 13: FLOOR, 14: FLOOR },
    }),

    // 1 — il primo nastro va nel verso giusto, ed è l'ultima gentilezza del
    // livello: ti porta più veloce di quanto pensi, e alla fine della corsa
    // c'è qualcosa nel pavimento che non aspettava altro. Le lame sopra
    // vietano il salto pieno proprio dove servirebbe.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '      YY      YY',
        12: '                 O',
        13: '===>>>>>>>>>>=======',
        14: FLOOR,
      },
    }),

    // 2 — la sentinella. Cammina piano, si accorge di te da lontano, si pianta
    // un attimo — quello è tutto il preavviso — e poi ti viene addosso. Ha
    // l'elmo chiodato in bella vista: schiacciarla è una scelta, non una svista.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        10: '   ====',
        12: '           H',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 3 — il muro del ballatoio: quattro tile netti, più alti di qualunque
    // salto. Non è un errore di progettazione, è l'esame sul getto di vapore —
    // che si supera in un modo solo, restandoci dentro finché ti solleva.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        5: '              ^^',
        6: '              ^^',
        7: '              ^^',
        8: '              ^^',
        9: '              ^^ ===',
        10: '              ^^ ===',
        11: '              ^^ ===',
        12: '              ^^ ===',
        13: '=============== ====',
        14: '=============== ====',
      },
    }),

    // 4 — il ballatoio. Checkpoint appena saliti, e poi un nastro che spinge
    // indietro sopra il vuoto: qui sotto non c'è più pavimento, e la corsa
    // contro il nastro è tutto il segmento.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '  S',
        9: '====<<<<<<<<<<<=====',
      },
    }),

    // 5 — due getti identici sopra due buchi identici. Uno solleva. L'altro è
    // vapore freddo: fa scena e basta. Non c'è modo di distinguerli prima —
    // ma entrambi i buchi si scavalcano anche saltando, per chi non si fida
    // dell'aria calda.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '        ^^       ,,',
        10: '        ^^       ,,',
        11: '        ^^       ,,',
        12: '        ^^       ,,',
        13: '=======    =====',
        14: '=======    =====',
      },
    }),

    // 6 — il magazzino chiuso. Sta su un soppalco fuori dalla strada normale,
    // è murato da tutti i lati, e una delle lamiere non è imbullonata a
    // niente: ci si passa attraverso. Dentro c'è il gomitolo. Nessuno ci
    // finisce per caso — ci si arriva solo salendo apposta.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '     ===============',
        9: '     :   *    ======',
        10: '     ===============',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 7 — la pattuglia: due sentinelle sullo stesso piano e un drone che
    // taglia la strada in mezzo. Caricano una alla volta, e il punto dove si
    // incrociano è l'unico posto in cui non si può stare.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '        %',
        12: '   H          H',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 8 — checkpoint, e il tubo che perde: dentro la fabbrica il ghiaccio si
    // forma dove gocciola, quindi esattamente prima della fossa. Sulla lastra
    // c'è anche una piastra a scatto, e sul ghiaccio non ci si ferma.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        12: '  S    A',
        13: '====~~~~~~~~~~~~~XX=',
        14: FLOOR,
      },
    }),

    // 9 — l'uscita. Il blocco premio onesto è lì per ricordare che uno su due
    // lo è; gli spuntoni invisibili per ricordare tutto il resto.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '      Q',
        12: '     !     !  W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

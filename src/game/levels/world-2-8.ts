import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-8 — "Il magazzino dei ricambi".
 *
 * Il livello che si gioca in alto. Fino a qui il mondo 2 aveva un pavimento e
 * qualche ballatoio; qui il pavimento finisce alla terza schermata e non torna
 * più per metà livello — sotto le passerelle c'è la campata del capannone, e
 * la campata non ha fondo.
 *
 * La trappola portante è quella che in 2-3 e in 2-5 era un dettaglio in mezzo
 * al ponte: la lamiera che sparisce in tre tick. Qui ce n'è una per ogni buco,
 * sempre nel punto esatto in cui la gamba vorrebbe appoggiarsi a metà salto, e
 * sempre in un buco che si scavalca benissimo ignorandola.
 *
 * Il gomitolo sta nella cassa murata al piano di sotto, che è l'unico motivo
 * per scendere quando tutto il livello chiede di salire.
 */

const CEILING = '='.repeat(SEGMENT_COLS);
const FLOOR = CEILING;

export const WORLD_2_8 = defineLevel({
  id: 'w2-8',
  name: '2-8',
  title: 'Il magazzino dei ricambi',
  sky: 'foundry',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — la rampa di carico. Pavimento vero, ed è l'ultima volta per un po'.
    segment({ rows: { 0: CEILING, 1: CEILING, 13: FLOOR, 14: FLOOR } }),

    // 1 — la prima scaffalatura: ci si può salire sopra o passarci sotto, e
    // per una volta non cambia niente. Il drone fa il suo giro sempre uguale,
    // e in fondo alla corsia c'è la piastra che scatta a cose fatte.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '      %',
        10: '    ========',
        12: '                O',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 2 — e il pavimento finisce. Da qui si va di scaffale in scaffale sopra
    // la campata: la prima campata è da cinque colonne, che è il massimo che
    // le zampe reggono, e proprio a metà c'è una lamiera messa lì a fare da
    // appoggio. Non è un appoggio. Il salto si fa lo stesso, tutto intero.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        11: '      ===  L  ===  =',
        13: '======',
        14: '======',
      },
    }),

    // 3 — checkpoint a terra, e la cassa murata. Il soppalco che si attraversa
    // scendendo dalla scaffalatura ha una parete di lamiera sul fianco
    // sinistro, e dietro c'è il gomitolo. Chi tira dritto ci passa sotto senza
    // vederlo mai.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '===    =============',
        9: '       :   *   =====',
        10: '       =============',
        12: ' S',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 4 — il montacarichi merci. Il muro è alto cinque tile e non c'è nessun
    // modo di scavalcarlo: si sale col getto, e il getto sta mezzo sopra il
    // pavimento e mezzo sopra la tromba. Sbagliare colonna è una caduta di
    // quindici righe.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        5: '          ^^',
        6: '          ^^',
        7: '          ^^',
        8: '          ^^ =======',
        9: '          ^^ =======',
        10: '          ^^ =======',
        11: '          ^^ =======',
        12: '          ^^ =======',
        13: '===========  =======',
        14: '===========  =======',
      },
    }),

    // 5 — il ballatoio alto: nastro che spinge avanti, lame appena sopra la
    // testa che tolgono il salto, e un vuoto da due colonne. Il nastro non
    // aiuta come sembra — ti consegna alla piastra a scatto sull'altra sponda
    // più veloce di quanto tu sappia frenare.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        5: '   YY    YY',
        7: '                 O',
        8: '====>>>>>>>>>  =====',
      },
    }),

    // 6 — la campata dei droni: tre buchi da tre colonne e due rotte che si
    // incrociano sopra il secondo. Passano sempre uguale, quindi il problema è
    // il tempo, non la mira.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        4: '     %',
        7: '            %',
        8: '===   ===   ====   =',
      },
    }),

    // 7 — si scende. Il ballatoio muore dopo tre tile e sotto c'è di nuovo il
    // pavimento della fabbrica, con due tratti di ghiaccio sottile fra le
    // isole e due piastre a scatto sulle isole.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '===',
        12: '        A        A',
        13: '====;;;;====;;;;====',
        14: '====    ====    ====',
      },
    }),

    // 8 — ultimo checkpoint, la lastra lunga e la sentinella in mezzo. In
    // fondo alla lastra c'è la piastra a scatto, e sulla lastra la frenata
    // è una cosa che si decide molto prima.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '     YY     YY',
        12: ' S      H        O',
        13: '====~~~~~~~~~~~~====',
        14: FLOOR,
      },
    }),

    // 9 — l'uscita. Il blocco premio col fungo dentro, la molla che è una
    // tagliola, e gli spuntoni invisibili nell'unico punto in cui si atterra.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '      B',
        12: '     m    !   W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

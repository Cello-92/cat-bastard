import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-5 — "L'ultimo piano".
 *
 * L'esame. Non c'è nessuna trappola nuova qui dentro: ci sono tutte quelle di
 * prima, montate una sull'altra e senza spazio in mezzo. Il nastro sopra la
 * fossa, il getto che non spinge sopra il nastro, la sentinella che carica
 * mentre il pavimento si crepa, e in fondo la solita bandiera che non è la
 * bandiera.
 *
 * Per un po' è stato il livello che chiudeva il mondo, e si vede: è costruito
 * come un riepilogo. Adesso è la metà, e quello che viene dopo (da 2-6 a 2-10)
 * dà per scontato tutto quello che qui viene ancora spiegato. Il gomitolo è
 * nascosto nel punto più stupido possibile: dietro il muro che tutti superano
 * saltando.
 */

const CEILING = '='.repeat(SEGMENT_COLS);
const FLOOR = CEILING;

export const WORLD_2_5 = defineLevel({
  id: 'w2-5',
  name: '2-5',
  title: 'L\'ultimo piano',
  sky: 'foundry',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — l'ascensore è rotto, si sale a piedi. Due passi di respiro, e sono
    // gli ultimi del mondo.
    segment({ rows: { 0: CEILING, 1: CEILING, 13: FLOOR, 14: FLOOR } }),

    // 1 — il benvenuto: nastro contro, lame basse, e nel pavimento qualcosa
    // che aspetta esattamente dove il nastro ti lascia.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '     YY      YY',
        12: '            O',
        13: '===<<<<<<<<<<=======',
        14: FLOOR,
      },
    }),

    // 2 — la sentinella nel corridoio stretto, con la lastra di ghiaccio a
    // metà: la carica arriva mentre stai ancora decidendo dove fermarti.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        12: '            H',
        13: '====~~~~~~~~~~~~====',
        14: FLOOR,
      },
    }),

    // 3 — checkpoint, e la prima delle due salite. Il getto è vero, e sopra
    // c'è un ballatoio che serve davvero a qualcosa.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        5: '            ^^',
        6: '            ^^',
        7: '            ^^',
        8: '            ^^ =====',
        9: '            ^^ =====',
        10: '            ^^ =====',
        11: '            ^^ =====',
        12: ' S          ^^ =====',
        13: '=============  =====',
        14: '=============  =====',
      },
    }),

    // 4 — il ballatoio: assi marce sopra il vuoto della fabbrica, e in mezzo
    // una che marcia non è. Sotto, quattro piani di niente.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '===DDD  DLD  DDD  ==',
      },
    }),

    // 5 — il capannone sospeso. La strada passa sotto, larga e comoda, e
    // nessuno ha motivo di salire lassù: è proprio per questo che l'ultimo
    // gomitolo del mondo sta dietro la lamiera di sinistra, quella che sembra
    // il fianco della struttura e invece non è imbullonata a niente.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '==     =============',
        9: '       :   *   =====',
        10: '       =============',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 6 — i due getti gemelli sopra le due fosse gemelle, di nuovo. Stavolta
    // però il primo è quello spento: chi ha imparato la lezione in 2-2 la
    // applica al contrario e cade lo stesso.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '   ,,        ^^',
        10: '   ,,        ^^',
        11: '   ,,        ^^',
        12: '   ,,        ^^',
        13: '==    ======    ====',
        14: '==    ======    ====',
      },
    }),

    // 7 — la pattuglia completa: sentinella, drone e palla di ghiaccio sullo
    // stesso pezzo di pavimento, che nel frattempo si crepa.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        8: '         %',
        12: '   H          &',
        13: '=====;;;;===========',
        14: '=====    ===========',
      },
    }),

    // 8 — ultimo checkpoint, e l'ultima cattiveria seria: il corridoio a
    // scacchiera, lame sopra e piastre sotto, senza un solo tile di margine.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        9: '   YY   YY   YY   YY',
        12: '  S  A    A    A',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 9 — la bandiera. Quella vera è dietro; questa è piantata in mezzo alla
    // strada e ha sempre fatto la stessa identica cosa. Si scavalca — di poco,
    // e solo saltando pieno.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        10: '     F',
        11: '     F',
        12: '     F  !     W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

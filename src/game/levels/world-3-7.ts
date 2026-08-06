import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-7 — "Il canyon".
 *
 * Tutti i livelli del mondo 3 fin qui si attraversano in orizzontale, e le
 * correnti servivano a sporcare il salto. Questo si attraversa **in verticale**:
 * la strada buona sta in alto o in basso a seconda del segmento, e a decidere
 * quale non è il gatto, sono le colonne d'aria. Il getto solleva, il risucchio
 * schiaccia, e sono piazzati a coppie — uno accanto all'altro — così che
 * sbagliare colonna di mezzo metro voglia dire finire dall'altra parte del
 * canyon.
 *
 * È anche il livello in cui gli scarabei smettono di essere un aiuto e
 * diventano un problema: volano nelle stesse correnti che si usano per salire,
 * e lì dentro non ci si scansa — si può solo arrivarci sopra.
 */

const FLOOR = '.'.repeat(SEGMENT_COLS);

export const WORLD_3_7 = defineLevel({
  id: 'w3-7',
  name: '3-7',
  title: 'Il canyon',
  sky: 'desert',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — il fondo del canyon, e la prima colonna d'aria calda che sale. Non
    // c'è niente da evitare: c'è da capire dove porta, perché fra due segmenti
    // sarà l'unica strada.
    segment({
      rows: {
        7: '            ^',
        8: '            ^',
        9: '            ^',
        10: '            ^',
        11: '            ^',
        12: '        C   ^',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — il canyon si apre: cornicione in alto, fondo in basso, e in mezzo
    // niente. Di sotto si passa, ma il fondo finisce.
    segment({
      rows: {
        6: '   ---------',
        7: '   -',
        12: '            C',
        13: '..........   .......',
        14: '..........   .......',
      },
    }),

    // 2 — la coppia. Il getto porta sul cornicione, e sul cornicione c'è un
    // buco con dentro il risucchio: due colonne d'aria a sei metri di
    // distanza, una che tira su e una che riporta esattamente da dove sei
    // venuto. Da fermi si distinguono solo dal verso in cui corre la sabbia.
    segment({
      rows: {
        5: '      ------- -----',
        6: '    ^        v',
        7: '    ^        v',
        8: '    ^        v',
        9: '    ^        v',
        10: '    ^        v',
        11: '    ^        v',
        12: '    ^        v',
        13: '....  .......  .....',
        14: '....  .......  .....',
      },
    }),

    // 3 — checkpoint sul cornicione, che prosegue, e sopra ci corre la
    // corrente con due
    // scarabei dentro. Non si schivano: o si passa sopra, o si aspetta. Sotto
    // c'è il fondo del canyon, ed è tutto punte: la via bassa non esiste più.
    segment({
      rows: {
        3: '  ))))))))))))))))))',
        4: ' S))k)))))))))k)))))',
        5: '--------------------',
        13: '....XXXXXXXX........',
        14: FLOOR,
      },
    }),

    // 4 — la discesa obbligata: il cornicione finisce in mezzo al niente, e
    // sotto c'è la sabbia col risucchio piantato sopra. Non c'è modo di
    // scendere piano: si sceglie solo da che parte del buco si cade.
    segment({
      rows: {
        5: '------',
        8: '       vvvv',
        9: '       vvvv',
        10: '       vvvv',
        11: '       vvvv',
        12: '       vvvv',
        13: '......ssss..........',
        14: '......ssss..........',
      },
    }),

    // 5 — la corrente morta sopra il salto più lungo del livello, disegnata
    // come quella che tre segmenti fa portava davvero.
    segment({
      rows: {
        9: '   wwwwwww',
        10: '   wwwwwww',
        11: '   wwwwwww',
        12: '   wwwwwww',
        13: '...     ............',
        14: '...     ............',
      },
    }),

    // 6 — risalita per la via alta, con le lame sul soffitto del canyon e la
    // molla che ci porta dritto. La via bassa esiste ed è più lunga: è la
    // prima volta che il livello concede una scelta, ed è finta solo a metà.
    segment({
      rows: {
        3: '     YYYYY',
        6: '   ---------',
        12: '     M',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 7 — checkpoint, la sentinella sul cornicione stretto e gli spuntoni a
    // scatto sotto. Corridoio alto due tile: saltare non è un'opzione.
    segment({
      rows: {
        4: '--------------------',
        6: '  S   H',
        7: '--------------------',
        13: '.....AA......AA.....',
        14: FLOOR,
      },
    }),

    // 8 — l'ultimo getto, con la bestia appesa al soffitto proprio dove si
    // arriva in cima. Aspetta lì da prima che tu entrassi nel canyon.
    segment({
      rows: {
        3: '        Z',
        6: '          ------',
        7: '     ^',
        8: '     ^',
        9: '     ^',
        10: '     ^',
        11: '     ^',
        12: '     ^',
        13: '.....  .............',
        14: '.....  .............',
      },
    }),

    // 9 — l'arrivo in cima, e la bandiera sbagliata sistemata al piano di
    // sotto: chi scende a controllare ha già perso.
    segment({
      rows: {
        4: '   -----------------',
        11: '    F',
        12: '    F   !',
        13: '..........  W.......',
        14: FLOOR,
      },
    }),
  ],
});

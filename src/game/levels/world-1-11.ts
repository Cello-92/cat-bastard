import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 1-11 — "Il Padrone".
 *
 * Il boss. Quello che ha messo tutte le trappole degli undici livelli
 * precedenti, con addosso la corona d'oro dei blocchi premio e il mantello
 * cucito con la stoffa delle bandiere finte.
 *
 * **Come si combatte.** Non c'è nessun modo di fargli male toccandolo: si
 * salta sopra un mattone del soffitto, quello trema per quasi un secondo e poi
 * si stacca. Dove cade lo decide il giocatore, perché il Padrone cammina
 * *sempre* verso di lui — è l'unico boss che si guida invece di inseguirlo.
 * Quattro gemme sulla corona, quattro massi in testa, due fasi.
 *
 * **Come bara.** Mentre cammina, se gli sta arrivando della muratura addosso,
 * si sposta. Sempre. Un colpo onesto non lo prende mai: bisogna beccarlo
 * mentre è impegnato in qualcos'altro — la carica, il capogiro contro il muro,
 * o (in seconda fase) la botta a terra con cui cerca di seppellire te. Quella
 * botta fa cadere il mattone sopra al *gatto*, e per un secondo abbondante lui
 * resta lì a godersela: chi ha capito il trucco gli si mette accanto e lo
 * lascia fare. È l'unica trappola del gioco che si rigira contro chi l'ha messa.
 *
 * **Perché non c'è il checkpoint.** Perché un boss si impara, non si consuma.
 * L'arena però è larga quanto uno schermo e il gatto rinasce dentro: si torna
 * a combattere in un secondo e mezzo, che è esattamente quello che la regola
 * dei checkpoint frequenti vuole ottenere (vedi CLAUDE.md).
 *
 * Il portone in fondo è solido finché la corona è accesa. E l'unica lanterna
 * dell'arena, ovviamente, è finta.
 */

/** Volta e pavimento della tana: roccia nuda, come nelle grotte. */
const CEILING = 'R'.repeat(SEGMENT_COLS);
const FLOOR = CEILING;

export const WORLD_1_11 = defineLevel({
  id: 'w1-11',
  name: '1-11',
  title: 'Il Padrone',
  sky: 'cave',
  boss: true,
  // Si rinasce dentro l'arena, all'angolo opposto: nessun corridoio da
  // rifare, nessuna porta da riaprire. Muori, e sei di nuovo lì.
  spawn: { c: 3, r: 12 },
  segments: [
    // 0 — metà sinistra dell'arena. Due mensole per salire, due mattoni sopra,
    // e la lanterna a metà pavimento: l'unico checkpoint della stanza è finto,
    // ed è la prima cosa che il Padrone ti fa vedere.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: 'RR                  ',
        3: 'RR                  ',
        4: 'RR ??     ??        ',
        5: 'RR                  ',
        6: 'RR    C        C    ',
        7: 'RR   RRRRR  RRRRR   ',
        8: 'RR                  ',
        9: 'RR                  ',
        10: 'RR    RR     RR     ',
        11: 'RR                  ',
        12: 'RR      N           ',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — metà destra, il Padrone e il portone. Il mattone in fondo a destra
    // sta esattamente sopra il punto in cui una carica verso il muro finisce:
    // è il colpo che il gioco regala a chi ha capito come si guida un boss.
    segment({
      rows: {
        0: CEILING,
        1: CEILING,
        2: '        RRRRRRRRRRRR',
        3: '        RRRRRRRRRRRR',
        4: '     ?? RRRRRRRRRRRR',
        5: '        RRRRRRRRRRRR',
        6: '  C     RRRRRRRRRRRR',
        7: 'RRRRR   RRRRRRRRRRRR',
        8: '        RRRRRRRRRRRR',
        9: '        ||          ',
        10: ' RR     ||          ',
        11: '        ||          ',
        12: '    @   ||  C C  W  ',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

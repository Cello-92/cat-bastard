import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 2-11 — "Gothic Lucio".
 *
 * Sotto la fabbrica c'era una cappella, e nella cappella c'è un gatto appeso
 * alla volta a testa in giù. Si chiama Lucio. È nero, ha le ciglia più lunghe
 * di te, un collare di borchie e un candelabro da quattro candele che gli pende
 * dalla testa — cioè, stando lui a testa in giù, sopra.
 *
 * **Come si combatte, e perché non è il Padrone.** Il Padrone era un problema
 * orizzontale: camminava verso di te e tu sceglievi sotto quale mattone farlo
 * arrivare. Lucio è verticale. Non cammina, scorre lungo la volta; non carica,
 * si stacca e piomba dritto su una colonna sola; e soprattutto **non c'è niente
 * da tirargli**. Il soffitto qui è sano, non ci sono massi, non c'è nessuna
 * arma da raccogliere.
 *
 * L'arma è il pavimento. Sulle pietre della cappella ci sono i ceri votivi, e
 * l'unica cosa che fa male a Lucio è finirci dentro col mantello. Lui mira la
 * colonna in cui sei **quando comincia a mirare** e da quel momento non cambia
 * più idea: quindi il combattimento non è schivare, è schivare *stando sopra la
 * fiamma giusta*. Dove il Padrone si guidava, Lucio si attira — ti metti tu
 * sull'incudine e ti togli all'ultimo.
 *
 * **Come bara.** Il cero su cui atterra se lo porta via schiacciandolo, quindi
 * lo stesso posto non funziona due volte di fila. E in seconda fase gli basta
 * *passarci sopra* per spegnerlo col mantello: da lì in avanti non ci si può
 * piantare accanto a una fiamma e aspettare, bisogna portarlo ogni volta verso
 * una che non ha ancora sorvolato. Siccome scorre più lento del gatto, la cosa
 * resta sempre possibile — è difficile, non ingiusto. Sempre in seconda fase
 * l'atterraggio manda un'onda: essersi tolti per un pelo smette di bastare, e
 * l'unica risposta è non toccare terra in quel momento.
 *
 * **Perché non c'è il checkpoint.** Stessa ragione di 1-11: un boss si impara,
 * non si consuma. La cappella è larga due schermi e si rinasce dentro.
 *
 * I due altari sono l'unica geometria della stanza, e servono a una cosa sola:
 * sono i posti in cui Lucio atterra senza farsi niente. Chi lo attira lì ha
 * sprecato un tuffo — che è l'unica risorsa che il giocatore ha davvero.
 */

/** Volta e pietre della cappella: roccia nuda, come nella tana del Padrone. */
const VAULT = 'R'.repeat(SEGMENT_COLS);
const FLOOR = VAULT;

export const WORLD_2_11 = defineLevel({
  id: 'w2-11',
  name: '2-11',
  title: 'Gothic Lucio',
  sky: 'cave',
  boss: true,
  // Si rinasce in fondo alla navata, dalla parte opposta a lui.
  spawn: { c: 3, r: 12 },
  segments: [
    // 0 — la navata. Vuota apposta: qui non c'è niente da saltare, niente da
    // schivare e niente da raccogliere. Ci sono tre ceri accesi sulle pietre e
    // un altare, ed è tutto quello che la stanza offre in tutta la sua durata.
    segment({
      rows: {
        0: VAULT,
        1: VAULT,
        2: 'RR                  ',
        3: 'RR                  ',
        4: 'RR                  ',
        5: 'RR                  ',
        6: 'RR                  ',
        7: 'RR                  ',
        8: 'RR                  ',
        9: 'RR                  ',
        10: 'RR                  ',
        11: 'RR           RR     ',
        12: 'RR   "    "  RR  "  ',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — il coro, Lucio e il portone. Il marcatore sta sotto la volta e non
    // sul pavimento: è lì che nasce, appeso, e sul pavimento ci mette piede
    // solo per sbaglio — che è esattamente lo sbaglio che gli si deve far fare.
    //
    // L'ultimo cero è dietro il secondo altare, cioè nel punto più scomodo
    // della cappella: in seconda fase, quando li ha spenti quasi tutti, è
    // quello che resta, e per usarlo bisogna farsi inseguire fin lì.
    segment({
      rows: {
        0: VAULT,
        1: VAULT,
        2: '        $           ',
        9: '             ||     ',
        10: '     RR      ||     ',
        11: '     RR      ||     ',
        12: ' "   RR  "   ||   W ',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

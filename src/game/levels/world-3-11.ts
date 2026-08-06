import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 3-11 — "La Sfinge".
 *
 * In fondo al tempio c'è la sala grande, e nella sala grande non c'è niente.
 * È deliberato, ed è la prima cosa da capire dell'arena: la tana del Padrone
 * aveva un soffitto di mattoni, la cappella di Lucio aveva i ceri, e qui il
 * pavimento è pietra sana da parete a parete. **Non c'è nessuna arma.**
 *
 * L'arma la fabbrica lei. La Sfinge vive sotto il pavimento, scava verso di te
 * — più lenta di te, come gli altri due, quindi sei sempre tu a scegliere dove
 * si combatte — si ferma quando ti arriva sotto, il pavimento rimbomba, e poi
 * esce. Uscendo sbriciola la pietra in sabbie mobili. Al secondo giro quella
 * sabbia c'è già, e se il suo corpo ne tocca anche una sola cella non trova
 * presa: viene su a metà e resta conficcata. Quello è il colpo.
 *
 * Quindi il combattimento non è schivare (il Padrone) e non è farsi esca
 * (Lucio): è **scegliere il terreno**. Ci si mette sul bordo delle macerie —
 * sul bordo, non sopra, perché il suo corpo è largo due celle e le basta
 * toccarne una guasta — e ci si toglie prima che esca. E man mano che va
 * avanti, la stanza in cui si combatte è sempre meno una stanza.
 *
 * **Perché non c'è il checkpoint.** Stessa ragione di 1-11 e 2-11: un boss si
 * impara, non si consuma. Si rinasce dentro, dalla parte opposta.
 *
 * **I due blocchi** sono l'unica geometria della sala, e non sono un riparo:
 * la Sfinge esce anche di lì sotto, e sono bassi apposta — due tile, cioè
 * scavalcabili senza pensarci. Servono a spezzare la corsa, perché una sala
 * perfettamente vuota si attraversa senza mai guardare dove si mettono le
 * zampe, e qui guardare dove si mettono le zampe è tutto il gioco.
 */

/** Volta e pavimento della sala: arenaria, come tutto il tempio. */
const VAULT = '-'.repeat(SEGMENT_COLS);
const FLOOR = VAULT;

export const WORLD_3_11 = defineLevel({
  id: 'w3-11',
  name: '3-11',
  title: 'La Sfinge',
  sky: 'tomb',
  boss: true,
  // Si rinasce in fondo alla sala, dalla parte opposta a lei.
  spawn: { c: 3, r: 12 },
  segments: [
    // 0 — la sala. Vuota apposta: niente da saltare, niente da raccogliere,
    // niente da tirarle. C'è il pavimento, e il pavimento all'inizio è sano.
    segment({
      rows: {
        0: VAULT,
        1: VAULT,
        2: '--                  ',
        3: '--                  ',
        4: '--                  ',
        5: '--                  ',
        6: '--                  ',
        7: '--                  ',
        8: '--                  ',
        9: '--                  ',
        10: '--                  ',
        11: '--             --   ',
        12: '--             --   ',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — la seconda metà, la Sfinge e il portone. Il marcatore sta **sul
    // pavimento**, come quello del Padrone e al contrario di quello di Lucio:
    // lei nasce sepolta lì sotto, e quel filo è la quota a cui torna sempre.
    segment({
      rows: {
        0: VAULT,
        1: VAULT,
        9: '             ||     ',
        10: '             ||     ',
        11: '    --       ||     ',
        12: '    --   0   ||   W ',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

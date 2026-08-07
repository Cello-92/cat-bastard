import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-11 — "Il Rovescio".
 *
 * In fondo al vuoto sotto la torre c'è una sala con un pavimento, un soffitto,
 * e diciassette blocchi di piombo appoggiati per terra. Non è una decorazione
 * ed è tutta l'arena: quei pesi sono l'unica cosa che possa fare male al
 * Rovescio, e non li tira nessuno — cadono da soli, tutti insieme, ogni volta
 * che lui ribalta la stanza. Cioè ogni volta che fa l'unica cosa che sa fare.
 *
 * Quindi lo scontro non assomiglia agli altri tre. Il Padrone si **guida**
 * sotto un mattone, Lucio si **attira** sopra un cero, la Sfinge si **aspetta**
 * sul terreno che ha rotto lei. Il Rovescio non va portato da nessuna parte: si
 * spara addosso l'arena da solo, sempre, e prima di farlo **si toglie** dalla
 * colonna pericolosa — una volta sola per ciclo, tre metri e mezzo di scarto.
 * Quindi il gioco è chiudergli le uscite: farlo fermare dove tre metri e mezzo
 * non bastano a trovare un posto libero.
 *
 * La sala è divisa in tre. A sinistra non c'è un peso: è la zona in cui non gli
 * si fa niente, ed è dove si finisce a stare quando si scappa. In mezzo i pesi
 * stanno **ogni due colonne** — lì non esiste un punto in cui non ne tocchi
 * almeno uno, e non esiste nemmeno uno scarto che lo porti fuori. A destra sono
 * radi, e c'è lui.
 *
 * Il che vuol dire che il combattimento è tutto nel decidere dove farsi
 * raggiungere. Lui cammina più piano del gatto (come tutti e quattro), quindi
 * quel posto lo sceglie il gatto — e sceglierlo significa mettersi in mezzo ai
 * pesi, che è anche il posto in cui i pesi passano. Le colonne libere sono
 * quelle dispari: sono larghe una cella, e ci si sta in piedi.
 *
 * **Perché non c'è il checkpoint.** Stessa ragione di 1-11, 2-11 e 3-11: un
 * boss si impara, non si consuma. Si rinasce dentro, dalla parte opposta.
 */

/** Pietra della sala: basalto, come tutto quello che sta sotto la torre. */
const STONE = 'b'.repeat(SEGMENT_COLS);

export const WORLD_4_11 = defineLevel({
  id: 'w4-11',
  name: '4-11',
  title: 'Il Rovescio',
  sky: 'reverse',
  boss: true,
  // Si rinasce in fondo alla sala, dalla parte opposta a lui.
  spawn: { c: 3, r: 12 },
  segments: [
    // 0 — la parte sinistra: niente pesi. È l'unico posto della sala in cui si
    // può stare tranquilli, ed è anche l'unico in cui non si vince: qui lui
    // ribalta la stanza e non gli succede niente, all'infinito. Le lame sul
    // soffitto servono a ricordare che dopo il primo ribaltamento anche il
    // soffitto è un pavimento, e che questo pavimento ha i denti.
    segment({
      rows: {
        0: STONE,
        1: STONE,
        2: '     Y        Y     ',
        13: 'bbbbbbbbbbbbbbbbbbbb',
        14: STONE,
      },
    }),

    // 1 — la trappola, ed è tutta qui. Dieci zavorre a due colonne l'una
    // dall'altra: nessun punto di questa fascia è fuori dalla portata di
    // almeno un peso, e nessuno scarto è abbastanza lungo per uscirne. Le
    // colonne dispari sono libere e sono larghe una cella: ci si sta in piedi,
    // e stare in piedi lì dentro mentre lui arriva è tutto lo scontro.
    //
    // E le colonne libere **non sono le stesse nei due versi**. Sul pavimento
    // quattro di loro hanno gli spuntoni, sul soffitto ne hanno altre quattro,
    // e le due file non coincidono: appena la stanza si ribalta il posto in
    // cui stavi in piedi diventa un posto in cui si muore, e quello accanto
    // smette di esserlo. Quindi non basta trovare la colonna buona una volta:
    // bisogna trovarne due, e cambiare mentre il pavimento sta girando.
    segment({
      rows: {
        0: STONE,
        1: STONE,
        2: ' Y   Y     Y   Y    ',
        12: 'z zXz zXz z zXz zXz ',
        13: STONE,
        14: STONE,
      },
    }),

    // 2 — la parte destra: pesi radi, il Rovescio, il portone e l'arrivo. Il
    // marcatore sta nella cella **sopra** il pavimento, come quello del
    // Padrone e della Sfinge: lui ci cammina sopra, e ci ricamminerà sopra
    // capovolto per metà scontro.
    segment({
      rows: {
        0: STONE,
        1: STONE,
        2: '   Y            Y   ',
        9: '             ||     ',
        10: '             ||     ',
        11: '             ||   W ',
        12: 'z    z  1    ||   W ',
        13: STONE,
        14: STONE,
      },
    }),
  ],
});

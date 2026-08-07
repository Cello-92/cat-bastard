import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-4 — "Il pendolo non sta cercando te".
 *
 * Un pendolo **è** la gravità, disegnata: va avanti e indietro sempre uguale,
 * con lo stesso periodo e la stessa ampiezza, e riparte dallo stesso punto a
 * ogni rinascita. Non insegue, non accelera, non cambia idea. È l'ostacolo più
 * onesto del gioco e insieme il più difficile, perché l'unico modo di passare è
 * conoscere il tempo — che è precisamente la cosa che questo gioco chiede da
 * 1-1: imparare a memoria e poi eseguire.
 *
 * A metà livello ne compare uno che pende **verso l'alto**. Non è un trucco
 * nuovo: è lo stesso pendolo, appeso allo stesso modo, dentro un campo
 * rovescio. Sta lì per una ragione sola — è la prova più chiara che il campo
 * non è un ascensore ma una regola, e che la regola vale per tutto quello che
 * ha un peso.
 *
 * Niente gomitolo. Da qui in poi una parete che sembra finta a volte è solo
 * una parete, e l'unico modo di saperlo è perderci tempo.
 */

const FLOOR = 'o'.repeat(SEGMENT_COLS);
const CEIL = 'o'.repeat(SEGMENT_COLS);
const FULL_FIELD = 'u'.repeat(SEGMENT_COLS);

export const WORLD_4_4 = defineLevel({
  id: 'w4-4',
  name: '4-4',
  title: 'Il pendolo non sta cercando te',
  sky: 'spire',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — il primo pendolo, da solo, in mezzo a venti colonne di pavimento
    // piatto. Non c'è niente da capire e niente da sbagliare: c'è da guardarlo
    // per due o tre oscillazioni prima di attraversare, che è tutta la
    // tecnica che questo livello richiede.
    segment({
      rows: {
        8: '           b',
        9: '           t',
        12: '    C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 1 — due pendoli sfasati, e un soffitto di lame sopra il corridoio. Le
    // lame tolgono l'unica risposta comoda, cioè saltare alto e passare
    // sopra: qui si passa **sotto**, nel momento in cui la sfera è dall'altra
    // parte, e non c'è nessun altro momento.
    segment({
      rows: {
        6: 'YYYYYYYYYYYYYYYYYYYY',
        8: '    b        b',
        9: '    t        t',
        12: '  C       C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 2 — un pendolo sopra una pozza. La sfera passa esattamente sopra il
    // punto in cui bisogna staccarsi per saltarla: o si parte prima, e si
    // arriva corti, o si aspetta, e si parte con lei che torna.
    segment({
      rows: {
        8: '        b',
        9: '        t',
        11: '   E',
        12: '  C',
        13: 'ooooooo     oooooooo',
        14: 'ooooooo     oooooooo',
      },
    }),

    // 3 — checkpoint, e il pendolo capovolto. Sta dentro un campo, appeso a
    // una mensola che sta **sotto** di lui, e oscilla verso l'alto: la sfera
    // arriva all'altezza delle zampe di chi cammina sul soffitto. È lo stesso
    // congegno di prima, e questa è tutta la differenza che c'è fra un
    // ascensore e una regola.
    segment({
      rows: {
        4: '   ooooooooooooooo',
        5: '   uuuuuuuuuuuuuuu',
        6: '   uuuuuuuuuuuuuuu',
        7: '   uuuuuuuuuuuuuuu',
        8: '   uuuuuutuuuuuuuu',
        9: '   uuuuuubuuuuuuuu',
        10: '   uuuuuuuuuuuuuuu',
        11: '   uuuuuuuuuuuuuuu',
        12: ' S uuuuuuuuuuuuuuu',
        13: 'ooo               oo',
        14: 'ooo               oo',
      },
    }),

    // 4 — di nuovo a terra, e di nuovo il primo mondo: il mattone che lascia
    // andare la stalattite, il terreno che non c'è, la moneta che ammazza.
    // Sono venti colonne di riposo solo per chi non le ha mai viste.
    segment({
      rows: {
        5: '        T',
        11: '             E',
        12: '   C',
        13: 'oooVVoooooooooooooo',
        14: FLOOR,
      },
    }),

    // 5 — passerella lunga con due pendoli capovolti sfasati fra loro, e un
    // ragno che arriva in senso contrario. Le tre cose insieme non lasciano
    // nessun ritmo comodo: bisogna sceglierne uno scomodo e tenerlo.
    segment({
      rows: {
        4: CEIL,
        5: 'uuuuuuuuuuauuuuuuuuu',
        6: FULL_FIELD,
        7: FULL_FIELD,
        8: 'uuuutuuuuuuuuutuuuuu',
        9: 'uuuubuuuuuuuuubuuuuu',
        10: FULL_FIELD,
        11: FULL_FIELD,
        12: FULL_FIELD,
      },
    }),

    // 6 — la colonna spenta, con un pendolo capovolto appeso dentro. Il
    // pendolo pende verso il **basso**, perché lì non c'è nessun campo: è la
    // stessa mensola, lo stesso ferro, e basta guardarlo per sapere che quella
    // colonna non porta da nessuna parte. Il piombo non mente mai.
    segment({
      rows: {
        4: '    oooooooo',
        5: '    nnnnnnnn',
        6: '    nnnnnnnn',
        7: '    nnnnnnnn',
        8: '    nnnbnnnn',
        9: '    nnntnnnn',
        10: '    nnnnnnnn',
        11: '    nnnnnnnn',
        12: '    nnnnnnnn',
        13: 'oooo    oooooooooooo',
        14: 'oooo    oooooooooooo',
      },
    }),

    // 7 — checkpoint, e le tre cose che non danno preavviso: la lanterna che
    // non si accende, gli spuntoni che non ci sono e la molla che si chiude.
    // Stanno tutte in fila su venti colonne piatte, senza un pendolo che
    // distragga, perché a distrarre ci pensa il fatto che sembra facile.
    segment({
      rows: {
        10: '          N',
        12: '  S    !       m   C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 8 — tre pendoli in fila con periodi sfasati e, sotto, un pavimento che
    // per metà non c'è. È l'esame del livello: non c'è niente di nuovo, c'è
    // solo tutto insieme e nell'ordine peggiore.
    segment({
      rows: {
        8: '  b      b       b',
        9: '  t      t       t',
        12: '       C',
        13: 'oooooo   ooooo   ooo',
        14: 'oooooo   ooooo   ooo',
      },
    }),

    // 9 — l'arrivo, con un ultimo pendolo piazzato esattamente davanti alla
    // bandiera. Non è cattiveria gratuita: è l'unica cosa di questo livello
    // che si può ancora sbagliare dopo averlo capito tutto.
    segment({
      rows: {
        8: '          b',
        9: '          t',
        11: '     F        W',
        12: '     F        W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

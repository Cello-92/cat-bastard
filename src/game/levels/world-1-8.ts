import { defineLevel, segment } from './level';

/**
 * 1-8 — "Il turno di notte".
 *
 * 1-2 era di notte perché il buio è una scusa comoda per nascondere le cose.
 * Qui il buio serve a un'altra cosa: a togliere i punti di riferimento. Il
 * livello è pieno di roba che si vede benissimo — nastri, piastre, lanterne —
 * e proprio per questo si guarda quella, mentre le trappole vere sono le tre
 * cose che non hanno niente da vedere: il pavimento che non c'è, gli spuntoni
 * che non ci sono e la piattaforma che c'è per tre tick.
 *
 * È anche il livello con più metri di nastro del gioco. Di notte non si vede
 * dove finisce, e finisce sempre prima di quanto convenga.
 */
export const WORLD_1_8 = defineLevel({
  id: 'w1-8',
  name: '1-8',
  title: 'Il turno di notte',
  sky: 'night',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro. Corto, e con il primo tratto di nastro che porta verso il
    // buio: non c'è niente da vedere in fondo, ed è vero.
    segment({
      ground: true,
      rows: { 13: '#######>>>>>>>>#####' },
    }),

    // 1 — il nastro riprende e finisce nel vuoto. Chi arriva lanciato non ha
    // il tempo di frenare, chi arriva piano non ha lo slancio per saltare.
    segment({
      ground: true,
      rows: {
        12: '            !',
        13: '>>>>>>>####     ####',
        14: '###########     ####',
      },
    }),

    // 2 — blocco premio in mezzo al niente, con il fungo che esce e ti insegue
    // proprio mentre servono le due piastre. Il blocco invisibile è dove si
    // salterebbe per scappargli.
    segment({
      ground: true,
      rows: {
        8: '    B      I',
        12: '  AA    G     AA   O',
      },
    }),

    // 3 — quattro isole. La prima è un nastro che porta indietro, la terza è
    // fantasma, l'ultima ha la bestia sopra.
    segment({
      rows: {
        3: '                Z',
        11: ' <<   DD   LD   DD',
      },
    }),

    // 4 — due lanterne identiche, e in mezzo cinque colonne di terra che non
    // c'è: lo stesso tranello di 1-3, rifatto al buio e con la lanterna finta
    // piazzata prima invece che dopo.
    segment({
      ground: true,
      rows: {
        12: '  N          S',
        13: '#####VVVVV##########',
        14: '#####     ##########',
      },
    }),

    // 5 — corridoio a due piani: sotto il nastro e le lame a soffitto, sopra
    // la scorciatoia che sembra comoda e finisce contro gli spuntoni.
    segment({
      rows: {
        6: '      YYYYY',
        7: '   #########',
        9: '        E',
        12: '   O        !    O',
        13: '>>>>>>>>>>>>>>>>>>>>',
        14: '####################',
      },
    }),

    // 6 — la molla porta esattamente all'altezza della fila di lame. La
    // tagliola accanto non porta da nessuna parte, che in confronto è meglio.
    segment({
      ground: true,
      rows: {
        5: '        YYYY',
        12: '      M  m      G',
      },
    }),

    // 7 — il ponte al buio: solido, fantasma, marcio, solido, con il masso
    // sopra il pezzo su cui bisogna per forza fermarsi.
    segment({
      rows: {
        5: '           K',
        11: '  ##  LD  DD  ##   >',
        13: '##              ####',
        14: '##XXXXXXXXXXXX######',
      },
    }),

    // 8 — l'ultima pattuglia, con i gemelli cattivi mescolati ai normali e il
    // terreno che scatta sotto i piedi tra l'uno e l'altro.
    segment({
      ground: true,
      rows: {
        9: '        C E C',
        12: ' S J  O  G   J  O  G',
      },
    }),

    // 9 — arrivo. Tre passi, e due sono sbagliati.
    segment({
      ground: true,
      rows: {
        8: '      Q',
        12: '     !  m  !  W',
      },
    }),
  ],
});

import { defineLevel, segment } from './level';

/**
 * 1-1 — "Sembra un platform normale".
 *
 * Il livello introduttivo insegna al giocatore le regole di Mario e poi le
 * tradisce una per una, nello stesso ordine in cui le ha insegnate.
 */
export const WORLD_1_1 = defineLevel({
  id: 'w1-1',
  name: '1-1',
  title: 'Sembra un platform normale',
  sky: 'day',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro: qui non succede niente, ed è apposta.
    segment({ ground: true }),

    // 1 — tubo, primo blocco premio (bugiardo), primo nemico.
    segment({
      ground: true,
      rows: {
        8: '      B      Q',
        11: '   PP',
        12: '   PP           G',
      },
    }),

    // 2 — il buco, con il blocco invisibile piazzato sulla traiettoria.
    segment({
      rows: {
        11: '            I',
        13: '##########     #####',
        14: '##########     #####',
      },
    }),

    // 3 — piattaforme che non ti vogliono bene.
    segment({ rows: { 11: ' DD    DD    DD   DD' } }),

    // 4 — checkpoint, mattone-trappola sul soffitto, il gemello cattivo.
    segment({
      ground: true,
      rows: {
        8: '          T',
        12: ' S   J        G',
      },
    }),

    // 5 — monete di consolazione sopra gli spuntoni.
    segment({
      rows: {
        8: '   C  C  C',
        13: '#####  #####   #####',
        14: '#####XX#####XXX#####',
      },
    }),

    // 6 — la bandiera. Non è la bandiera.
    segment({
      ground: true,
      rows: {
        8: '          F',
        9: '          F',
        10: '          F',
      },
    }),

    // 7 — salto lungo sul vuoto, con appoggio centrale che si sbriciola.
    segment({ rows: { 11: '   ###    DDD    ###' } }),

    // 8 — corridoio dei sospetti: due normali, uno no.
    segment({
      ground: true,
      rows: {
        8: '  C C C',
        12: ' S G    J     G',
      },
    }),

    // 9 — arrivo vero.
    segment({
      ground: true,
      rows: {
        8: '      Q',
        12: '            W',
      },
    }),
  ],
});

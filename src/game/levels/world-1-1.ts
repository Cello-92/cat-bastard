import { defineLevel, segment } from './level';

/**
 * 1-1 — "Sembra un platform normale".
 *
 * Il livello introduttivo insegna al giocatore le regole di Mario e poi le
 * tradisce una per una, nello stesso ordine in cui le ha insegnate: prima il
 * blocco premio, poi il vuoto, poi la piattaforma, infine il pavimento.
 *
 * Regola di costruzione: nessun salto richiesto supera le cinque colonne, che
 * è il limite fisico del gatto. Tutta la difficoltà viene da cosa succede
 * *durante* il salto, mai da un salto impossibile.
 */
export const WORLD_1_1 = defineLevel({
  id: 'w1-1',
  name: '1-1',
  title: 'Sembra un platform normale',
  sky: 'day',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro: qui non succede niente, ed è apposta. Serve a far credere
    // al giocatore di aver capito che gioco è.
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

    // 2 — il buco, con il blocco invisibile piazzato esattamente sull'apice
    // della traiettoria: si salta, ci si sbatte la testa, si cade dentro.
    segment({
      rows: {
        10: '            I',
        13: '##########     #####',
        14: '##########     #####',
      },
    }),

    // 3 — piattaforme che non ti vogliono bene, con una bestia appesa sopra
    // la seconda: dove atterri lo decidi prima di saltare, non dopo.
    segment({
      rows: {
        4: '        Z',
        11: ' DD    DD    DD   DD',
      },
    }),

    // 4 — checkpoint, mattone-trappola sul soffitto, il gemello cattivo e la
    // prima feritoia nel pavimento.
    segment({
      ground: true,
      rows: {
        8: '          T',
        12: ' S   J   AA   G',
      },
    }),

    // 5 — monete di consolazione sopra gli spuntoni, e un soffitto armato che
    // vieta il salto pieno: qui si impara a saltare *poco*.
    segment({
      rows: {
        9: '     Y       YYY',
        11: '   C     C',
        13: '#####  #####   #####',
        14: '#####XX#####XXX#####',
      },
    }),

    // 6 — la bandiera. Non è la bandiera. E la molla davanti non è un aiuto.
    segment({
      ground: true,
      rows: {
        5: '      YY',
        8: '          F',
        9: '          F',
        10: '          F',
        12: '      M',
      },
    }),

    // 7 — salto lungo sul vuoto, con appoggio centrale che si sbriciola.
    segment({
      rows: {
        4: '            Z',
        11: '   ###    DDD    ###',
      },
    }),

    // 8 — corridoio dei sospetti: due nemici normali, uno no. E tre metri di
    // pavimento che non esiste.
    segment({
      rows: {
        9: '  C C C',
        12: ' S G    J     G',
        13: '######VVV###########',
        14: '######   ###########',
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

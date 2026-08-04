import { defineLevel, segment } from './level';

/**
 * 1-2 — "Di notte si vede peggio".
 *
 * Ora il giocatore sa che i blocchi mentono, quindi la trappola non è più il
 * blocco: sono il vuoto sotto le piattaforme, il soffitto sopra la testa e il
 * pavimento sotto le zampe. Al buio ognuna di queste cose si vede un attimo
 * dopo — che è esattamente un attimo troppo tardi.
 */
export const WORLD_1_2 = defineLevel({
  id: 'w1-2',
  name: '1-2',
  title: 'Di notte si vede peggio',
  sky: 'night',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro, ma corto.
    segment({ ground: true }),

    // 1 — blocco premio e blocco invisibile alla stessa altezza: uno dei due
    // ti dà un fungo che ti insegue, l'altro ti ferma a mezz'aria.
    segment({
      ground: true,
      rows: {
        9: '      B    I',
        12: '        AA  G',
      },
    }),

    // 2 — ponte di assi marce sopra il vuoto, con la bestia appesa a metà.
    segment({
      rows: {
        3: '          Z',
        10: '        DDDD',
        13: '########      ######',
        14: '########      ######',
      },
    }),

    // 3 — due mattoni-trappola e tre nemici, uno con la sorpresa sotto.
    segment({
      ground: true,
      rows: {
        8: '   T      T',
        12: '  G     J    G',
      },
    }),

    // 4 — le monete stanno sopra gli spuntoni e il soffitto è chiodato: si
    // passa solo rinunciando alle monete, che è il punto.
    segment({
      rows: {
        9: '    YY      YY',
        11: '    C C     C C',
        13: '####    ####    ####',
        14: '####XXXX####XXXX####',
      },
    }),

    // 5 — checkpoint, un blocco onesto per far dubitare del prossimo, e un
    // tratto di pavimento che non regge.
    segment({
      ground: true,
      rows: {
        8: '        Q',
        12: '   S',
        13: '###########VVVV#####',
        14: '###########    #####',
      },
    }),

    // 6 — scalino, molla e bandiera finta: la molla ti porta *sopra* la
    // bandiera, dove ci sono gli spuntoni. Nessuna delle tre cose è un aiuto.
    segment({
      ground: true,
      rows: {
        4: '               YYY',
        8: '                F',
        9: '                F',
        10: '                F',
        11: '      ###',
        12: '  G        M',
      },
    }),

    // 7 — quattro isole marce, zero margine.
    segment({
      rows: {
        3: '             Z',
        11: '  DD   DD   DD   DD',
      },
    }),

    // 8 — l'ultimo corridoio, con due feritoie a distanza di un salto.
    segment({
      ground: true,
      rows: {
        9: '  C C C',
        12: ' S  J  AA  G  AA  J',
      },
    }),

    // 9 — arrivo.
    segment({
      ground: true,
      rows: {
        8: '     B',
        12: '           W',
      },
    }),
  ],
});

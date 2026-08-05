import { defineLevel, segment } from './level';

/**
 * 1-2 — "Di notte si vede peggio".
 *
 * Il giocatore ora sa che i blocchi mentono, quindi qui mentono le cose su cui
 * non ha mai avuto motivo di dubitare: il buio, il pavimento, la lanterna che
 * segna il punto di salvataggio. Le trappole invisibili si moltiplicano perché
 * di notte "invisibile" non è nemmeno una scusa — è la normalità.
 */
export const WORLD_1_2 = defineLevel({
  id: 'w1-2',
  name: '1-2',
  title: 'Di notte si vede peggio',
  sky: 'night',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro. Corto, e già con qualcosa sotto il terreno.
    segment({
      ground: true,
      rows: { 12: '              O' },
    }),

    // 1 — blocco premio e blocco invisibile alla stessa altezza: uno ti dà un
    // fungo che ti insegue, l'altro ti ferma a mezz'aria sopra la piastra.
    segment({
      ground: true,
      rows: {
        9: '      B    I',
        12: '        AA  G   !',
      },
    }),

    // 2 — ponte di assi marce sopra il vuoto, con la bestia appesa a metà e
    // un'asse che non è marcia: è proprio finta.
    segment({
      rows: {
        3: '          Z',
        10: '        DDLD',
        13: '########      ######',
        14: '########      ######',
      },
    }),

    // 3 — due mattoni-trappola, tre nemici (uno con la sorpresa sotto) e un
    // masso che crolla senza dire niente a nessuno.
    segment({
      ground: true,
      rows: {
        7: '        K',
        8: '   T      T',
        12: '  G     J    G   O',
      },
    }),

    // 4 — le monete stanno sopra gli spuntoni e il soffitto è chiodato: si
    // passa solo rinunciando alle monete. Due su quattro sono avvelenate.
    segment({
      rows: {
        9: '    YY      YY',
        11: '    C E     E C',
        13: '####    ####    ####',
        14: '####XXXX####XXXX####',
      },
    }),

    // 5 — due lanterne. Una salva, l'altra ammazza, e sono identiche. Subito
    // dopo, un tratto di pavimento che non regge.
    segment({
      ground: true,
      rows: {
        8: '        Q',
        12: '   N       S',
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
        12: '  G     !  M',
      },
    }),

    // 7 — quattro isole marce, zero margine, e la terza è un fantasma.
    segment({
      rows: {
        3: '             Z',
        11: '  DD   DD   LD   DD',
      },
    }),

    // 8 — l'ultimo corridoio: due piastre, due tratti di terreno che scatta,
    // e i nemici a coprire lo spazio tra l'una e l'altro.
    segment({
      ground: true,
      rows: {
        9: '  C E C',
        12: ' S  J  AA O G  AA  J',
      },
    }),

    // 9 — arrivo.
    segment({
      ground: true,
      rows: {
        8: '     B',
        12: '        !  W',
      },
    }),
  ],
});

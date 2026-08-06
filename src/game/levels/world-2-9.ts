import { defineLevel, segment } from './level';

/**
 * 2-9 — "Più in alto è più freddo".
 *
 * 2-3 era il livello aereo: isole di neve sopra il vuoto, con l'aurora a
 * illuminare tutto. Questo è lo stesso livello dopo che il gioco ha smesso di
 * essere educato — le isole sono più corte, le campate sono da cinque colonne,
 * metà degli appoggi è lastra di ghiaccio e il resto si sbriciola.
 *
 * Al centro c'è l'unica salita vera del mondo: quattro ripiani uno sopra
 * l'altro, ognuno con la sua piastra a scatto piantata dove si atterra. Non
 * c'è niente di nascosto, non c'è niente da raccogliere, e da lassù la
 * discesa è un salto in cui non si vede dove si finisce.
 *
 * **Nessun gomitolo, come in 2-7.** Il muro finto qui non c'è proprio.
 */

const FLOOR = '+'.repeat(20);

export const WORLD_2_9 = defineLevel({
  id: 'w2-9',
  name: '2-9',
  title: 'Più in alto è più freddo',
  sky: 'aurora',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — l'ultimo pezzo di terra ferma, e si vede già che finisce.
    segment({ rows: { 13: FLOOR, 14: FLOOR } }),

    // 1 — le prime isole, di ghiaccio. In 2-3 la prima serie era di neve
    // apposta, per stabilire il salto normale; qui il salto normale si dà per
    // saputo e si comincia direttamente dalla superficie che non frena.
    segment({
      rows: {
        11: '     ~~~~    ~~~~~~~',
        13: '+++',
        14: '+++',
      },
    }),

    // 2 — neve in mezzo al ghiaccio, e sopra la neve la bestia appesa: si
    // tuffa quando le passi sotto, e l'unico posto dove atterrare è sotto.
    segment({
      rows: {
        4: '        Z',
        11: '~~    ++++    ~~~~~~',
      },
    }),

    // 3 — checkpoint sull'isola lunga, e in fondo la campata da cinque
    // colonne: il massimo che le zampe reggono, senza niente in mezzo. Prima
    // c'è la piastra a scatto, che serve solo a far partire il salto di rincorsa
    // da dove non volevi.
    segment({
      rows: {
        10: '  S  A',
        11: '++++++++++     +++++',
      },
    }),

    // 4 — il ponte di assi. Due campate da tre, una da cinque, e dentro
    // l'ultima una lamiera che sparisce in tre tick messa esattamente dove
    // il piede cerca il mezzo appoggio.
    segment({
      rows: {
        4: '         Z',
        11: '  DDD   DDD  L  ++++',
      },
    }),

    // 5 — la lastra sospesa: dodici colonne di ghiaccio che finiscono nel
    // vuoto, con un drone che passa a mezza altezza. Arrivarci lanciati è
    // comodo per tutto il tempo tranne l'ultimo metro.
    segment({
      rows: {
        8: '       %',
        11: '~~~~~~~~~~~~   +++++',
      },
    }),

    // 6 — la salita. Quattro ripiani, ognuno più corto del precedente, e su
    // ognuno una piastra che scatta quando ci sei già sopra. Salire è
    // obbligatorio: da qui in poi il livello sta in alto.
    segment({
      rows: {
        5: '              A',
        6: '             +++++++',
        7: '        A',
        8: '       ++++++',
        9: '   A',
        10: '  +++++',
        11: '++',
      },
    }),

    // 7 — e la discesa, che è un salto solo: si parte dal ripiano più alto e
    // si atterra cinque righe più in basso, senza vedere dove. Poi ancora
    // cinque colonne di vuoto fino al pavimento vero.
    segment({
      rows: {
        6: '+++',
        11: '      ~~~~~',
        13: '                ++++',
        14: '                ++++',
      },
    }),

    // 8 — ultimo checkpoint, di nuovo a terra, e il corridoio con le lame
    // basse: una piastra a scatto e degli spuntoni nascosti, in mezzo a due
    // coppie di lame che vietano il salto comodo.
    segment({
      rows: {
        9: '     YY    YY',
        12: '  S     A     O',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 9 — l'arrivo, con la lanterna che non si accende e le due monete
    // sospese: una delle due è quello che sembra.
    segment({
      rows: {
        9: '       C  E',
        12: '    N       !  W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

import { defineLevel, segment } from './level';

/**
 * 1-10 — "L'ultima bandiera. Giuro".
 *
 * L'esame. Non c'è niente di nuovo qui dentro — non una trappola, non un
 * nemico, non un tile: tutto quello che c'è, il giocatore l'ha già visto
 * almeno una volta. Quello che cambia è che non arrivano più una alla volta.
 *
 * Ogni segmento mette insieme due cose che finora erano state separate: il
 * nastro e la piastra, la molla e le lame, il pavimento finto e il checkpoint,
 * l'asse fantasma e la stalattite. Nessuna di queste coppie è ingiocabile — il
 * risolutore lo verifica una per una — ma nessuna perdona di essere affrontata
 * con il piano dell'altra.
 *
 * Ci sono due bandiere prima di quella vera, che è il numero giusto: una sola
 * si impara, tre sarebbero una barzelletta. E l'ultima cosa che il gioco fa,
 * due passi prima dell'arrivo, è offrire una molla.
 */
export const WORLD_1_10 = defineLevel({
  id: 'w1-10',
  name: '1-10',
  title: "L'ultima bandiera. Giuro",
  sky: 'sunset',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — niente respiro. Il livello comincia con il terreno che scatta e il
    // nastro che ti ci porta sopra: è una dichiarazione d'intenti.
    segment({
      ground: true,
      rows: {
        12: '            O',
        13: '#####>>>>>>>>#######',
      },
    }),

    // 1 — tre blocchi premio, tutti bugiardi, sopra un corridoio con le
    // piastre. I funghi escono mentre si sta già saltando qualcos'altro.
    segment({
      ground: true,
      rows: {
        8: '   B   B   B',
        12: '  !   AA    !   AA  ',
      },
    }),

    // 2 — il vuoto, con il blocco invisibile piazzato all'altezza esatta del
    // salto pieno. La fossa è larga quattro colonne, cioè si scavalca anche
    // con un saltello: chi dosa passa sotto il blocco, chi tiene premuto lo
    // trova con la testa e finisce sugli spuntoni. È il salto ad altezza
    // variabile che diventa la trappola.
    segment({
      rows: {
        9: '       I',
        13: '#####    ###########',
        14: '#####XXXX###########',
      },
    }),

    // 3 — assi marce con la stalattite sopra e la bestia appesa in fondo. La
    // terza asse è un fantasma, e sta esattamente dove serve fermarsi.
    segment({
      rows: {
        4: '              Z',
        7: '   T     T',
        11: ' DD   DD   LD   DD  ',
        13: '                  ##',
        14: '                  ##',
      },
    }),

    // 4 — checkpoint vero, e subito dopo il pavimento che non c'è: il tratto
    // di terra finta comincia mezza colonna dopo la lanterna, così chi corre
    // per festeggiare ci finisce dentro.
    segment({
      ground: true,
      rows: {
        12: '  S         G     J',
        13: '#####VVVV###########',
        14: '#####    ###########',
      },
    }),

    // 5 — prima bandiera. Falsa, ovviamente, e messa in cima a una salita di
    // blocchi con il masso pronto sopra la rincorsa.
    segment({
      ground: true,
      rows: {
        3: '          K',
        5: '        F',
        6: '        F',
        7: '        FF',
        8: '     ####',
        12: '   M      m     O',
      },
    }),

    // 6 — il corridoio della fabbrica: nastro sotto, lame sopra, piastre in
    // mezzo e la moneta avvelenata appesa dove uno passerebbe comunque.
    segment({
      rows: {
        6: '      YYY    YYY',
        9: '           E',
        12: '     A       A     ',
        13: '>>>>>>>>>>>>>>>>>>>>',
        14: '####################',
      },
    }),

    // 7 — seconda bandiera, in fondo a un ponte di assi sopra la fossa. Chi ci
    // arriva ha già capito che non è quella, e infatti la trappola vera è
    // l'asse fantasma che ci porta sopra.
    segment({
      rows: {
        6: '             F',
        7: '             F',
        8: '             F',
        11: '  DD   LD   DD   DD ',
        13: '##                ##',
        14: '##XXXXXXXXXXXXXXX###',
      },
    }),

    // 8 — l'ultimo checkpoint, la pattuglia mista e i due nastri contrapposti
    // sopra il tratto di terreno che scatta. Il posto peggiore per fermarsi a
    // pensare, ed è esattamente lì che viene voglia di farlo.
    segment({
      ground: true,
      rows: {
        12: ' S  J   O     G   J ',
        13: '####>>>>>><<<<<<####',
      },
    }),

    // 9 — l'ultima molla del gioco, e l'ultima bandiera. Una delle due mente,
    // e a questo punto della partita si sa già quale: tutte e due.
    segment({
      ground: true,
      rows: {
        8: '        Q',
        12: '    m  !    O   W',
      },
    }),
  ],
});

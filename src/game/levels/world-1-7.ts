import { defineLevel, segment } from './level';

/**
 * 1-7 — "Piove roba".
 *
 * Il livello del temporale, e l'unico in cui la minaccia arriva quasi sempre
 * dall'alto. Fin qui il giocatore ha imparato a controllare due cose: dove
 * mette le zampe e cosa ha davanti. Qui gliene serve una terza, e non c'è
 * tempo per tutte e tre.
 *
 * Le cose che cadono sono tre e si somigliano: il mattone `T` avvisa con un
 * tremolio, il masso `K` non avvisa affatto, la bestia `Z` apre le ali un
 * istante prima di staccarsi. Sono tutte deterministiche — cadono quando ci
 * passi sotto, sempre nello stesso punto — quindi il livello si impara. Ma si
 * impara guardando in su, e guardare in su, qui, significa non guardare dove
 * si atterra.
 */
export const WORLD_1_7 = defineLevel({
  id: 'w1-7',
  name: '1-7',
  title: 'Piove roba',
  sky: 'storm',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro, con la prima cosa che cade in fondo: sta lì per insegnare
    // che qui si guarda in alto. È l'ultima che lo dice gratis.
    segment({
      ground: true,
      rows: {
        8: '              T',
        12: '                  O',
      },
    }),

    // 1 — tre mattoni in fila sopra un corridoio stretto quanto un gatto: le
    // stalattiti cadono una dopo l'altra nel verso in cui si sta correndo.
    segment({
      ground: true,
      rows: {
        7: '  T    T    T',
        12: '     !     G     !',
      },
    }),

    // 2 — il vuoto, con la bestia appesa esattamente sopra l'appoggio di mezzo.
    // Fermarsi a guardarla è già la risposta sbagliata.
    segment({
      rows: {
        3: '        Z',
        11: '   DD   DD   LD   D',
        13: '##                ##',
        14: '##                ##',
      },
    }),

    // 3 — il masso non avvisa. È in mezzo a due mattoni che invece avvisano,
    // così l'orecchio impara il ritmo sbagliato.
    segment({
      ground: true,
      rows: {
        6: '      K',
        7: '  T        T',
        12: '    AA       O   G',
      },
    }),

    // 4 — checkpoint vero, subito dopo il pezzo peggiore. Da qui in poi si
    // ricomincia da qui, ed è l'unica gentilezza del livello.
    segment({
      ground: true,
      rows: {
        12: '   S      N      G',
      },
    }),

    // 5 — corridoio della grondaia: nastro sotto, bestie sopra, e il pavimento
    // che finisce tre colonne prima di dove sembra.
    segment({
      rows: {
        3: '    Z      Z',
        13: '>>>>>>>>>>>>>>>#####',
        14: '####################',
      },
    }),

    // 6 — quattro colonne di terra finta subito dopo il nastro: il nastro dà
    // la velocità, la terra finta toglie il pavimento, e le due cose insieme
    // fanno un tuffo che nessuno ha chiesto.
    segment({
      ground: true,
      rows: {
        8: '        Q',
        12: '   !        m     G',
        13: '#####VVVV###########',
        14: '#####    ###########',
      },
    }),

    // 7 — la bandiera in mezzo alla pioggia, con il masso sopra la rincorsa e
    // la molla che invita a saltarla dall'alto. Non è la bandiera.
    segment({
      ground: true,
      rows: {
        4: '           K',
        6: '        F',
        7: '        F',
        8: '        F',
        12: 'S    M      !   J',
      },
    }),

    // 8 — l'ultimo ponte: due assi, una fantasma, e sopra ognuna un mattone
    // armato. Qui si passa solo se si è già capito quale cede per prima.
    segment({
      rows: {
        6: '   T    T    T',
        11: '  DD   LD   DD   >>',
        13: '##               ###',
        14: '##XXXXXXXXXXXXXXX###',
      },
    }),

    // 9 — arrivo, sotto l'ultimo mattone del livello.
    segment({
      ground: true,
      rows: {
        7: '     T',
        12: '        O   !  W',
      },
    }),
  ],
});

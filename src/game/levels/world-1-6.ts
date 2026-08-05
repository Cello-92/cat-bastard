import { defineLevel, segment } from './level';

/**
 * 1-6 — "Reparto molle".
 *
 * Un livello su un'idea sola: la molla. In 1-5 ce n'erano tre e una era una
 * tagliola; qui sono dodici e non si distinguono. Il gioco smette di chiedere
 * "questa piattaforma reggerà?" e comincia a chiedere "questa molla mi lancia
 * o mi chiude addosso?", che è una domanda peggiore perché la molla, a
 * differenza della piattaforma, non si può evitare camminandoci intorno: la
 * si scavalca, o la si prende.
 *
 * La seconda regola del reparto è che una molla non è mai un problema da sola.
 * Lo diventa per via di quello che ha sopra: un soffitto chiodato trasforma la
 * spinta in una condanna, e in quel caso saltarci sopra è l'unico errore che
 * il livello non perdona.
 */
export const WORLD_1_6 = defineLevel({
  id: 'w1-6',
  name: '1-6',
  title: 'Reparto molle',
  sky: 'day',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — la molla di presentazione: in mezzo alla strada, senza niente sopra.
    // Non si può scansare, e infatti non serve: lancia e basta.
    segment({
      ground: true,
      rows: { 12: '            M' },
    }),

    // 1 — la stessa molla, con le lame appese sopra. Adesso prenderla è morire:
    // va scavalcata, e per scavalcarla bisogna saltare *meno* di quanto viene
    // naturale, perché anche il salto pieno finisce contro il soffitto.
    segment({
      ground: true,
      rows: {
        9: '      YYYY',
        12: '       M      G',
      },
    }),

    // 2 — nastro che accompagna dritto sulla molla numero tre, che è una
    // tagliola. Il nastro non lascia il tempo di decidere: la decisione va
    // presa prima di salirci.
    segment({
      ground: true,
      rows: {
        12: '        m',
        13: '##>>>>>>>>>>>#######',
      },
    }),

    // 3 — le assi sopra la fossa di spuntoni, con la stalattite armata sopra la
    // seconda. Il checkpoint è dopo, non prima: questo pezzo si rifà.
    segment({
      rows: {
        7: '        T',
        11: '  DD   DD   LD   DD',
        13: '##                ##',
        14: '##XXXXXXXXXXXXXXXX##',
      },
    }),

    // 4 — respiro con lanterna vera, e il primo dubbio serio del livello: due
    // molle affiancate, una lancia e una no. La differenza è dove si atterra.
    segment({
      ground: true,
      rows: {
        12: '  S      M m     G',
      },
    }),

    // 5 — la molla di sinistra è vera e porta sul ripiano alto, che è comodo
    // finché non finisce: sotto il suo bordo c'è la fossa di spuntoni, e chi
    // ci cammina sopra fino in fondo ci cade dentro. La molla di destra è una
    // tagliola, e ha comunque le lame sopra: sarebbe stata inutile lo stesso.
    segment({
      rows: {
        5: '           YYY',
        6: '   #####',
        12: '  M        m     G',
        13: '#######    #########',
        14: '#######XXXX#########',
      },
    }),

    // 6 — bandiera finta in cima alla salita, perché in cima a una salita è
    // dove uno la vorrebbe. Il passaggio vero resta in basso, sotto il masso
    // che aspetta di sentire i passi.
    segment({
      ground: true,
      rows: {
        4: '           K',
        6: '        F',
        7: '        F',
        8: '        FFF',
        9: '     ####',
        12: '  G      !    O   J',
      },
    }),

    // 7 — due nastri contrapposti sul bordo della fossa. Stare fermi non è
    // un'opzione: qualunque cosa si faccia, il pavimento fa qualcosa.
    segment({
      rows: {
        3: '          Z',
        12: '                !',
        13: '>>>>><<<<<#    #####',
        14: '##########XXXXX#####',
      },
    }),

    // 8 — corridoio finale: pattuglia, piastre, monete. Quella in mezzo è
    // avvelenata come sempre, e come sempre nessuno obbliga a prenderla —
    // motivo per cui le tre monete stanno sopra il terreno pieno e non sopra
    // le piastre: una moneta avvelenata dentro l'unico arco utile non è una
    // trappola, è un muro (ed è il bug per cui esiste il risolutore).
    segment({
      ground: true,
      rows: {
        9: '          C E C',
        12: 'S J AA   O    G AA J',
      },
    }),

    // 9 — arrivo. Con l'ultima molla del reparto sul cammino, e il blocco
    // onesto sopra la testa a fare da testimone.
    segment({
      ground: true,
      rows: {
        8: '      Q',
        12: '      m    !  W',
      },
    }),
  ],
});

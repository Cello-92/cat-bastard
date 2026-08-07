import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-10 — "L'esame".
 *
 * Come 1-10, 2-10 e 3-10: niente di nuovo, tutto insieme. Solo che qui "tutto"
 * vuol dire davvero tutto, "insieme" vuol dire nella stessa schermata, e il
 * livello è lungo dodici segmenti invece di dieci perché dieci non bastavano a
 * metterci dentro tutto il gioco.
 *
 * La regola che lo tiene in piedi è una sola ed è dichiarata: **non c'è nessuna
 * regolarità**. Nei nove livelli precedenti un campo spento arrivava dopo due
 * veri, una moneta esca stava lontana da una vera, una lanterna finta si
 * riconosceva perché quella buona era due segmenti prima. Qui no. Vere e finte
 * si alternano senza schema — a volte due finte di fila, a volte quattro vere —
 * e l'unica informazione affidabile resta il ferro, cioè le zavorre e i
 * pendoli. Che qui sono rari apposta.
 *
 * Non esiste un tratto di corsa libera in tutto il livello. Ogni segmento ha
 * fra le sei e le dieci cose che ammazzano, e nessuna è nuova: sono tutte
 * trappole che il giocatore ha già visto e già imparato, messe una accanto
 * all'altra in modo che la risposta giusta a una sia la risposta sbagliata a
 * quella dopo.
 *
 * Il gomitolo si nasconde **dietro una trappola**. La cella che porta alla
 * stanza è un campo spento in mezzo alla passerella, cioè esattamente la cosa
 * che in questo mondo ha ucciso più di ogni altra e che a questo punto si
 * riconosce a colpo d'occhio. Buttarcisi dentro apposta richiede di aver capito
 * una cosa in più di quella che il mondo ha insegnato: che un buco è un posto,
 * e non tutti i posti sono il vuoto.
 */

const LOW = 'b'.repeat(SEGMENT_COLS);
const UP = 'b'.repeat(SEGMENT_COLS);
const FIELD = 'u'.repeat(SEGMENT_COLS);

export const WORLD_4_10 = defineLevel({
  id: 'w4-10',
  name: '4-10',
  title: "L'esame",
  sky: 'reverse',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — quattordici colonne di pavimento, e dentro ce ne stanno nove di
    // roba: la tagliola, il terreno che non c'è, gli spuntoni che scattano e
    // quelli che non si vedono, il blocco premio col fungo, la bestia appesa,
    // il masso che crolla, il nemico con le punte sotto e una moneta che non è
    // una moneta. È la dichiarazione d'intenti del livello.
    segment({
      rows: {
        2: UP,
        3: '      K       uuzuuu',
        4: '              uuuuuu',
        5: '              uuuuuu',
        6: '        Z     uuuuuu',
        7: '              uuuuuu',
        8: '              uuuuuu',
        9: '     B        uuuuuu',
        10: '              uuuuuu',
        11: '        E  C  uuuuuu',
        12: '   C m J   !  uuuuuu',
        13: 'bbbbObVVbb!bbb',
        14: 'bbbbbbbbbbbbbb',
      },
    }),

    // 1 — due salti fra soffitti, e tutte e due le piazzole d'arrivo hanno la
    // prima cella spenta: chi salta la distanza che vede muore, perché la
    // distanza giusta è una colonna più in là. In mezzo al primo vuoto
    // galleggia una piattaforma, e sparisce appena la sfiori.
    segment({
      rows: {
        2: 'bbbbb   bbbbbb   bbb',
        3: 'uuuuu   nuuuYu   nuu',
        4: 'uuuuu   nuuuuu   nuu',
        5: 'uuuuu   nuuuuu   nuu',
        6: 'uuuuu   nuuuuu   nuu',
        7: 'uuuuuLL nuuuuu   nuu',
        8: 'uuuuu   nuuuuu   nuu',
        9: 'uuuuu   nuuuuu   nuu',
        10: 'uuuuu   nuuuuu   nuu',
        11: 'uuuuu   nuuuuu   nuu',
        12: 'uuuuu   nuuuuu   nuu',
      },
    }),

    // 2 — la passerella con tre buchi che luccicano, due ragni e un pendolo
    // capovolto piazzato fra il secondo buco e il terzo. I buchi non sono
    // equidistanti e non sono in nessun ordine: contarli non serve,
    // ricordarseli sì.
    segment({
      rows: {
        2: UP,
        3: 'uuauunuuuuuunuuauunu',
        4: 'uuuuunuuuuuunuuuuunu',
        5: 'uuuuunuuuuuunuuuuunu',
        6: 'uuuuunuuuuuunuuuuunu',
        7: 'uuuuunuuutuunuuuuunu',
        8: 'uuuuunuuubuunuuuuunu',
        9: 'uuuuunuuuuuunuuuuunu',
        10: 'uuuuunuuuuuunuuuuunu',
        11: 'uuuuunuuuuuunuuuuunu',
        12: 'uuuuunuuuuuunuuuuunu',
      },
    }),

    // 3 — checkpoint, e il gomitolo. La cella spenta al centro è identica alle
    // tre che hanno appena ammazzato, ma sotto non c'è il vuoto: c'è una cassa
    // di basalto larga una cella. Per uscirne basta un salto e uno scarto di
    // lato — per entrarci basta fare la cosa che il livello punisce da settanta
    // colonne.
    segment({
      rows: {
        2: UP,
        3: 'uSuuuuuuuunuuuuuuuuu',
        4: 'uuuuuuuuub*buuuuuuuu',
        5: 'uuuuuuuuub buuuuuuuu',
        6: 'uuuuuuuuubbbuuuuuuuu',
        7: FIELD,
        8: FIELD,
        9: FIELD,
        10: FIELD,
        11: FIELD,
        12: FIELD,
      },
    }),

    // 4 — a terra, e a terra c'è il campionario completo del primo mondo in
    // venti colonne: la tagliola, la molla vera due passi dopo, il terreno che
    // non c'è, l'asse che si sbriciola, gli spuntoni invisibili, quelli che
    // scattano, quelli con la feritoia, la sentinella, il masso che crolla e le
    // lame sul soffitto. Dieci trappole, nessuna nuova.
    segment({
      rows: {
        5: '          K',
        7: '   YYYY       YYY',
        10: '       N',
        12: '  m  M      !  H  C ',
        13: 'bbbbbbbVVbDDbbObbAbb',
        14: LOW,
      },
    }),

    // 5 — la selva, con le bestie appese sopra e gli spuntoni invisibili sotto.
    // Quattro colonne, una sola vera, e nessun cartello: l'unico modo di
    // saperlo è provarle, e provarle costa tre morti su quattro. La sentinella
    // fa avanti e indietro davanti alla terza, che è quella sbagliata.
    segment({
      rows: {
        2: ' bbb bbb  bbb  bbb  ',
        3: ' nnn nnn  nnn  uuu  ',
        4: ' nnn nnn  nnn  uuu  ',
        5: ' nnnZnnn  nnnZ uuu  ',
        6: ' nnn nnn  nnn  uuu  ',
        7: ' nnn nnn  nnn  uuu  ',
        8: ' nnn nnn  nnn  uuu  ',
        9: ' nnn nnn  nnn  uuu  ',
        10: ' nnn nnn  nnn  uuu  ',
        11: ' nnn nnn  nnn  uuu  ',
        12: ' nnn nnn! nnn! uuu H',
        13: LOW,
        14: LOW,
      },
    }),

    // 6 — la passerella più stretta del gioco: due ragni ai capi, un pendolo
    // capovolto in mezzo, un salto subito dietro il pendolo e una lama
    // sull'arrivo. Ogni pezzo comincia dove finisce quello prima, e non c'è un
    // solo tick in cui si possa stare fermi a guardare.
    segment({
      rows: {
        2: 'bbbbbbbbbb   bbbbbbb',
        3: 'uuauuuuuuu   uYuuuau',
        4: 'uuuuuuuuuu   uuuuuuu',
        5: 'uuuuuuuuuu   uuuuuuu',
        6: 'uuuuuuuuuu   uuuuuuu',
        7: 'uuuutuuuuu   uuuuuuu',
        8: 'uuuubuuuuu   uuuuuuu',
        9: 'uuuuuuuuuu   uuuuuuu',
        10: 'uuuuuuuuuu   uuuuuuu',
        11: 'uuuuuuuuuu   uuuuuuu',
        12: 'uuuuuuuuuu   uuuuuuu',
      },
    }),

    // 7 — checkpoint a terra, e la pozza col blocco invisibile. Il blocco sta
    // esattamente dove arriva la testa a metà salto: chi parte convinto si
    // ferma a mezz'aria e cade dentro. È la trappola più vecchia del gioco e
    // funziona ancora, perché a questo punto nessuno guarda più il pavimento —
    // e infatti accanto ce ne sono altre quattro che stanno proprio lì.
    segment({
      rows: {
        2: UP,
        6: '            K',
        9: '        I',
        11: '   N            E',
        12: '  S           m   C ',
        13: 'bbbbbb    bbb!bbObbb',
        14: 'bbbbbb    bbbbbbbbbb',
      },
    }),

    // 8 — due piani insieme. Di sopra la passerella ha due buchi veri; di sotto
    // il pavimento c'è, ma è pieno di denti — e le due cose non si vedono mai
    // insieme, perché quando sei di sopra il pavimento è fuori dallo schermo e
    // quando sei di sotto lo è la passerella.
    segment({
      rows: {
        2: 'bbbbbb bbbbbbb bbbbb',
        3: 'uuuuuu uuuuuuu uuuuu',
        4: 'uuuuuu uuuuuuu uuuuu',
        5: 'uuuuuu uuuuuuu uuuuu',
        6: 'uuuuuu uuuuuuu uuuuu',
        7: 'uuuuuu uuuuuuu uuuuu',
        8: 'uuuuuu uuuuuuu uuuuu',
        9: 'uuuuuu uuuuuuu uuuuu',
        10: 'uuuuuu uuuuuuu uuuuu',
        11: 'uuuuuu uuuuuuu uuuuu',
        12: 'uuuuuuEuuuuuuu uuuuu',
        13: 'bbbObb!bbbAbbbbObbbb',
        14: LOW,
      },
    }),

    // 9 — cinque colonne, una sola vera, e sopra la strada tre mattoni con
    // altrettante zavorre appoggiate. Passarci sotto le fa partire tutte e
    // tre: da lì in poi c'è mezzo secondo per scegliere la colonna giusta, e
    // sceglierla sbagliata non è più una morte, sono due.
    segment({
      rows: {
        2: ' bb  bb  bb  bb  bb ',
        3: ' nn  nn  uu  nn  nn ',
        4: ' nn  nn  uu  nn  nn ',
        5: ' nnzznn zuu  nn  nn ',
        6: ' nnTTnn Tuu  nnzznn ',
        7: ' nn  nn  uu  nnTTnn ',
        8: ' nn  nn  uu  nn  nn ',
        9: ' nn  nn  uu  nn  nn ',
        10: ' nn  nn  uu  nn  nn ',
        11: ' nn  nn  uu  nn  nn ',
        12: ' nn  nn  uu  nn  nn ',
        13: LOW,
        14: LOW,
      },
    }),

    // 10 — l'ultima passerella, e ha una cella spenta a due colonne dal salto:
    // si esce dal buco, si vola, si atterra, e la cella dopo non tiene. Due
    // errori diversi nello stesso mezzo secondo, e il secondo si può fare solo
    // dopo aver evitato il primo.
    segment({
      rows: {
        2: 'bbbbbbb   bbbbbbbbbb',
        3: 'uuunuuu   uunuuauuuu',
        4: 'uuunuuu   uunuuuuuuu',
        5: 'uuunuuu   uunuuuuuuu',
        6: 'uuunuuu   uunuuuuuuu',
        7: 'uuunuuu   uunuutuuuu',
        8: 'uuunuuu   uunuubuuuu',
        9: 'uuunuuu   uunuuuuuuu',
        10: 'uuunuuu   uunuuuuuuu',
        11: 'uuunuuu   uunuuuuuuu',
        12: 'uuunuuu   uunuuuuuuu',
      },
    }),

    // 11 — l'arrivo è sul soffitto, e prima ci sono tre bandiere sbagliate: una
    // appesa dove ti aspetteresti quella giusta, una a terra dove non guarda
    // più nessuno, e una a due colonne da quella vera. Più un'ultima moneta che
    // non è una moneta e un'ultima cella di niente, perché sarebbe stato
    // scortese finire senza.
    segment({
      rows: {
        2: UP,
        3: 'uuuFuuuuuuuFuunuWuuu',
        4: 'uuuFuuuuuuuFuuuuWuuu',
        5: FIELD,
        6: FIELD,
        7: FIELD,
        8: 'uuuuuuuEuuuuuuuuuuuu',
        9: FIELD,
        10: FIELD,
        11: 'uuuuuuuuFuuuuuuuuuuu',
        12: 'uuuuuuuuFuuuuuuuuuuu',
        13: LOW,
        14: LOW,
      },
    }),
  ],
});

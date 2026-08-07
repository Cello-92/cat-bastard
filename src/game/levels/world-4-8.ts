import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-8 — "Il ronzio".
 *
 * Fino a qui i campi spenti erano l'eccezione: uno per segmento, piazzato dove
 * faceva più male. Qui sono la **maggioranza**. Su diciassette colonne che
 * luccicano ne funzionano cinque, e non c'è nessuna regolarità da dedurre —
 * non si alternano, non stanno agli estremi, non sono le più larghe.
 *
 * Il che rende questo livello un livello di lettura, non di esecuzione. Le
 * cinque vere si riconoscono tutte, sempre, da qualcosa che sta lì apposta: una
 * zavorra appoggiata al soffitto invece che a terra, un pendolo che oscilla in
 * su invece che in giù. Il ferro non mente mai, è la regola su cui il mondo si
 * regge, e questo è il livello che la mette alla prova — perché a volte il
 * cartello è lontano dalla colonna a cui si riferisce, e bisogna guardarlo
 * prima di essere arrivati.
 *
 * Il gomitolo sta su una mensola in mezzo al vuoto, sotto la passerella. Si
 * vede benissimo. Per arrivarci bisogna staccarsi dal soffitto **prima** del
 * punto giusto, cioè fare apposta l'errore che in questo livello ammazza.
 */

const LOW = 'b'.repeat(SEGMENT_COLS);
const FIELD = 'u'.repeat(SEGMENT_COLS);

export const WORLD_4_8 = defineLevel({
  id: 'w4-8',
  name: '4-8',
  title: 'Il ronzio',
  sky: 'reverse',
  spawn: { c: 1, r: 12 },
  segments: [
    // 0 — tre colonne, e una sola zavorra in tutto il segmento. È appoggiata al
    // soffitto della terza: quindi la terza è vera e le altre due no, e lo si
    // sa da venti colonne di distanza se si è guardato.
    segment({
      rows: {
        2: '  nnnn  nnnn  oooooo',
        3: '  nnnn  nnnn  uuzuuu',
        4: '  nnnn  nnnn  uuuuuu',
        5: '  nnnn  nnnn  uuuuuu',
        6: '  nnnn  nnnn  uuuuuu',
        7: '  nnnn  nnnn  uuuuuu',
        8: '  nnnn  nnnn  uuuuuu',
        9: '  nnnn  nnnn  uuuuuu',
        10: '  nnnn  nnnn  uuuuuu',
        11: '  nnnn  nnnn  uuuuuu',
        12: 'C nnnn  nnnn  uuuuuu',
        13: LOW,
        14: LOW,
      },
    }),

    // 1 — la passerella, con due buchi veri e due spenti. I buchi veri si
    // vedono (manca la pietra), quelli spenti no: sotto c'è il vuoto per tutti
    // e quattro, quindi la differenza non è fra vivere e morire, è fra
    // saperlo prima e saperlo dopo.
    segment({
      rows: {
        2: 'bbbbb bbbbbbbb bbbbb',
        3: 'uuuuu unnuuuuu uuuuu',
        4: 'uuuuu unnuuuuu uuuuu',
        5: 'uuuuu unnuuuuu uuuuu',
        6: 'uuuuu unnuuuuu uuuuu',
        7: 'uuuuu unnuuuuu uuuuu',
        8: 'uuuuu unnuuuuu uuuuu',
        9: 'uuuuu unnuuuuu uuuuu',
        10: 'uuuuu unnuuuuu uuuuu',
        11: 'uuuuu unnuuuuu uuuuu',
        12: 'uuuuu unnuuuuu uuuuu',
      },
    }),

    // 2 — il gomitolo. La mensola è appesa in mezzo al vuoto, tre righe sotto la
    // passerella, e si vede da sopra: chi prosegue dritto ci passa esattamente
    // sopra. Per prenderlo bisogna staccarsi dal soffitto prima di essere
    // arrivati in fondo alla colonna, che in questo livello è il modo standard
    // di morire.
    segment({
      rows: {
        2: 'bbbbbbb    bbbbbbbbb',
        3: 'uuuuuuu    uuuuuuuuu',
        4: 'uuuuuuu    uuuuuuuuu',
        5: 'uuuuuuu    uuuuuuuuu',
        6: 'uuuuuuu    uuuuuuuuu',
        7: 'uuuuuuu *  uuuuuuuuu',
        8: 'uuuuuuubbb uuuuuuuuu',
        9: 'uuuuuuu    uuuuuuuuu',
        10: 'uuuuuuu    uuuuuuuuu',
        11: 'uuuuuuu    uuuuuuuuu',
        12: 'uuuuuuu    uuuuuuuuu',
      },
    }),

    // 3 — checkpoint sul soffitto, e i droni. Volano su una rotta fissa da
    // prima che tu arrivassi e non ti stanno cercando: sono l'unica cosa
    // quaggiù che si comporti come ci si aspetta, e infatti si schiacciano.
    segment({
      rows: {
        2: LOW,
        3: 'uSuuuuuuuuuuuuuuuuuu',
        4: FIELD,
        5: FIELD,
        6: 'uuuuu%uuuuuuuu%uuuuu',
        7: FIELD,
        8: FIELD,
        9: FIELD,
        10: FIELD,
        11: FIELD,
        12: FIELD,
        13: '      bbbbbbbb',
        14: '      bbbbbbbb',
      },
    }),

    // 4 — a terra, in una selva di colonne. Ce n'è una sola vera e la dice un
    // pendolo: oscilla verso l'alto, quindi lì il basso è in su. Le altre
    // cinque hanno lo stesso identico luccichio e portano tutte allo stesso
    // posto, cioè da nessuna parte.
    segment({
      rows: {
        2: ' nnn nnn nnn uuu nnn',
        3: ' nnn nnn nnn uuu nnn',
        4: ' nnn nnn nnn uuu nnn',
        5: ' nnn nnn nnn uuu nnn',
        6: ' nnn nnn nnn uuu nnn',
        7: ' nnn nnn nnn utu nnn',
        8: ' nnn nnn nnn ubu nnn',
        9: ' nnn nnn nnn uuu nnn',
        10: ' nnn nnn nnn uuu nnn',
        11: ' nnn nnn nnn uuu nnn',
        12: 'CnnnEnnn nnn uuu nnn',
        13: LOW,
        14: LOW,
      },
    }),

    // 5 — la colonna vera del segmento prima porta qui, su un soffitto stretto
    // sospeso sul vuoto. Sotto non c'è più il pavimento: da adesso in poi
    // sbagliare colonna non vuol dire perdere tempo, vuol dire cadere.
    segment({
      rows: {
        2: 'bbbbbbbb   bbbbbbbbb',
        3: 'uuuYuuuu   uuuuuYuuu',
        4: 'uuuuuuuu   uuuuuuuuu',
        5: 'uuuuuuuu   uuuuuuuuu',
        6: 'uuuuuuuu   uuuuuuuuu',
        7: 'uuuuuuuu   uuuuuuuuu',
        8: 'uuuuuuuu   uuuuuuuuu',
        9: 'uuuuuuuu   uuuuuuuuu',
        10: 'uuuuuuuu   uuuuuuuuu',
        11: 'uuuuuuuu   uuuuuuuuu',
        12: 'uuuuuuuu   uuuuuuuuu',
      },
    }),

    // 6 — quattro tratti di soffitto separati da tre campi spenti larghi due.
    // Un campo spento largo due non si scavalca camminando e non si attraversa
    // cadendo: si salta, verso il basso, e si riatterra sul soffitto di là.
    segment({
      rows: {
        2: LOW,
        3: 'uuuuunnuuuuunnuuuuuu',
        4: 'uuuuunnuuuuunnuuuuuu',
        5: 'uuuuunnuuuuunnuuuuuu',
        6: 'uuuuunnuuuuunnuuuuuu',
        7: 'uuuuunnuuuuunnuuuuuu',
        8: 'uuuuunnuuuuunnuuuuuu',
        9: 'uuuuunnuuuuunnuuuuuu',
        10: 'uuuuunnuuuuunnuuuuuu',
        11: 'uuuuunnuuuuunnuuuuuu',
        12: 'uuuuunnuuuuunnuuuuuu',
        13: '   bbbbbbbbbbbbbb',
        14: '   bbbbbbbbbbbbbb',
      },
    }),

    // 7 — checkpoint a terra, e le vecchie conoscenze. In un livello che chiede
    // solo di guardare le colonne, gli spuntoni invisibili sul pavimento sono
    // la cosa più sleale possibile, ed è per questo che stanno qui.
    segment({
      rows: {
        10: '           N',
        12: '  S    !       m  C',
        13: 'bbbbbbbbbbbbbbbbObbb',
        14: LOW,
      },
    }),

    // 8 — l'esame. Tre colonne, una vera, il cartello è una zavorra piazzata
    // sopra la seconda per confondere: sta a terra, quindi la seconda è
    // spenta, e il fatto che sia l'unica zavorra del segmento non vuol dire
    // che indichi quella buona. Non c'è nessuna scorciatoia logica: la vera è
    // la terza, e si scopre guardando che lì sotto il pavimento non c'è.
    segment({
      rows: {
        2: ' nnnn  nnnn   bbbbbb',
        3: ' nnnn  nnnn   uuuuuu',
        4: ' nnnn  nnnn   uuuuuu',
        5: ' nnnn  nnnn   uuuuuu',
        6: ' nnnn  nnnn   uuuuuu',
        7: ' nnnn  nnnn   uuuuuu',
        8: ' nnnn  nnnn   uuuuuu',
        9: ' nnnn  nnnn   uuuuuu',
        10: ' nnnn  nnnn   uuuuuu',
        11: ' nnnn  nnnn   uuuuuu',
        12: ' nnnn  nnnz   uuuuuu',
        13: 'bbbbbbbbbbbbb',
        14: 'bbbbbbbbbbbbb',
      },
    }),

    // 9 — l'arrivo sta sul soffitto, ed è la prima volta. Dopo un livello
    // intero passato a cercare la colonna che porta su, l'ultima si vede
    // benissimo: è quella con la bandiera sopra.
    segment({
      rows: {
        2: 'bbbbbbbbbbbbbbbbbbbb',
        3: 'uuuuuuuuuuuFuuWuuuuu',
        4: 'uuuuuuuuuuuFuuWuuuuu',
        5: FIELD,
        6: FIELD,
        7: FIELD,
        8: FIELD,
        9: FIELD,
        10: FIELD,
        11: FIELD,
        12: FIELD,
      },
    }),
  ],
});

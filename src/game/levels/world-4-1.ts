import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-1 — "Il basso è una convenzione".
 *
 * Il primo mondo cambiava quello che c'è nel livello, il secondo come risponde
 * il pavimento, il terzo cosa fa l'aria. Questo cambia **da che parte si
 * cade**, e siccome è la cosa più grossa che il gioco abbia mai fatto alla
 * fisica, il livello la insegna nell'ordine più lento che si possa immaginare:
 * una colonna che funziona (segmento 1), una identica che non funziona
 * (segmento 2), e solo dopo tutto il resto.
 *
 * L'ordine non è gentilezza. La colonna spenta del segmento 2 fa ridere solo
 * se un minuto prima quella vera ha funzionato: è la stessa costruzione del
 * getto spento del mondo 2 e della corrente morta del mondo 3, e come loro
 * arriva **dopo** che il giocatore si è fidato. La pozza sotto è larga cinque
 * colonne, cioè saltabile: chi non si fida può scavalcarla, chi si fida cade.
 */

const FLOOR = 'o'.repeat(SEGMENT_COLS);
/** Una colonna di campo alta dal soffitto al pavimento, per riga. */
const FIELD = (at: number, width: number, tile = 'u'): string =>
  ' '.repeat(at) + tile.repeat(width);

export const WORLD_4_1 = defineLevel({
  id: 'w4-1',
  name: '4-1',
  title: 'Il basso è una convenzione',
  sky: 'spire',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — in cima alla torre non c'è niente da fare per venti colonne. Serve a
    // guardarsi intorno: il cielo è sotto l'orizzonte e le montagne sono in
    // fondo, quindi si capisce quanto è alto questo posto prima di scoprire
    // quanto si cade.
    segment({ rows: { 12: '        C  C', 13: FLOOR, 14: FLOOR } }),

    // 1 — il primo campo, ed è onesto. Una parete di basalto troppo alta per
    // scavalcarla, e sotto la passerella una colonna che luccica: si entra, si
    // cade **verso il soffitto**, e da lassù si cammina fino in fondo. La
    // pozza sotto è larga dieci colonne apposta — non c'è nessun'altra strada,
    // quindi la regola si impara qui o non si impara.
    segment({
      rows: {
        4: '    oooooooooo',
        5: FIELD(4, 10),
        6: FIELD(4, 10),
        7: FIELD(4, 10),
        8: FIELD(4, 10),
        9: FIELD(4, 10),
        10: FIELD(4, 10),
        11: FIELD(4, 10),
        12: FIELD(4, 10),
        13: 'oooo          oooooo',
        14: 'oooo          oooooo',
      },
    }),

    // 2 — la stessa cosa, spenta. Stesso soffitto, stessa colonna, stesso
    // ronzio, e una moneta a mezz'aria a dire "vieni". Non capovolge niente.
    // La pozza è larga cinque, cioè si scavalca: la trappola non è il buco, è
    // aver imparato una regola venti colonne fa.
    segment({
      rows: {
        4: '     oooooo',
        5: FIELD(5, 6, 'n'),
        6: FIELD(5, 6, 'n'),
        7: FIELD(5, 6, 'n'),
        8: '     nnCnnn',
        9: FIELD(5, 6, 'n'),
        10: FIELD(5, 6, 'n'),
        11: FIELD(5, 6, 'n'),
        12: FIELD(5, 6, 'n'),
        13: 'ooooo      ooooooooo',
        14: 'ooooo      ooooooooo',
      },
    }),

    // 3 — checkpoint, e il primo ragno. Cammina sul soffitto della passerella
    // e non sa niente della gravità: per toglierselo dai piedi bisogna essere
    // capovolti come lui, cioè bisogna essere già lassù. Il blocco premio in
    // mezzo è quello di sempre, e sputa quello che ha sempre sputato.
    segment({
      rows: {
        4: '      oooooooo',
        5: '      uuuauuuu',
        6: FIELD(6, 8),
        7: FIELD(6, 8),
        8: FIELD(6, 8),
        9: '      uuuuuuuu   B',
        10: FIELD(6, 8),
        11: FIELD(6, 8),
        12: ' S    uuuuuuuu',
        13: 'oooooo        oooooo',
        14: 'oooooo        oooooo',
      },
    }),

    // 4 — la passerella con le lame. Sul soffitto le punte pendono all'ingiù,
    // che a testa in giù vuol dire **all'altezza delle zampe**: si scavalcano
    // saltando, e saltare qui significa buttarsi verso il pavimento e tornare
    // su. È l'esercizio che il resto del mondo dà per scontato.
    segment({
      rows: {
        4: 'oooooooooooo',
        5: 'uuuYuuuuuYuu',
        6: 'uuuuuuuuuuuu',
        7: 'uuuuuuuuuuuu',
        8: 'uuuuuuuuuuuu',
        9: 'uuuuuuuuuuuu',
        10: 'uuuuuuuuuuuu',
        11: 'uuuuuuuuuuuu',
        12: 'uuuuuuuuuuuu',
        13: '            oooooooo',
        14: '            oooooooo',
      },
    }),

    // 5 — respiro, e quindi il posto giusto per le trappole vecchie. Il
    // terreno che non c'è, il masso che crolla, la moneta che non è una
    // moneta. Niente di nuovo: è il primo mondo, messo dove fa più male.
    segment({
      rows: {
        7: '        K',
        11: '     E',
        12: '   C     C',
        13: 'ooooVVoooooooooooooo',
        14: 'oooooooooooooooooooo',
      },
    }),

    // 6 — le due colonne gemelle, ed è il segmento che spiega tutto il mondo.
    // Sono identiche a vedersi. Sotto la prima una zavorra è appoggiata al
    // soffitto, sotto la seconda è rimasta a terra: il piombo obbedisce al
    // campo e non mente mai, quindi da lassù e da quaggiù si legge quale delle
    // due porta e quale lascia cadere. Chi guarda le zavorre passa.
    segment({
      rows: {
        4: '  oooooo   oooooo',
        5: '  uuuzuu   nnnnnn',
        6: '  uuuuuu   nnnnnn',
        7: '  uuuuuu   nnnnnn',
        8: '  uuuuuu   nnnnnn',
        9: '  uuuuuu   nnnnnn',
        10: '  uuuuuu   nnnnnn',
        11: '  uuuuuu   nnnnnn',
        12: '  uuuuuu   nnnnnz',
        13: 'oo      ooo     oooo',
        14: 'oo      ooo     oooo',
      },
    }),

    // 7 — checkpoint, e la solita fiera delle cose che non ci sono: la
    // lanterna che non si accende, gli spuntoni che non si vedono, la molla
    // che si chiude. A questo punto del gioco sono vecchie conoscenze, ed è
    // proprio per questo che funzionano ancora.
    segment({
      rows: {
        11: '          N',
        12: '  S    !     m    C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 8 — l'ultima passerella, con il mattone che lascia andare la stalattite
    // proprio sopra il punto in cui si rientra nel campo. La stalattite cade
    // in giù, come tutto quello che non è il gatto: è la prima volta che il
    // mondo lo dice chiaramente, e conviene ricordarselo.
    segment({
      rows: {
        4: '     oooooooo',
        5: FIELD(5, 8),
        6: FIELD(5, 8),
        7: FIELD(5, 8),
        8: FIELD(5, 8),
        9: '     uuuuuuuu',
        10: FIELD(5, 8),
        11: FIELD(5, 8),
        12: FIELD(5, 8),
        13: 'ooooo        ooooooo',
        14: 'ooooo        ooooooo',
      },
    }),

    // 9 — l'arrivo, con la bandiera sbagliata due passi prima. In cima a una
    // torre alta mille metri, l'ultima cosa che si vede è una bandiera che non
    // è quella. Non è una novità nemmeno questa.
    segment({
      rows: {
        11: '    F         W',
        12: '    F     !   W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

import { defineLevel, segment } from './level';

/**
 * 1-3 — "Ci sei quasi (no)".
 *
 * Niente più insegnamenti, solo conferme: ogni trappola è una che il giocatore
 * ha già visto, rimontata al contrario e sovrapposta a un'altra. Una molla non
 * è una trappola; una molla sotto un soffitto chiodato sì. Un pavimento finto
 * non è una trappola; un pavimento finto dopo un checkpoint finto sì.
 *
 * È anche il livello in cui la percentuale di cose oneste scende sotto la metà:
 * da qui in poi il dubbio costa più della fretta.
 */
export const WORLD_1_3 = defineLevel({
  id: 'w1-3',
  name: '1-3',
  title: 'Ci sei quasi (no)',
  sky: 'sunset',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro. L'ultimo, e dura sedici colonne.
    segment({
      ground: true,
      rows: { 12: '                O' },
    }),

    // 1 — tre blocchi premio. Sono tutti e tre bugiardi, e i funghi che ne
    // escono ti inseguono tutti insieme mentre cerchi di passare.
    segment({
      ground: true,
      rows: {
        8: '    B  B  B',
        12: '     !     G   !',
      },
    }),

    // 2 — il blocco invisibile è esattamente dove salteresti, e sotto c'è
    // lo spuntone invece del pavimento. Sopra al blocco, però, c'è un cubo:
    // l'unico modo di prenderlo è farsi fregare apposta dalla trappola e poi
    // salire su quello che ti ha appena rovinato il salto.
    segment({
      rows: {
        8: '    *',
        10: '    I',
        13: '#####   #####  #####',
        14: '#####XXX#####XX#####',
      },
    }),

    // 3 — assi marce col soffitto armato, e in mezzo alla fila una che non
    // esiste. Nessun salto pieno è concesso, nessun appoggio è garantito.
    segment({
      rows: {
        8: '   T    T',
        11: ' DD   LD   DD   DD',
      },
    }),

    // 4 — nemici identici, pavimento a feritoie e una lanterna che non salva
    // niente. Ogni ostacolo è separato dal successivo da almeno tre colonne
    // libere: si passa saltando uno per volta, mai tutti insieme.
    segment({
      ground: true,
      rows: {
        9: '       C',
        12: '  J AA   N   AA J  G',
      },
    }),

    // 5 — il checkpoint vero, e subito dopo il pavimento finto più lungo del
    // gioco: cinque colonne che sembrano terra e sono aria.
    segment({
      ground: true,
      rows: {
        12: '   S',
        13: '########VVVVV#######',
        14: '########     #######',
      },
    }),

    // 6 — bandiera finta in fondo a una salita, due bestie appese sopra la
    // rincorsa e un masso che aspetta di sentirti passare.
    segment({
      ground: true,
      rows: {
        3: '     Z      Z',
        6: '            K',
        8: '         F',
        9: '         F',
        10: '         F',
        12: '      G     !',
      },
    }),

    // 7 — l'ultimo vuoto: solido, marcio, fantasma, solido. E il soffitto
    // chiodato sopra il punto esatto in cui verrebbe da saltare più in alto.
    segment({
      rows: {
        6: '         YYY',
        11: '   ###  DDLD   ###',
      },
    }),

    // 8 — soffitto minato, pattuglia finale, molla in mezzo alla strada e due
    // tratti di terreno che scattano quando ci sei già sopra. La moneta appesa
    // sopra il terreno solido è avvelenata: nessuno ti obbliga a prenderla.
    segment({
      ground: true,
      rows: {
        5: '           YY',
        8: '   T   T   T',
        10: '            E',
        12: ' S G O J  M  G O  J',
      },
    }),

    // 9 — arrivo vero. Davvero. Con due passi da fare bene.
    segment({
      ground: true,
      rows: {
        8: '      Q',
        12: '      !   !  W',
      },
    }),
  ],
});

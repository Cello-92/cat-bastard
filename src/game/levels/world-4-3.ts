import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-3 — "Tutto il resto cade in giù".
 *
 * È il livello che chiarisce l'equivoco: il campo rovescio capovolge **il
 * gatto**, non il mondo. Le stalattiti cadono in giù, i funghi cadono in giù,
 * le zavorre cadono nel verso del campo in cui stanno — che spesso non è il
 * tuo. Chi ha passato 4-2 a camminare sul soffitto arriva qui convinto che
 * qui sopra valgano altre regole, e la prima cosa che gli arriva addosso
 * arriva dall'alto come è sempre arrivata.
 *
 * Le zavorre fanno tutte e due i mestieri per cui esistono. Nei segmenti 2 e 6
 * sono cartelli: appoggiate al soffitto dicono che il campo è vero, rimaste a
 * terra dicono che è spento, e in tutto il mondo non mentono mai. Nei segmenti
 * 4 e 8 sono quello che sembrano — una tonnellata di piombo appoggiata su un
 * mattone che sta per lasciare andare.
 *
 * Il gomitolo è dentro una colonna che sembra spenta. Non è dietro nessuna
 * parete: sta in bella vista, in una colonna che comincia troppo in alto per
 * inciamparci dentro camminando. Bisogna **saltarci dentro**, cioè fidarsi di
 * un campo esattamente identico ai due che in questo livello ti hanno già
 * ammazzato.
 */

const FLOOR = 'o'.repeat(SEGMENT_COLS);
const CEIL = 'o'.repeat(SEGMENT_COLS);
const FULL_FIELD = 'u'.repeat(SEGMENT_COLS);

export const WORLD_4_3 = defineLevel({
  id: 'w4-3',
  name: '4-3',
  title: 'Tutto il resto cade in giù',
  sky: 'spire',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — pianerottolo. Un blocco onesto e uno che non lo è, uno accanto
    // all'altro: il fungo che esce dal secondo cammina sul pavimento, come ha
    // sempre fatto, e sarà l'ultima cosa normale per un po'.
    segment({ rows: { 9: '      Q   B', 12: '   C     C', 13: FLOOR, 14: FLOOR } }),

    // 1 — la prima passerella del livello, e sopra ci piove. I mattoni-trappola
    // stanno nel **pavimento vero**, dodici righe sotto: ci si passa sotto solo
    // quando si ricade, ed è lì che partono. Quassù non succede niente, ed è
    // il punto — questa è ancora la parte facile.
    segment({
      rows: {
        4: CEIL,
        5: 'uuuuuuYuuuuuuuuuuuuu',
        6: FULL_FIELD,
        7: FULL_FIELD,
        8: FULL_FIELD,
        9: FULL_FIELD,
        10: FULL_FIELD,
        11: FULL_FIELD,
        12: FULL_FIELD,
      },
    }),

    // 2 — il primo cartello. Due colonne, e una zavorra appoggiata al soffitto
    // della prima: il piombo sta lassù perché quel campo tira in su. Vale la
    // pena guardarla adesso che non serve, perché fra quattro segmenti servirà.
    segment({
      rows: {
        4: 'oooooooooo',
        5: 'uuuzuuuuuu',
        6: 'uuuuuuuuuu',
        7: 'uuuuuuuuuu',
        8: 'uuuuuuuuuu',
        9: 'uuuuuuuuuu',
        10: 'uuuuuuuuuu',
        11: 'uuuuuuuuuu',
        12: 'uuuuuuuuuu',
        13: '          oooooooooo',
        14: '          oooooooooo',
      },
    }),

    // 3 — checkpoint, e la colonna del gomitolo. Comincia alla riga 9, cioè
    // troppo in alto per finirci dentro camminando: bisogna saltare, e saltare
    // dentro un campo che potrebbe benissimo essere spento. In questo livello
    // due lo sono davvero.
    segment({
      rows: {
        4: '     ooo',
        5: '     u*u',
        6: '     uuu',
        7: '     uuu',
        8: '     uuu',
        9: '     uuu',
        12: '  S           C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 4 — il mattone e il peso. La zavorra è appoggiata sul mattone-trappola,
    // e il mattone si stacca quando ci passi sotto: viene giù una stalattite e
    // viene giù una tonnellata di piombo, insieme, sulla stessa colonna. La
    // seconda si può ancora evitare correndo, perché il piombo parte da fermo.
    segment({
      rows: {
        4: '      z        z',
        5: '      T        T',
        11: '           E',
        12: '   C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 5 — passerella lunga con il ragno, e in mezzo il pavimento vero che
    // ricompare per due colonne. Non serve a niente: è dentro il campo, quindi
    // non ci si appoggia. Serve solo a farti guardare in basso nel momento
    // sbagliato.
    segment({
      rows: {
        4: CEIL,
        5: 'uuuuYuuuuauuuuuuYuuu',
        6: FULL_FIELD,
        7: FULL_FIELD,
        8: FULL_FIELD,
        9: FULL_FIELD,
        10: FULL_FIELD,
        11: FULL_FIELD,
        12: FULL_FIELD,
        13: '        oo',
        14: '        oo',
      },
    }),

    // 6 — adesso il cartello serve. Due colonne identiche sopra due pozze
    // identiche: sotto la prima il piombo è rimasto a terra, sotto la seconda è
    // appeso al soffitto. Quella spenta è larga quattro colonne, cioè si
    // scavalca; quella vera è larga otto, cioè non si scavalca affatto.
    //
    // La zavorra della prima è appoggiata sull'ultima colonna di pavimento
    // della pozza, non a mezz'aria: un peso deve sempre avere qualcosa su cui
    // fermarsi, altrimenti al primo tick esce dal mondo e il cartello che
    // avevi messo lì non c'è più.
    segment({
      rows: {
        4: ' ooooo    oooooooo',
        5: ' nnnnn    uuzuuuuu',
        6: ' nnnnn    uuuuuuuu',
        7: ' nnnnn    uuuuuuuu',
        8: ' nnnnn    uuuuuuuu',
        9: ' nnnnn    uuuuuuuu',
        10: ' nnnnn    uuuuuuuu',
        11: ' nnnnn    uuuuuuuu',
        12: ' nnnnz    uuuuuuuu',
        13: 'o    ooooo        oo',
        14: 'o    ooooo        oo',
      },
    }),

    // 7 — checkpoint, e il vecchio armamentario. La lanterna che non si
    // accende, gli spuntoni che scattano quando ci sei già sopra, la molla che
    // si chiude. Il quarto mondo non ha ancora inventato niente di più cattivo
    // di queste tre cose, e probabilmente non ci riuscirà.
    segment({
      rows: {
        10: '         N',
        12: '  S   m       !   C',
        13: 'ooooooooooooOooooooo',
        14: FLOOR,
      },
    }),

    // 8 — tre mattoni con tre pesi sopra, uno dopo l'altro, e sotto il
    // corridoio che li attraversa tutti. Non c'è niente da capire: c'è da
    // correre, e da ricordarsi che il piombo parte solo quando gli si passa
    // sotto — quindi il ritmo lo decidi tu, se lo decidi in fretta.
    segment({
      rows: {
        4: '   z     z     z',
        5: '   T     T     T',
        12: '        C     C',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 9 — un'ultima colonna, corta, e l'arrivo. La bandiera sbagliata sta
    // sotto quella giusta, che è la disposizione più antipatica possibile.
    segment({
      rows: {
        4: '  ooo',
        5: '  uuu',
        6: '  uuu',
        7: '  uuu',
        8: '  uuu',
        9: '  uuu',
        10: '  uuu',
        11: '  uuu    F    W',
        12: '  uuu    F    W',
        13: 'oo   ooooooooooooooo',
        14: 'oo   ooooooooooooooo',
      },
    }),
  ],
});

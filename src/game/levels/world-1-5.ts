import { defineLevel, segment } from './level';

/**
 * 1-5 — "Il pavimento si è messo a camminare".
 *
 * Il primo livello del secondo giro, e il primo con i nastri. È l'unica cosa
 * nuova che il gioco insegna ancora onestamente: il primo nastro spinge nel
 * verso in cui stai già andando e non c'è niente sotto. Dura venti colonne.
 *
 * Poi la regola si rovescia: un nastro è un pezzo di pavimento che decide al
 * posto tuo. Ti porta al bordo mentre freni, ti riporta indietro mentre corri,
 * e ti tiene sopra la piastra il mezzo secondo che serve agli spuntoni per
 * uscire. I comandi restano precisi come sempre — è il terreno che ha smesso
 * di stare fermo, e questa è una differenza che si sente solo dopo.
 */

export const WORLD_1_5 = defineLevel({
  id: 'w1-5',
  name: '1-5',
  title: 'Il pavimento si è messo a camminare',
  sky: 'dawn',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — il nastro onesto. Va nel verso giusto, non porta da nessuna parte di
    // brutto, e serve solo a far capire cos'è. Non ce ne saranno altri così.
    segment({
      ground: true,
      rows: { 13: '########>>>>>>######' },
    }),

    // 1 — lo stesso nastro, con il vuoto in fondo. Frenare non basta: bisogna
    // aver già smesso di correre venti pixel prima. E dove si atterra c'è il
    // terreno che scatta.
    segment({
      ground: true,
      rows: {
        12: '        O',
        13: '>>>>>>#####    #####',
        14: '###########XXXX#####',
      },
    }),

    // 2 — nastro contrario, in salita, con la pattuglia che arriva dall'altra
    // parte. Il gatto avanza a un terzo della sua velocità: i nemici no.
    segment({
      ground: true,
      rows: {
        12: '       G        J',
        13: '####<<<<<<<<<#######',
      },
    }),

    // 3 — quattro isole sul vuoto. La seconda scorre all'indietro e la quarta
    // in avanti: atterrare non è arrivare, è solo il momento in cui il conto
    // alla rovescia comincia.
    segment({
      rows: {
        4: '            Z',
        11: ' DD   <<<   DD   >>>',
      },
    }),

    // 4 — la lanterna a bordo piattaforma è finta, ed è messa lì perché è dove
    // si guarda arrivando dall'alto. Quella vera è in fondo, dopo il mattone.
    segment({
      ground: true,
      rows: {
        8: '            T',
        12: '  N     AA      S  G',
      },
    }),

    // 5 — il corridoio dell'officina: nastro sotto, lame sopra, due piastre in
    // mezzo. Il salto pieno è vietato dalle lame, quello corto va calcolato con
    // il nastro che aggiunge un metro a ogni stacco.
    segment({
      ground: true,
      rows: {
        9: '     YYY',
        12: '          A   A',
        13: '###>>>>>>>>>>>>>####',
      },
    }),

    // 6 — due molle identiche. La prima è una molla e serve davvero: è l'unico
    // modo di scavalcare la fossa. La seconda è una tagliola col piattello
    // rosso, e sta esattamente dove uno si aspetta la seconda molla.
    segment({
      rows: {
        12: '  M          m',
        13: '####    ####   #####',
        14: '####XXXX####   #####',
      },
    }),

    // 7 — assi marce, una fantasma, e la bestia appesa sopra il punto in cui
    // bisogna per forza fermarsi a prendere la mira.
    segment({
      rows: {
        4: '           Z',
        11: ' DD   DD   LD   >>>',
      },
    }),

    // 8 — corridoio dei sospetti, versione con il pavimento che se ne va: tre
    // colonne di terra finta in mezzo a due piastre, e la moneta di centro
    // avvelenata come sempre.
    segment({
      rows: {
        9: '  C E C',
        12: ' S G  O   J   O   G',
        13: '######VVV###########',
        14: '######   ###########',
      },
    }),

    // 9 — l'arrivo, con la terza molla del livello due passi prima. Non è una
    // molla nemmeno quella.
    segment({
      ground: true,
      rows: {
        8: '      Q',
        12: '     !   m   W',
      },
    }),
  ],
});

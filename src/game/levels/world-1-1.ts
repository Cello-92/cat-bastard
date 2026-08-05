import { defineLevel, segment } from './level';

/**
 * 1-1 — "Sembra un platform normale".
 *
 * Il primo livello ha un compito solo: costruire fiducia e poi smontarla pezzo
 * per pezzo. I primi venti metri sono onesti — è l'unico posto del gioco in cui
 * lo sono — e servono a far credere al giocatore di aver capito che gioco è.
 * Da lì in poi ogni cosa familiare diventa un'arma: il blocco premio, il vuoto,
 * la piattaforma, la moneta, il checkpoint, il pavimento.
 *
 * Regola di costruzione, l'unica: nessun salto richiesto supera le cinque
 * colonne, che è il limite fisico del gatto. Le trappole possono essere
 * invisibili e istantanee, ma il livello deve restare attraversabile da chi lo
 * conosce a memoria. Ed è così che si impara: morendo.
 */
export const WORLD_1_1 = defineLevel({
  id: 'w1-1',
  name: '1-1',
  title: 'Sembra un platform normale',
  sky: 'day',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — respiro. Qui non succede niente, ed è apposta.
    segment({ ground: true }),

    // 1 — tubo, primo blocco premio (bugiardo), primo nemico. E in mezzo alla
    // strada, sul terreno più normale del mondo, i primi spuntoni nascosti:
    // niente feritoia, niente piastra, niente da vedere.
    segment({
      ground: true,
      rows: {
        8: '      B      Q',
        11: '   PP',
        12: '   PP    O      G',
      },
    }),

    // 2 — il buco, con il blocco invisibile sull'apice della traiettoria e
    // gli spuntoni invisibili dove si atterra dopo averlo scampato.
    segment({
      rows: {
        10: '            I',
        12: '                 !',
        13: '##########     #####',
        14: '##########     #####',
      },
    }),

    // 3 — quattro piattaforme sul vuoto. La seconda è mezza fantasma: la metà
    // sinistra sparisce sotto le zampe, la destra regge quel tanto che basta.
    segment({
      rows: {
        4: '        Z',
        11: ' DD    LD    DD   DD',
      },
    }),

    // 4 — il primo checkpoint non è un checkpoint. Quello vero è tredici
    // colonne più avanti, dopo il gemello cattivo e la piastra.
    segment({
      ground: true,
      rows: {
        8: '          T',
        12: ' N   J   AA   S   G',
      },
    }),

    // 5 — monete sopra gli spuntoni, soffitto chiodato che vieta il salto
    // pieno, e la moneta centrale — quella per cui vale la pena rischiare —
    // che uccide.
    segment({
      rows: {
        9: '     Y       YYY',
        11: '   C  E  C',
        13: '#####  #####   #####',
        14: '#####XX#####XXX#####',
      },
    }),

    // 6 — la bandiera. Non è la bandiera. La molla davanti non è un aiuto, e
    // il masso sopra la rincorsa non è parte del soffitto.
    segment({
      ground: true,
      rows: {
        5: '      YY',
        7: '            K',
        8: '          F',
        9: '          F',
        10: '          F',
        12: '      M',
      },
    }),

    // 7 — salto lungo, appoggio centrale marcio, bestia appesa. E sull'ultima
    // piattaforma, quella dove si tira il fiato, altri spuntoni invisibili.
    segment({
      rows: {
        4: '            Z',
        10: '                  !',
        11: '   ###    DDD    ###',
      },
    }),

    // 8 — corridoio dei sospetti: due nemici normali, uno no, due tratti di
    // terreno che scattano, tre metri di pavimento che non esiste e una
    // moneta avvelenata in mezzo a due buone.
    segment({
      rows: {
        9: '  C E C',
        12: ' S G  O J  O  G',
        13: '######VVV###########',
        14: '######   ###########',
      },
    }),

    // 9 — l'arrivo vero, con l'ultimo scherzo due passi prima del traguardo.
    segment({
      ground: true,
      rows: {
        8: '      Q',
        12: '         !  W',
      },
    }),
  ],
});

import { SEGMENT_COLS } from '../config';
import { defineLevel, segment } from './level';

/**
 * 4-2 — "Il soffitto è pavimento".
 *
 * 4-1 chiedeva di attraversare quattro campi. Qui il campo non è più un
 * passaggio: è **il terreno di gioco**. Metà del livello si cammina appesi, e
 * appesi valgono tutte le regole di sempre lette al contrario — le lame del
 * soffitto stanno all'altezza delle zampe, il ragno che cammina sopra la testa
 * adesso cammina sotto i piedi e si può schiacciare, e per scavalcare qualcosa
 * bisogna buttarsi verso il pavimento.
 *
 * Il gomitolo sta sotto una passerella, su una mensola che si vede solo mentre
 * si cade: quando il campo finisce il gatto precipita da otto righe, e in quei
 * pochi tick può ancora decidere da che parte atterrare. È il primo segreto del
 * mondo e chiede la cosa che il mondo insegna — che una caduta è un posto in
 * cui si può ancora scegliere.
 */

const FLOOR = 'o'.repeat(SEGMENT_COLS);
const CEIL = 'o'.repeat(SEGMENT_COLS);
const FULL_FIELD = 'u'.repeat(SEGMENT_COLS);

export const WORLD_4_2 = defineLevel({
  id: 'w4-2',
  name: '4-2',
  title: 'Il soffitto è pavimento',
  sky: 'spire',
  spawn: { c: 2, r: 12 },
  segments: [
    // 0 — venti colonne di niente, e un blocco onesto. Serve a ricordare che
    // esistono anche quelli, perché fra due segmenti non ci si ricorderà più.
    segment({ rows: { 9: '           Q', 12: '       C  C', 13: FLOOR, 14: FLOOR } }),

    // 1 — la prima passerella lunga: si entra da terra, si finisce contro il
    // soffitto e da lì in poi si cammina appesi per venti colonne. Le due lame
    // pendono all'ingiù, cioè all'altezza delle zampe di chi è capovolto: si
    // scavalcano saltando **verso il pavimento**, che è la cosa più contraria
    // all'istinto che questo gioco chieda.
    segment({
      rows: {
        4: CEIL,
        5: 'uuuuuYuuuuuuuYuuuuuu',
        6: FULL_FIELD,
        7: FULL_FIELD,
        8: FULL_FIELD,
        9: FULL_FIELD,
        10: FULL_FIELD,
        11: FULL_FIELD,
        12: FULL_FIELD,
      },
    }),

    // 2 — la passerella continua e sopra ci cammina un ragno. Non sa niente
    // della gravità: sta attaccato con le zampe, e infatti va avanti e indietro
    // sulla stessa lastra da prima che arrivassi tu. Adesso però è il gatto a
    // essere dalla sua parte, quindi per la prima volta si può schiacciare.
    segment({
      rows: {
        4: CEIL,
        5: 'uuuuauuuuuuuuuuYuuuu',
        6: FULL_FIELD,
        7: FULL_FIELD,
        8: FULL_FIELD,
        9: FULL_FIELD,
        10: FULL_FIELD,
        11: FULL_FIELD,
        12: FULL_FIELD,
      },
    }),

    // 3 — il campo finisce a metà segmento e si precipita da otto righe, sul
    // pavimento vero. Lì c'è un basamento di basalto basso e largo: lo si
    // scavalca in un salto e ci si cammina sopra senza pensarci, ed è
    // esattamente per questo che dentro ci sta il gomitolo. La parete di
    // sinistra non è una parete — ma per accorgersene bisogna aver deciso di
    // camminarci *contro* invece che sopra.
    segment({
      rows: {
        4: 'ooooooooo',
        5: 'uuuuuuuuu',
        6: 'uuuuuuuuu',
        7: 'uuuuuuuuu',
        8: 'uuuuuuuuu',
        10: '            bbbbb',
        11: '            b   b',
        12: '  S         _ * b',
        13: FLOOR,
        14: FLOOR,
      },
    }),

    // 4 — respiro a terra, cioè trappole vecchie. L'asse che si sbriciola,
    // il masso che crolla senza dire niente, la moneta che è una moneta e
    // quella che non lo è.
    segment({
      rows: {
        6: '        K',
        9: '     DD',
        11: '            E',
        12: '  C          C',
        13: 'ooooooooooooooooooo',
        14: FLOOR,
      },
    }),

    // 5 — un campo largo dodici colonne, e in fondo due colonne di pavimento
    // su cui **non** si può stare: sono dentro il campo, e dentro un campo il
    // pavimento non regge nessuno. Ci si accorge di essere arrivati solo
    // quando si esce, e si esce cadendo.
    segment({
      rows: {
        4: '  oooooooooooooo',
        5: '  uuuuuuuuuuuuuu',
        6: '  uuuuuuuuuuuuuu',
        7: '  uuuuuuuuuuuuuu',
        8: '  uuuuuuuuuuuuuu',
        9: '  uuuuuuuuuuuuuu',
        10: '  uuuuuuuuuuuuuu',
        11: '  uuuuuuuuuuuuuu',
        12: '  uuuuuuuuuuuuuu',
        13: 'oo            oooooo',
        14: 'oo            oooooo',
      },
    }),

    // 6 — il campo spento, e questa volta senza moneta e senza inviti: solo una
    // colonna identica alle sei di prima, in mezzo a un livello in cui finora
    // erano tutte vere. La zavorra a terra dentro la colonna lo dice, e lo dice
    // da lontano. Il buco è largo cinque: si scavalca, se si è guardato.
    segment({
      rows: {
        4: '   oooooo',
        5: '   nnnnnn',
        6: '   nnnnnn',
        7: '   nnnnnn',
        8: '   nnnnnn',
        9: '   nnnnnn',
        10: '   nnnnnn',
        11: '   nnnnnn',
        12: '   nnnnnz',
        13: 'ooo     oooooooooooo',
        14: 'ooo     oooooooooooo',
      },
    }),

    // 7 — checkpoint, e il pavimento con i denti: la feritoia che si vede e
    // quella che non c'è. Sono le due trappole più vecchie del gioco e qui
    // stanno una accanto all'altra, perché a questo punto si guarda solo in
    // alto e nessuno guarda più dove mette le zampe.
    segment({
      rows: {
        11: '            N',
        12: '  S       !',
        13: 'oooooAoooooooOooooo',
        14: FLOOR,
      },
    }),

    // 8 — l'ultima passerella, con la zavorra appoggiata al soffitto proprio
    // dove si entra: è vera, e si vede che è vera. Poi due lame, e il ragno che
    // arriva dalla parte opposta mentre le stai scavalcando.
    segment({
      rows: {
        4: '  oooooooooooooooo',
        5: '  uuzuuYuuuuuYuuau',
        6: '  uuuuuuuuuuuuuuuu',
        7: '  uuuuuuuuuuuuuuuu',
        8: '  uuuuuuuuuuuuuuuu',
        9: '  uuuuuuuuuuuuuuuu',
        10: '  uuuuuuuuuuuuuuuu',
        11: '  uuuuuuuuuuuuuuuu',
        12: '  uuuuuuuuuuuuuuuu',
        13: 'oo                oo',
        14: 'oo                oo',
      },
    }),

    // 9 — si ricade a terra e c'è l'arrivo, con la solita bandiera sbagliata.
    // Dopo quaranta colonne appesi, la cosa più difficile è ricordarsi che
    // adesso si salta di nuovo verso l'alto.
    segment({
      rows: {
        11: '     F        W',
        12: '     F   !    W',
        13: FLOOR,
        14: FLOOR,
      },
    }),
  ],
});

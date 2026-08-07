/**
 * Le battute dopo la morte.
 *
 * Regola (CLAUDE.md): ogni trappola ha il SUO taunt, specifico. I generici
 * qui sotto sono solo il fallback quando muori in modi banali, e sono in
 * ordine: si fanno più cattivi mano a mano che insisti.
 */

import { pick } from '@core/math';

export const DEATH_CAUSE = {
  pit: 'pit',
  spikes: 'spikes',
  fakeFlag: 'fakeFlag',
  shroom: 'shroom',
  evilWalker: 'evilWalker',
  fallingSpike: 'fallingSpike',
  walker: 'walker',
  fakeGround: 'fakeGround',
  popSpikes: 'popSpikes',
  ceilingSpikes: 'ceilingSpikes',
  spring: 'spring',
  diver: 'diver',
  lureCoin: 'lureCoin',
  fakeCheckpoint: 'fakeCheckpoint',
  collapse: 'collapse',
  ghost: 'ghost',
  snapSpikes: 'snapSpikes',
  hiddenSpikes: 'hiddenSpikes',
  trapSpring: 'trapSpring',
  // --- il Padrone (1-11)
  boss: 'boss',
  bossCharge: 'bossCharge',
  bossStomp: 'bossStomp',
  bossRubble: 'bossRubble',
  // --- Gothic Lucio (2-11)
  lucio: 'lucio',
  lucioDive: 'lucioDive',
  lucioWave: 'lucioWave',
  lucioStomp: 'lucioStomp',
  // --- mondo 2
  ice: 'ice',
  brittleIce: 'brittleIce',
  belt: 'belt',
  deadVent: 'deadVent',
  sentry: 'sentry',
  drone: 'drone',
  snowball: 'snowball',
  // --- la Sfinge (3-11)
  sphinx: 'sphinx',
  sphinxErupt: 'sphinxErupt',
  sphinxStomp: 'sphinxStomp',
  // --- mondo 3
  deadWind: 'deadWind',
  quicksand: 'quicksand',
  scarab: 'scarab',
  plate: 'plate',
  // --- il Rovescio (4-11)
  rovescio: 'rovescio',
  rovescioCrush: 'rovescioCrush',
  rovescioStomp: 'rovescioStomp',
  // --- mondo 4
  /** Caduti **in su**: sopra il bordo del mondo non c'è soffitto. */
  sky: 'sky',
  /** Il campo che doveva capovolgerti e non ha capovolto niente. */
  deadField: 'deadField',
  spider: 'spider',
  ballast: 'ballast',
  pendulum: 'pendulum',
  generic: 'generic',
} as const;

export type DeathCause = (typeof DEATH_CAUSE)[keyof typeof DEATH_CAUSE];

const BY_CAUSE: Record<Exclude<DeathCause, 'generic'>, readonly string[]> = {
  pit: ['il vuoto era vuoto', 'giù è la direzione sbagliata', 'hai trovato il fondo'],
  spikes: ['spuntoni. chi poteva immaginarlo', 'erano appuntiti, sì'],
  fakeFlag: ['la bandiera era finta, ovviamente', 'non era quella l\'uscita'],
  shroom: ['il fungo non era un potenziamento', 'nessun fungo ti vuole bene qui'],
  evilWalker: ['quello aveva le punte sotto la pelliccia', 'sembravano identici, vero?'],
  fallingSpike: ['il soffitto ti voleva male', 'dovevi guardare in alto'],
  walker: ['toccato', 'ti ha toccato lui per primo'],
  fakeGround: [
    'il pavimento non era d\'accordo',
    'anche il terreno mente, qui',
    'era terra finta. come tutto il resto',
  ],
  popSpikes: [
    'erano sotto da sempre, aspettavano te',
    'il pavimento aveva i denti',
    'quel buchino nel metallo, l\'hai visto?',
  ],
  ceilingSpikes: [
    'saltare non è sempre la risposta',
    'il soffitto era più vicino di quanto pensassi',
    'complimenti per l\'altezza',
  ],
  spring: [
    'la molla ti ha lanciato esattamente dove voleva',
    'saltavi troppo poco, ti ho aiutato io',
    'era una molla, non un ascensore',
  ],
  diver: [
    'stava lì appeso da prima che nascessi',
    'guardare in alto ogni tanto aiuta',
    'ti aspettava. da un pezzo',
  ],
  lureCoin: [
    'era una moneta. non era una moneta',
    'ti sei fidato di una moneta gialla',
    'costava più di quanto valeva',
  ],
  fakeCheckpoint: [
    'quella lanterna non si è mai accesa, sai',
    'checkpoint finto. dovevi guardarla meglio',
    'hai corso verso il punto di salvataggio. tenero',
  ],
  collapse: [
    'il soffitto ha ceduto. proprio lì. proprio adesso',
    'non c\'era nessun preavviso, no',
    'stava aspettando che passassi tu',
  ],
  ghost: [
    'la piattaforma c\'era. poi non c\'era più',
    'non tutte le piattaforme reggono. quella no',
    'un attimo prima era solida. giuro',
  ],
  snapSpikes: [
    'sbucati dal niente, esatto',
    'non c\'era nessuna feritoia da vedere. apposta',
    'il terreno era normale fino a un decimo di secondo fa',
  ],
  hiddenSpikes: [
    'lì non c\'era niente. adesso lo vedi, però',
    'ora sono visibili. non ti servirà a molto, ma sono visibili',
    'invisibili. la seconda volta no',
  ],
  ice: [
    'sul ghiaccio si frena prima. molto prima',
    'quattro zampe e zero aderenza',
    'volevi fermarti lì? il ghiaccio dice di no',
  ],
  brittleIce: [
    'era sottile. si sentiva anche, scricchiolava',
    'il ghiaccio si è crepato, poi ha smesso di esistere',
    'un attimo in più fermo lì ed era sicuro. no, aspetta: il contrario',
  ],
  trapSpring: [
    'era una molla. aveva la piastra, il piattello, tutto',
    'quella non lanciava. quella si chiudeva',
    'una tagliola vestita da aiuto. il tuo genere preferito',
  ],
  boss: [
    'gli sei andato addosso. lui era lì da prima',
    'toccarlo non era il piano, vero?',
    'il Padrone non si tocca. il Padrone tocca',
  ],
  bossCharge: [
    'te l\'ha annunciato. ha ruggito e tutto',
    'correva dritto. tu pure',
    'i mensoloni servivano a quello, sai',
  ],
  bossStomp: [
    'saltargli in testa. certo. come no',
    'ha una corona. le corone pungono',
    'ha funzionato con i funghi, doveva funzionare anche qui',
  ],
  bossRubble: [
    'quello era il TUO mattone',
    'l\'hai staccato tu. è caduto dove eri tu',
    'il soffitto non distingue chi lo ha fatto cadere',
  ],
  lucio: [
    'gli sei passato accanto. lui non si sposta per nessuno',
    'era appeso lì da prima che tu nascessi',
    'il velluto è morbido. il resto no',
  ],
  lucioDive: [
    'ha guardato dove eri e si è staccato. tu eri ancora lì',
    'si tuffa dove ERI. il problema è che non ti sei mosso',
    'mezzo secondo di preavviso. te l\'ha dato tutto',
  ],
  lucioWave: [
    'schivato per un pelo, e il pelo non bastava più',
    'in seconda fase l\'atterraggio fa male anche a distanza',
    'stavi accanto al cero. bravo. troppo accanto',
  ],
  lucioStomp: [
    'saltare in testa a un gatto appeso a testa in giù. rifletti',
    'ha le borchie sul collare. tutte in su',
    'non era la testa. era il collare',
  ],
  belt: [
    'il nastro ti ha accompagnato. gentile',
    'stavi fermo, ma il pavimento no',
    'andava dall\'altra parte. sempre andato dall\'altra parte',
  ],
  deadVent: [
    'quel getto era spento. lo era anche prima',
    'vapore freddo: fa scena, non spinge',
    'ti sei fidato di una nuvoletta',
  ],
  sentry: [
    'ti ha visto, si è girata, ti è venuta addosso',
    'l\'elmo ce l\'aveva in testa da sempre. si vedeva',
    'quella non si schiaccia. mai potuta schiacciare',
  ],
  drone: [
    'il drone passava di lì ogni tot. tu sei passato al tot sbagliato',
    'andava avanti e indietro. sempre uguale. sempre',
    'dovevi salirci sopra, non entrarci dentro',
  ],
  snowball: [
    'rotolava verso di te da tre secondi',
    'una palla di ghiaccio. correva più di te',
    'era in salita per lei e in discesa per te, eppure',
  ],
  sphinx: [
    'le sei andato addosso. è di pietra, e la pietra non si sposta',
    'era lì fuori da mezzo secondo e tu ci sei arrivato dentro',
    'toccarla non era previsto da nessuna parte',
  ],
  sphinxErupt: [
    'il pavimento rimbombava. rimbombava per te',
    'ti è uscita da sotto. era sotto da sempre',
    'quel rumore voleva dire "spostati", non "guarda"',
  ],
  sphinxStomp: [
    'saltare in testa a una statua. rifletti su cosa hai appena fatto',
    'è arenaria. tutta arenaria',
    'il copricapo è d\'oro massiccio, e tu ci sei atterrato sopra',
  ],
  deadWind: [
    'quella corrente non spingeva. hai saltato per due',
    'stessa sabbia, stesso fischio, zero vento',
    'contavi su una mano che non c\'era',
  ],
  quicksand: [
    'la sabbia non ti ha ucciso. ti ha solo tenuto fermo abbastanza',
    'si nuota, sai. bastava insistere col tasto',
    'sei affondato con molta dignità',
  ],
  scarab: [
    'lo scarabeo non ti stava nemmeno cercando. andava dove andava il vento',
    'guarda dove vanno loro, e saprai dove finirai tu',
    'si schiacciava, sai. era l\'unica cosa qui che si schiacciava',
  ],
  plate: [
    'hai pestato una lastra e il soffitto se l\'è ricordato',
    'quella piastra non faceva niente lì. faceva tutto più avanti',
    'clack. e trenta metri dopo, tutto il resto',
  ],
  sky: [
    'sei caduto in su. non è un modo di dire',
    'il cielo non ha fondo, e nemmeno un soffitto',
    'giù era di là. adesso lo sai',
  ],
  deadField: [
    'quel campo era spento. luccicava, ma era spento',
    'aspettavi di atterrare sul soffitto. il soffitto non ti aspettava',
    'ti sei fidato di un ronzio',
  ],
  spider: [
    'camminava sul soffitto da prima che tu guardassi in alto',
    'per schiacciare un ragno bisogna arrivarci dalla sua parte',
    'sei zampe attaccate al vetro. tu ne hai quattro e nessuna colla',
  ],
  ballast: [
    'una tonnellata di ferro non si schiaccia. si evita',
    'la zavorra era appoggiata lì perché il campo la teneva lì',
    'guarda dove si appoggiano loro e saprai da che parte cadi tu',
  ],
  pendulum: [
    'oscillava sempre uguale. sempre. proprio sempre',
    'era un pendolo: non ti stava cercando, passava di lì',
    'mezzo secondo prima o mezzo secondo dopo, e niente'
  ],
  rovescio: [
    'gli sei andato addosso. pesa quanto la stanza',
    'toccarlo non era previsto in nessuna delle due direzioni',
    'è di ferro. tutto di ferro',
  ],
  rovescioCrush: [
    'quella zavorra è caduta perché ha ribaltato lui. su di te',
    'stavi sotto un peso. poi sotto è diventato sopra',
    'la sua arma funziona in tutte e due le direzioni, sì',
  ],
  rovescioStomp: [
    'saltargli in testa. il quarto boss di fila. rifletti',
    'ha una piastra d\'acciaio sulla schiena, e la schiena era in alto',
    'a testa in giù la sua testa è sotto. quella però era ancora la schiena',
  ],
};

/** Fallback in escalation: indicizzato sul numero di morti. */
const GENERIC = [
  'ma dai.',
  'era ovvio, dai.',
  'ci sei cascato di nuovo',
  'il blocco era lì apposta',
  'nessuno ti obbligava a saltare',
  'prova a non farlo',
  'interessante scelta',
  'la fisica funziona benissimo',
  'quello sembrava sicuro, vero?',
  'ci stai prendendo la mano (no)',
] as const;

export function tauntFor(cause: DeathCause, deaths: number): string {
  if (cause === DEATH_CAUSE.generic) {
    return GENERIC[Math.min(deaths - 1, GENERIC.length - 1)] ?? GENERIC[0];
  }
  return pick(BY_CAUSE[cause]);
}

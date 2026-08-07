import type { Renderer } from '@engine/render/renderer';
import { SKIES, alpha, glare, mix, type SkyName, type SkyTheme } from '../theme';

/**
 * Cielo e paesaggio, su sette piani di profondità.
 *
 * Quello che rende leggibile la distanza non è la parallasse — è la
 * **prospettiva aerea**: più una cosa è lontana, più l'aria che c'è in mezzo
 * la sbiadisce verso il colore della foschia, ne abbassa il contrasto e ne
 * mangia i dettagli. Ogni piano qui sotto dichiara la sua distanza una volta
 * sola (`depth`) e da quella discendono velocità, colore e nitidezza.
 *
 * I profili delle montagne non sono forme ripetute con un modulo: sono una
 * funzione continua e deterministica della posizione nel mondo, quindi il
 * paesaggio non si ripete mai e resta comunque identico a ogni tentativo.
 */

interface Layer {
  /** 0 = fermo all'infinito, 1 = si muove col terreno. */
  speed: number;
  /** 0 = a portata di mano, 1 = perso nella foschia. */
  depth: number;
  /** Altezza massima del profilo, in pixel. */
  height: number;
  /** Quota della base rispetto all'orizzonte. */
  base: number;
  /** Frequenza fondamentale del profilo: più bassa, più le creste sono larghe. */
  frequency: number;
  /** Seme: due piani con lo stesso seme avrebbero la stessa forma. */
  seed: number;
}

/** Dove finisce il paesaggio e comincia il mondo giocabile. */
const HORIZON = 0.87;

const FAR_RANGE: Layer = { speed: 0.05, depth: 0.86, height: 168, base: -6, frequency: 0.0016, seed: 1.7 };
const MID_RANGE: Layer = { speed: 0.11, depth: 0.66, height: 122, base: 4, frequency: 0.0031, seed: 5.2 };
const NEAR_RANGE: Layer = { speed: 0.2, depth: 0.44, height: 78, base: 12, frequency: 0.0062, seed: 9.4 };
const FOREST: Layer = { speed: 0.34, depth: 0.24, height: 46, base: 22, frequency: 0.012, seed: 3.1 };

const CLOUD_SPEED = 0.16;
const CLOUD_SPACING = 300;
const TREE_SPEED = 0.55;
const TREE_SPACING = 132;

/** Rumore deterministico: lo stesso seme dà sempre lo stesso paesaggio. */
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Profilo di cresta: quattro ottave di rumore "ridged".
 * `1 - |sin|` produce picchi aguzzi e valli morbide, cioè la firma di una
 * catena montuosa; sommare ottave sempre più fitte aggiunge i dettagli.
 */
const ridgeAt = (x: number, layer: Layer): number => {
  const { frequency: f, seed: s } = layer;
  const o1 = 1 - Math.abs(Math.sin(x * f + s));
  const o2 = 1 - Math.abs(Math.sin(x * f * 2.13 + s * 2.7));
  const o3 = 1 - Math.abs(Math.sin(x * f * 4.37 + s * 4.1));
  const o4 = 1 - Math.abs(Math.sin(x * f * 8.91 + s * 6.3));
  return (o1 * 0.52 + o2 * 0.26 + o3 * 0.15 + o4 * 0.07) ** 1.35;
};

export function drawBackground(r: Renderer, camX: number, sky: SkyName, tick: number): void {
  // Il tipo esplicito serve: `SKIES` è dichiarato `as const`, quindi senza
  // annotazione ogni cielo avrebbe il *suo* tipo letterale e i campi opzionali
  // (neve, aurora, interno) non esisterebbero su quelli che non li usano.
  const theme: SkyTheme = SKIES[sky];
  const { width: W, height: H } = r;
  const horizon = H * HORIZON;

  drawSky(r, theme, W, H, horizon);

  if (!theme.landscape) {
    // Nel vuoto le stelle stanno **dietro** al fondale e non sopra: sono la
    // cosa più lontana che ci sia, e la torre capovolta deve poterle coprire.
    if (theme.stars) drawStars(r, theme, camX, tick, W, H);
    if (theme.interior === 'factory') drawFactoryDepth(r, theme, camX, tick, W, H);
    else if (theme.interior === 'temple') drawTempleDepth(r, theme, camX, tick, W, H);
    else if (theme.interior === 'void') drawVoidDepth(r, theme, camX, tick, W, H);
    else drawCaveDepth(r, theme, camX, tick, W, H);
    drawGroundHaze(r, theme, horizon, W, H);
    // Anche al chiuso il vento c'è: entra dai lucernari e porta dentro la
    // stessa sabbia di fuori. È l'unica cosa che lega il tempio al deserto.
    if (theme.sand) drawSandDrift(r, theme, camX, tick, W, H);
    return;
  }

  if (theme.stars) drawStars(r, theme, camX, tick, W, H);
  if (theme.aurora) drawAurora(r, theme, camX, tick, W, H);
  drawCelestialBody(r, theme, tick, W, H);
  drawRange(r, theme, camX, FAR_RANGE, horizon, W);
  drawRange(r, theme, camX, MID_RANGE, horizon, W);
  drawClouds(r, theme, camX, tick, W, H);
  drawRange(r, theme, camX, NEAR_RANGE, horizon, W);
  // Nel deserto i due piani vicini sono dune, non alberi: un filare di pioppi
  // sopra il mondo 3 sarebbe la cosa più fuori posto di tutto il gioco.
  if (theme.sand) {
    drawDunes(r, theme, camX, tick, horizon, W);
  } else {
    drawForest(r, theme, camX, horizon, W);
    drawTreeLine(r, theme, camX, tick, horizon, W);
  }
  drawGroundHaze(r, theme, horizon, W, H);
  // La neve sta davanti a tutto, compreso il filare in primo piano: è l'aria
  // tra il giocatore e il mondo, non un altro piano del paesaggio. La sabbia
  // sospesa sta lì per la stessa ragione, e per una in più: dice da che parte
  // tira il vento, che qui è una regola di gioco.
  if (theme.snow) drawSnowfall(r, theme, camX, tick, W, H);
  if (theme.sand) drawSandDrift(r, theme, camX, tick, W, H);
}

// ---------------------------------------------------------------- grotta
/**
 * Il fondo di una grotta: nessun orizzonte, solo altra roccia più indietro.
 *
 * La profondità qui non la dà la foschia ma il buio — ogni parete più lontana
 * è più scura, non più chiara. Due quinte di roccia con le stalattiti appese
 * scorrono a velocità diverse, e qualche pozza di luce lascia intuire che da
 * qualche parte, sopra, c'è un'uscita.
 */
function drawCaveDepth(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  W: number,
  H: number,
): void {
  const walls = [
    { speed: 0.08, depth: 0.75, teeth: 46, spacing: 74, seed: 2.4 },
    { speed: 0.2, depth: 0.45, teeth: 68, spacing: 108, seed: 6.1 },
  ];

  for (const wall of walls) {
    const color = mix(theme.ridge, '#000000', wall.depth * 0.75);
    const offset = camX * wall.speed;

    // Volta: una fila di denti di roccia che scende dal soffitto.
    const top: number[] = [-40, -10];
    for (let x = -40; x <= W + 40; x += wall.spacing / 2) {
      const n = hash(Math.floor((x + offset) / (wall.spacing / 2)) * 1.7 + wall.seed);
      top.push(x, 10 + n * wall.teeth);
    }
    top.push(W + 40, -10);
    r.polygon(top, color);

    // Fondo: massi accumulati, più bassi e più radi.
    const bottom: number[] = [-40, H + 10];
    for (let x = -40; x <= W + 40; x += wall.spacing) {
      const n = hash(Math.floor((x + offset) / wall.spacing) * 3.1 + wall.seed);
      bottom.push(x, H - 30 - n * wall.teeth * 0.7);
    }
    bottom.push(W + 40, H + 10);
    r.blob(bottom, color);
  }

  // Pozze di luce che filtrano da sopra: si muovono col mondo, molto lente.
  r.push();
  r.setBlend('add');
  for (let i = 0; i < 3; i++) {
    const x = ((i * 320 - camX * 0.28) % (W + 400)) + (W + 400);
    const px = (x % (W + 400)) - 200;
    r.setAlpha(0.07 + Math.abs(Math.sin(tick / 240 + i)) * 0.03);
    r.radial(px, H * 0.22, 90, H * 0.5, [
      { at: 0, color: alpha(theme.sunGlow, 0.55) },
      { at: 1, color: alpha(theme.sunGlow, 0) },
    ]);
  }
  r.pop();
}

// ---------------------------------------------------------------- fabbrica
/**
 * Il fondo della fabbrica: nessun cielo, nessuna roccia. Macchine.
 *
 * La profondità qui non la dà né la foschia né il buio ma la **scala**: i
 * blocchi lontani sono grandi, scuri e lenti, quelli vicini più piccoli, più
 * definiti e più veloci. In mezzo, le uniche cose accese di tutto il livello —
 * le bocche dei forni, che pulsano piano e proiettano un po' del loro arancione
 * sui tubi davanti.
 */
function drawFactoryDepth(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  W: number,
  H: number,
): void {
  const floors = [
    { speed: 0.07, depth: 0.72, spacing: 190, height: 210, seed: 3.7 },
    { speed: 0.19, depth: 0.42, spacing: 128, height: 150, seed: 8.3 },
  ];

  for (const floor of floors) {
    const color = mix(theme.ridge, '#000000', floor.depth * 0.8);
    const offset = camX * floor.speed;
    const first = Math.floor(offset / floor.spacing) - 1;

    for (let i = first; i < first + Math.ceil(W / floor.spacing) + 3; i++) {
      const n = hash(i * 1.9 + floor.seed);
      const x = i * floor.spacing - offset;
      if (x < -floor.spacing || x > W + floor.spacing) continue;

      const w = floor.spacing * (0.5 + n * 0.4);
      const h = floor.height * (0.55 + hash(i * 3.3 + floor.seed) * 0.6);
      const top = H - h;

      // Corpo della macchina: un parallelepipedo con la sommità a gradoni.
      r.rect(x, top, w, h, color);
      r.rect(x + w * 0.15, top - 14 * (1 - floor.depth), w * 0.45, 14 * (1 - floor.depth), color);
      // Camino o colonna di sfiato.
      const stackX = x + w * (0.6 + n * 0.25);
      r.rect(stackX, top - 46 * (1 - floor.depth), 9 * (1 - floor.depth) + 3, 46 * (1 - floor.depth), color);

      // Bocca del forno: l'unica luce.
      if (hash(i * 5.1 + floor.seed) > 0.45) {
        const fx = x + w * 0.3;
        const fy = top + h * 0.42;
        r.push();
        r.setBlend('add');
        r.setAlpha((0.16 + Math.abs(Math.sin(tick / 90 + i)) * 0.12) * (1 - floor.depth * 0.6));
        r.radial(fx, fy, 46, 34, [
          { at: 0, color: alpha(theme.sunGlow, 0.8) },
          { at: 1, color: alpha(theme.sunGlow, 0) },
        ]);
        r.pop();
        r.rect(fx - 7, fy - 5, 14, 10, mix(theme.sunGlow, '#000000', 0.35 + floor.depth * 0.3));
      }
    }
  }

  // Tubazioni appese alla volta: corrono in orizzontale, con le staffe.
  const pipeOffset = camX * 0.3;
  for (let lane = 0; lane < 2; lane++) {
    const y = 16 + lane * 26;
    const color = mix(theme.ridge, '#000000', 0.5 - lane * 0.12);
    r.rect(0, y, W, 9 - lane * 2, color);
    r.rect(0, y, W, 1.5, alpha(mix(color, theme.sunTint, 0.4), 0.5));
    for (let i = -1; i < W / 90 + 2; i++) {
      const bx = i * 90 - (pipeOffset % 90) + lane * 30;
      r.rect(bx, y - 4, 5, 13 - lane * 2, mix(color, '#000000', 0.3));
    }
  }
}

// ---------------------------------------------------------------- tempio
/**
 * Il fondo del tempio: colonne, e niente altro.
 *
 * La grotta usava il buio per dare profondità e la fabbrica usava la scala;
 * qui la dà la **ripetizione**. Due colonnati identici che scorrono a velocità
 * diverse producono un battimento che l'occhio legge come volume, ed è lo
 * stesso trucco di qualunque corridoio infinito: le cose fatte dall'uomo sono
 * tutte uguali, e questo si vede solo quando ce ne sono tante.
 */
function drawTempleDepth(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  W: number,
  H: number,
): void {
  const naves = [
    { speed: 0.07, depth: 0.72, spacing: 120, width: 34, seed: 4.3 },
    { speed: 0.19, depth: 0.4, spacing: 168, width: 52, seed: 9.1 },
  ];

  for (const nave of naves) {
    const stone = mix(theme.ridge, '#000000', nave.depth * 0.72);
    const lit = mix(stone, theme.sunGlow, 0.14 * (1 - nave.depth));
    const offset = camX * nave.speed;
    const top = H * (0.06 + nave.depth * 0.1);
    const floor = H * (0.94 - nave.depth * 0.08);

    // Architrave continuo: è quello che dice "stanza" invece di "pali".
    r.rect(0, top, W, 12 - nave.depth * 5, stone);
    r.rect(0, top, W, 1.5, alpha(lit, 0.6));

    const first = Math.floor(offset / nave.spacing) - 1;
    for (let i = first; i < first + Math.ceil(W / nave.spacing) + 3; i++) {
      const x = i * nave.spacing - offset;
      if (x < -nave.width || x > W + nave.width) continue;

      const w = nave.width;
      // Il fusto si rastrema verso l'alto, come qualunque colonna vera.
      r.polygon(
        [x - w * 0.36, top + 10, x + w * 0.36, top + 10, x + w * 0.44, floor, x - w * 0.44, floor],
        stone,
      );
      // Capitello e base: due dadi appena più larghi del fusto.
      r.rect(x - w * 0.5, top + 6, w, 9 - nave.depth * 4, mix(stone, lit, 0.35));
      r.rect(x - w * 0.5, floor - 8, w, 8, mix(stone, '#000000', 0.25));
      // Scanalature: solo sul lato illuminato, che è sempre quello a sinistra.
      r.push();
      r.setAlpha(0.35 * (1 - nave.depth));
      r.line([x - w * 0.24, top + 14, x - w * 0.3, floor - 8], 1.6, lit);
      r.pop();
      // Fascia incisa a metà fusto: la sola cosa che distingue una colonna
      // dall'altra, e viene dal seme, quindi non cambia mai.
      if (hash(i * 2.9 + nave.seed) > 0.55) {
        r.rect(x - w * 0.4, (top + floor) / 2, w * 0.8, 5 - nave.depth * 2, alpha(theme.sunTint, 0.22));
      }
    }
  }

  // Lucernari insabbiati: coni di luce polverosa che scendono dalla volta.
  // Sono l'unica sorgente del tempio e si muovono col mondo, molto lenti.
  r.push();
  r.setBlend('add');
  for (let i = 0; i < 3; i++) {
    const span = W + 520;
    let x = (i * 280 - camX * 0.24) % span;
    if (x < 0) x += span;
    const px = x - 260;
    r.setAlpha(0.09 + Math.abs(Math.sin(tick / 300 + i * 1.7)) * 0.04);
    r.polygon(
      [px - 14, 0, px + 14, 0, px + 64, H * 0.82, px - 64, H * 0.82],
      alpha(theme.sunGlow, 0.5),
    );
    r.radial(px, H * 0.78, 70, 26, [
      { at: 0, color: alpha(theme.sunGlow, 0.5) },
      { at: 1, color: alpha(theme.sunGlow, 0) },
    ]);
  }
  r.pop();
}

// ---------------------------------------------------------------- il vuoto
/**
 * Il Rovescio: quello che si vede sotto la torre, e che è ancora torre.
 *
 * Non è una grotta e non è una stanza: è un vuoto in cui galleggiano altri
 * pezzi di torre, **appesi al contrario**. La profondità qui non la danno né
 * la foschia né il buio ma una cosa sola — ogni quinta pende dalla parte
 * sbagliata, e più è lontana più pende piano. È l'unico fondale del gioco che
 * serve a dire una regola invece che a raccontare un posto: chi lo guarda
 * capisce cosa sta per succedere al suo peso prima ancora di entrare in un
 * campo.
 */
function drawVoidDepth(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  W: number,
  H: number,
): void {
  const tiers = [
    { speed: 0.06, depth: 0.74, spacing: 210, width: 62, seed: 3.7 },
    { speed: 0.17, depth: 0.42, spacing: 156, width: 44, seed: 8.3 },
  ];

  for (const tier of tiers) {
    const stone = mix(theme.ridge, '#000000', tier.depth * 0.68);
    const lit = mix(stone, theme.sunGlow, 0.18 * (1 - tier.depth));
    const offset = camX * tier.speed;
    // La quota da cui pendono: più lontano, più in alto e più corto.
    const hang = H * (0.02 + tier.depth * 0.06);

    const first = Math.floor(offset / tier.spacing) - 1;
    for (let i = first; i < first + Math.ceil(W / tier.spacing) + 3; i++) {
      const x = i * tier.spacing - offset;
      if (x < -tier.width * 2 || x > W + tier.width * 2) continue;

      // Ogni torre ha la sua altezza, dal seme: non cambia mai, come tutto.
      const len = H * (0.3 + hash(i * 1.9 + tier.seed) * 0.42) * (1 - tier.depth * 0.3);
      const w = tier.width * (0.7 + hash(i * 4.1 + tier.seed) * 0.6);
      const tip = hang + len;

      // Il fusto si rastrema verso la **punta**, che qui sta in basso: è
      // esattamente una torre normale, girata.
      r.polygon([x - w * 0.5, hang, x + w * 0.5, hang, x + w * 0.16, tip, x - w * 0.16, tip], stone);
      // Cornicione alla base (in alto) e lanterna in punta (in basso).
      r.rect(x - w * 0.62, hang, w * 1.24, 7 - tier.depth * 3, mix(stone, lit, 0.3));
      r.ellipse(x, tip, w * 0.2, w * 0.16, mix(stone, lit, 0.5));
      // Lato in luce: la luce viene sempre da sinistra, anche qui sotto.
      r.push();
      r.setAlpha(0.32 * (1 - tier.depth));
      r.line([x - w * 0.4, hang + 8, x - w * 0.14, tip - 4], 1.8, lit);
      r.pop();

      // Qualche finestra accesa, sempre le stesse: è l'unica cosa viva.
      if (hash(i * 6.7 + tier.seed) > 0.42) {
        r.push();
        r.setBlend('add');
        r.setAlpha(0.22 + Math.abs(Math.sin(tick / 140 + i)) * 0.1);
        for (let k = 1; k <= 3; k++) {
          const wy = hang + (len * k) / 4;
          r.ellipse(x, wy, w * 0.09, 2.2, alpha(theme.sunGlow, 0.75));
        }
        r.pop();
      }
    }
  }

  // Il fondo del vuoto: non c'è. Una velatura viola che si schiarisce verso il
  // basso e basta, così l'occhio non trova mai un pavimento su cui riposare.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.1);
  r.gradientRect(0, H * 0.5, W, H * 0.5, [
    { at: 0, color: alpha(theme.sunGlow, 0) },
    { at: 1, color: alpha(theme.sunGlow, 0.5) },
  ]);
  r.pop();
}

// ---------------------------------------------------------------- deserto
/**
 * Dune.
 *
 * Una duna non ha creste aguzze: ha una schiena lunghissima sopravvento e un
 * taglio netto sottovento, e la cosa che la rende riconoscibile è proprio
 * l'asimmetria. Quindi non si riusa `ridgeAt` (che fa montagne) ma una somma
 * di seni con la fase spostata, e la linea di cresta si disegna a parte: nel
 * deserto quella riga di luce è l'unica cosa che dice dove finisce una duna e
 * comincia il cielo.
 */
function drawDunes(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  horizon: number,
  W: number,
): void {
  const layers = [
    { speed: 0.3, depth: 0.3, height: 54, base: 16, frequency: 0.0042, seed: 2.2 },
    { speed: 0.52, depth: 0.1, height: 76, base: 30, frequency: 0.0027, seed: 7.6 },
  ];

  for (const layer of layers) {
    const worldX = camX * layer.speed;
    const baseY = horizon + layer.base;
    const body = mix(theme.canopy, theme.fog, layer.depth);
    const lit = mix(body, theme.sunCore, 0.3 - layer.depth * 0.15);
    const shade = mix(body, '#000000', 0.22 + layer.depth * 0.1);

    const step = 8;
    const crest: number[] = [];
    for (let x = -step; x <= W + step; x += step) {
      const t = (worldX + x) * layer.frequency + layer.seed;
      // La schiena sale piano (seno lento) e il taglio scende di colpo (il
      // termine al cubo): è la forma di una duna vista di profilo.
      const back = Math.sin(t) * 0.5 + 0.5;
      const slip = Math.sin(t * 2.1 + 1.2) ** 3 * 0.28;
      crest.push(x, baseY - (back * 0.82 + slip) * layer.height);
    }

    const filled = [...crest, W + step, baseY + 60, -step, baseY + 60];
    r.blob(filled, body);

    // Versante sottovento in ombra: sta sempre dalla stessa parte del sole.
    r.push();
    r.setAlpha(0.5);
    for (let i = 2; i < crest.length - 2; i += 2) {
      const y0 = crest[i + 1] ?? baseY;
      const y1 = crest[i + 3] ?? y0;
      if (y1 <= y0) continue;
      const x = crest[i] ?? 0;
      r.polygon([x, y0, x + step, y1, x + step, y1 + 26, x, y0 + 20], shade);
    }
    r.pop();

    // La cresta: un filo di luce che corre lungo tutta la duna.
    r.push();
    r.setAlpha(0.6 - layer.depth * 0.3);
    r.line(crest, 2, lit);
    r.pop();

    // Il fumo di sabbia che si stacca dalle creste col vento. È lento e
    // deterministico: non è pulviscolo, è la duna che si sposta.
    r.push();
    r.setAlpha(0.14);
    const drift = theme.sandDrift ?? 1;
    for (let i = 4; i < crest.length - 4; i += 6) {
      const x = crest[i] ?? 0;
      const y = crest[i + 1] ?? baseY;
      const puff = 8 + Math.abs(Math.sin(tick / 90 + i)) * 10;
      r.radial(x + drift * puff, y - 4, puff * 1.6, 5, [
        { at: 0, color: alpha(theme.cloudLight, 0.7) },
        { at: 1, color: alpha(theme.cloudLight, 0) },
      ]);
    }
    r.pop();
  }
}

/**
 * Sabbia sospesa: veli che attraversano lo schermo in orizzontale.
 *
 * È il gemello di `drawSnowfall` e fa il lavoro opposto. La neve cade, e
 * cadendo riempie l'aria; questa corre, e correndo dice da che parte tira il
 * vento — informazione di gioco, non decorazione, perché nel terzo mondo il
 * vento sposta il gatto mentre è a mezz'aria.
 */
function drawSandDrift(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  W: number,
  H: number,
): void {
  const drift = theme.sandDrift ?? 1;
  const layers = [
    { count: 30, speed: 1.6, length: 26, size: 0.9, parallax: 0.1, alpha: 0.18 },
    { count: 18, speed: 3.1, length: 44, size: 1.4, parallax: 0.26, alpha: 0.24 },
    { count: 9, speed: 5.4, length: 78, size: 2.2, parallax: 0.5, alpha: 0.3 },
  ];

  r.push();
  for (const layer of layers) {
    r.setAlpha(layer.alpha);
    for (let i = 0; i < layer.count; i++) {
      const seed = hash(i * 5.3 + layer.size);
      const span = W + layer.length * 2 + 120;
      let x = (seed * span + tick * layer.speed * drift - camX * layer.parallax) % span;
      if (x < 0) x += span;
      const px = x - layer.length - 60;
      // La quota oscilla piano: un velo di sabbia non corre mai dritto.
      const y = seed * H + Math.sin(tick / (80 + seed * 90) + i) * 9;

      r.line([px, y, px + drift * layer.length, y - 1.5], layer.size, theme.cloudLight);
    }
  }
  r.pop();
}

// ---------------------------------------------------------------- gelo
/**
 * Aurora boreale: tende verticali di luce che si spostano lentissime.
 *
 * Sono additive e sfumano verso l'alto perché è così che si comporta la luce
 * che *emette* invece di riflettere. È l'unica cosa bella del secondo mondo,
 * ed è lì apposta: si guarda in alto e si dimentica cosa c'è sotto i piedi.
 */
function drawAurora(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  W: number,
  H: number,
): void {
  r.push();
  r.setBlend('add');

  for (let band = 0; band < 4; band++) {
    const seed = hash(band * 6.7);
    const drift = tick / (260 + seed * 200) + band * 1.3;
    const baseX = ((band * 240 + seed * 180 - camX * 0.04) % (W + 380) + W + 380) % (W + 380) - 190;
    const width = 110 + seed * 130;
    const top = H * (0.03 + seed * 0.09);
    const height = H * (0.32 + seed * 0.2);
    const color = band % 2 ? theme.sunGlow : theme.sunTint;
    const strength = 0.05 + Math.abs(Math.sin(drift * 0.7)) * 0.04;

    // La tenda non è una forma piena: è una serie di veli verticali affiancati,
    // ognuno sfumato ai due capi. Un poligono, per quanto ondulato, avrebbe i
    // bordi netti — e la luce nell'aria non ha bordi.
    const veils = 14;
    for (let i = 0; i <= veils; i++) {
      const t = i / veils;
      // I veli ai lati della tenda sono più deboli: è quello che le dà una
      // forma invece di una larghezza.
      const edge = Math.sin(t * Math.PI);
      const sway = Math.sin(drift + t * 3.4) * 30;
      const x = baseX + t * width + sway;
      const y = top + Math.sin(drift * 1.4 + t * 2.2) * 14;
      const flicker = 0.6 + Math.abs(Math.sin(drift * 2.3 + t * 5.1)) * 0.4;

      r.setAlpha(strength * edge * flicker);
      r.radial(x, y + height * 0.45, 16 + seed * 10, height * 0.55, [
        { at: 0, color: alpha(color, 0.85) },
        { at: 0.55, color: alpha(color, 0.35) },
        { at: 1, color: alpha(color, 0) },
      ]);
    }

    // Il bordo inferiore è il più acceso: è lì che la scarica finisce.
    r.setAlpha(strength * 0.9);
    r.radial(baseX + width / 2 + Math.sin(drift + 1.7) * 20, top + height * 0.86, width * 0.42, 26, [
      { at: 0, color: alpha(color, 0.8) },
      { at: 1, color: alpha(color, 0) },
    ]);
  }

  r.pop();
}

/**
 * Neve.
 *
 * Deterministica come tutto il resto: ogni fiocco ha una posizione che è
 * funzione del tempo e del suo indice, mai di un numero casuale. Tre piani con
 * parallasse diversa — i fiocchi vicini sono grandi, veloci e sfocati, quelli
 * lontani lenti e minuscoli — ed è la differenza tra "nevica" e "ci sono dei
 * puntini bianchi sullo schermo".
 */
function drawSnowfall(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  W: number,
  H: number,
): void {
  const layers = [
    { count: 40, speed: 0.5, drift: 0.35, size: 1, parallax: 0.08, alpha: 0.4 },
    { count: 26, speed: 0.95, drift: 0.6, size: 1.7, parallax: 0.22, alpha: 0.6 },
    { count: 14, speed: 1.7, drift: 0.9, size: 2.6, parallax: 0.45, alpha: 0.75 },
  ];

  r.push();
  for (const layer of layers) {
    r.setAlpha(layer.alpha);
    for (let i = 0; i < layer.count; i++) {
      const seed = hash(i * 3.7 + layer.size);
      const span = W + 80;
      // Caduta: verticale col tempo, laterale con un'oscillazione lenta.
      const fall = (tick * layer.speed + seed * (H + 60)) % (H + 60);
      const swing = Math.sin(tick / (70 + seed * 60) + i) * 18 * layer.drift;
      let sx = (seed * span + swing - camX * layer.parallax) % span;
      if (sx < 0) sx += span;

      const y = fall - 30;
      const size = layer.size * (0.7 + seed * 0.6);
      r.ellipse(sx - 40, y, size, size, theme.cloudLight);
    }
  }
  r.pop();
}

// ---------------------------------------------------------------- cielo
function drawSky(r: Renderer, theme: SkyTheme, W: number, H: number, horizon: number): void {
  r.gradientRect(0, 0, W, H, theme.stops);

  // Diffusione atmosferica attorno al sole: l'aria vicino alla sorgente si
  // schiarisce e perde saturazione, ed è ciò che fa sembrare il cielo profondo.
  const sx = W * theme.sunX;
  const sy = H * theme.sunY;
  r.push();
  r.setBlend('screen');
  r.radial(sx, sy, W * 0.85, H * 0.75, [
    { at: 0, color: alpha(theme.sunGlow, 0.22) },
    { at: 0.45, color: alpha(theme.sunGlow, 0.08) },
    { at: 1, color: alpha(theme.sunGlow, 0) },
  ]);
  r.pop();

  // L'orizzonte è sempre più chiaro dello zenit: c'è più aria da attraversare.
  r.push();
  r.setBlend('screen');
  r.gradientRect(0, horizon - H * 0.42, W, H * 0.42, [
    { at: 0, color: alpha(theme.fog, 0) },
    { at: 1, color: alpha(theme.fog, 0.5) },
  ]);
  r.pop();
}

function drawStars(r: Renderer, theme: SkyTheme, camX: number, tick: number, W: number, H: number): void {
  r.push();
  r.setBlend('add');

  // Banda della via lattea: una fascia di polvere luminosa, non stelle singole.
  r.push();
  r.setAlpha(0.5);
  r.radial(W * 0.34, H * 0.3, W * 0.5, H * 0.18, [
    { at: 0, color: alpha(theme.sunGlow, 0.16) },
    { at: 1, color: alpha(theme.sunGlow, 0) },
  ]);
  r.pop();

  for (let i = 0; i < 150; i++) {
    const spread = W * 4;
    let sx = (hash(i) * spread - camX * 0.03) % (W + 60);
    if (sx < 0) sx += W + 60;
    const sy = hash(i + 99) * H * 0.72;
    const magnitude = hash(i + 7);
    // Ogni stella scintilla a un ritmo suo: tutte insieme sembrerebbe un lampeggio.
    const twinkle = 0.35 + Math.abs(Math.sin(tick / (28 + magnitude * 40) + i)) * 0.65;
    const size = magnitude > 0.94 ? 1.6 : magnitude > 0.7 ? 1.1 : 0.7;

    r.setAlpha(twinkle * (0.4 + magnitude * 0.6));
    r.radial(sx, sy, size * 3, size * 3, [
      { at: 0, color: glare(0.5) },
      { at: 1, color: glare(0) },
    ]);
    r.ellipse(sx, sy, size, size, '#ffffff');
  }
  r.pop();
}

/** Sole o luna: nucleo, alone atmosferico e raggi crepuscolari. */
function drawCelestialBody(r: Renderer, theme: SkyTheme, tick: number, W: number, H: number): void {
  const x = W * theme.sunX;
  const y = H * theme.sunY;
  const radius = theme.sunRadius;

  r.push();
  r.setBlend('add');

  // Alone in due strati: ampio e tenue, poi stretto e intenso.
  r.radial(x, y, radius * 6, radius * 6, [
    { at: 0, color: alpha(theme.sunGlow, 0.11) },
    { at: 0.5, color: alpha(theme.sunGlow, 0.035) },
    { at: 1, color: alpha(theme.sunGlow, 0) },
  ]);
  r.radial(x, y, radius * 2.4, radius * 2.4, [
    { at: 0, color: alpha(theme.sunGlow, 0.3) },
    { at: 1, color: alpha(theme.sunGlow, 0) },
  ]);

  if (theme.rays) drawSunRays(r, theme, x, y, tick, radius);

  // Il disco vero e proprio, con il bordo che sfuma nell'alone.
  r.radial(x, y, radius * 1.25, radius * 1.25, [
    { at: 0, color: alpha(theme.sunCore, 1) },
    { at: 0.62, color: alpha(theme.sunCore, 0.95) },
    { at: 0.78, color: alpha(theme.sunGlow, 0.5) },
    { at: 1, color: alpha(theme.sunGlow, 0) },
  ]);
  r.pop();

  // I mari della luna: senza, sembra una lampadina.
  if (theme.stars) {
    r.push();
    r.setAlpha(0.09);
    r.ellipse(x - radius * 0.3, y - radius * 0.22, radius * 0.3, radius * 0.26, '#8496b8');
    r.ellipse(x + radius * 0.28, y + radius * 0.1, radius * 0.22, radius * 0.2, '#8496b8');
    r.ellipse(x + radius * 0.02, y + radius * 0.42, radius * 0.16, radius * 0.14, '#8496b8');
    r.pop();
  }
}

/**
 * Raggi crepuscolari: ventagli lunghissimi e quasi invisibili.
 * Devono leggersi come luce nell'aria, non come raggi disegnati: se se ne
 * distinguono i bordi sono troppo forti.
 */
function drawSunRays(
  r: Renderer,
  theme: SkyTheme,
  x: number,
  y: number,
  tick: number,
  radius: number,
): void {
  const length = radius * 26;
  for (let i = 0; i < 6; i++) {
    const seed = hash(i * 3.3);
    const angle = Math.PI * 0.36 + i * 0.32 + Math.sin(tick / 420 + i) * 0.02;
    const spread = 0.01 + seed * 0.018;
    const strength = 0.012 + seed * 0.014 + Math.sin(tick / 190 + i * 2) * 0.005;
    if (strength <= 0) continue;

    r.push();
    r.setAlpha(strength);
    r.polygon(
      [
        x,
        y,
        x + Math.cos(angle - spread) * length,
        y + Math.sin(angle - spread) * length,
        x + Math.cos(angle + spread) * length,
        y + Math.sin(angle + spread) * length,
      ],
      theme.sunGlow,
    );
    r.pop();
  }
}

// ---------------------------------------------------------------- rilievi
/**
 * Una catena montuosa. Il profilo viene campionato dalla funzione continua di
 * rumore, quindi le montagne scorrono davvero invece di ripetersi, e i
 * versanti esposti al sole ricevono una luce radente.
 */
function drawRange(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  layer: Layer,
  horizon: number,
  W: number,
): void {
  const step = 10;
  const worldX = camX * layer.speed;
  const baseY = horizon + layer.base;
  const rock = mix(theme.ridge, theme.fog, layer.depth * 0.9);
  const lit = mix(rock, theme.sunCore, 0.16 * (1 - layer.depth) + 0.05);

  const points: number[] = [];
  const heights: number[] = [];
  for (let x = -step; x <= W + step; x += step) {
    const h = ridgeAt(worldX + x, layer) * layer.height;
    heights.push(h);
    points.push(x, baseY - h);
  }
  points.push(W + step, baseY + 60, -step, baseY + 60);

  r.polygon(points, rock);

  // Versanti rivolti al sole: la luce radente prende solo la fascia sotto la
  // cresta, non tutto il fianco fino a valle — altrimenti sono rettangoli.
  r.push();
  r.setAlpha(0.42);
  const sunOnLeft = theme.sunX < 0.5;
  for (let i = 1; i < heights.length - 1; i++) {
    const h0 = heights[i - 1] ?? 0;
    const h1 = heights[i] ?? 0;
    const h2 = heights[i + 1] ?? h1;
    const slope = h1 - h0;
    const facingSun = sunOnLeft ? slope > 0 : slope < 0;
    if (!facingSun || Math.abs(slope) < 1.2) continue;

    // La fascia illuminata è profonda quanto è ripido il versante.
    const band = Math.min(layer.height * 0.42, 6 + Math.abs(slope) * 2.4);
    const x = -step + i * step;
    r.polygon(
      [x, baseY - h1, x + step, baseY - h2, x + step, baseY - h2 + band, x, baseY - h1 + band],
      lit,
    );
  }
  r.pop();

  // Foschia che si accumula alla base: è quello che stacca una cresta dall'altra.
  r.push();
  r.setAlpha(0.85);
  r.gradientRect(0, baseY - layer.height * 0.5, W, layer.height * 0.5 + 8, [
    { at: 0, color: alpha(theme.fog, 0) },
    { at: 1, color: alpha(theme.fog, 0.42 + layer.depth * 0.3) },
  ]);
  r.pop();
}

/** Bosco lontano: una massa continua di chiome, non alberi riconoscibili. */
function drawForest(r: Renderer, theme: SkyTheme, camX: number, horizon: number, W: number): void {
  const layer = FOREST;
  const worldX = camX * layer.speed;
  const baseY = horizon + layer.base;
  const color = mix(theme.canopy, theme.fog, layer.depth);

  const points: number[] = [];
  const step = 7;
  for (let x = -step; x <= W + step; x += step) {
    const n = ridgeAt(worldX + x, layer);
    const bumps = Math.abs(Math.sin((worldX + x) * 0.09)) * 6;
    points.push(x, baseY - n * layer.height - bumps);
  }
  points.push(W + step, baseY + 40, -step, baseY + 40);
  r.blob(points, color);
}

/**
 * Filare di alberi in primo piano, in controluce.
 * È il piano più vicino allo sguardo: quasi nero, con la chioma appena
 * illuminata sopra e un tronco che si legge contro il cielo.
 */
function drawTreeLine(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  horizon: number,
  W: number,
): void {
  // Sono il piano più vicino: in controluce, quindi più scuri del bosco dietro
  // — ma non neri, altrimenti diventano sassi ritagliati sull'orizzonte.
  const dark = mix(mix(theme.canopy, '#000000', 0.14), theme.fog, 0.2);
  const trunk = mix(dark, '#000000', 0.3);
  // I tronchi poggiano sull'orizzonte, non sotto: più in basso finirebbero
  // dietro al terreno giocabile e resterebbero solo delle gobbe.
  const baseY = horizon + 2;

  const first = Math.floor((camX * TREE_SPEED) / TREE_SPACING) - 1;
  for (let i = first; i < first + Math.ceil(W / TREE_SPACING) + 3; i++) {
    const seed = hash(i * 1.37);
    const x = i * TREE_SPACING - camX * TREE_SPEED + seed * 40;
    if (x < -90 || x > W + 90) continue;

    const scale = 0.62 + hash(i * 2.11) * 0.5;
    const height = 96 * scale;
    // Le chiome ondeggiano appena: piano diverso, vento diverso.
    const sway = Math.sin(tick / 130 + i) * 2.2 * scale;
    const topY = baseY - height;

    // Tronco: si assottiglia verso l'alto e si allarga alla base.
    r.polygon(
      [
        x - 1.6 * scale, topY + height * 0.4,
        x + 1.6 * scale, topY + height * 0.4,
        x + 3.4 * scale, baseY,
        x - 3.4 * scale, baseY,
      ],
      trunk,
    );
    // Chioma più alta che larga: da lontano è la proporzione a dire "albero".
    r.blob(
      [
        x + sway, topY,
        x + 18 * scale + sway * 0.6, topY + 14 * scale,
        x + 21 * scale, topY + 34 * scale,
        x + 9 * scale, topY + 48 * scale,
        x - 10 * scale, topY + 45 * scale,
        x - 21 * scale, topY + 29 * scale,
        x - 17 * scale + sway * 0.6, topY + 11 * scale,
      ],
      dark,
    );
    // Bordo superiore colpito dalla luce del cielo.
    r.push();
    r.setAlpha(0.3);
    r.blob(
      [
        x + sway, topY,
        x + 14 * scale + sway * 0.6, topY + 11 * scale,
        x + 6 * scale, topY + 15 * scale,
        x - 12 * scale, topY + 12 * scale,
      ],
      mix(dark, theme.sunTint, 0.55),
    );
    r.pop();
  }
}

// ---------------------------------------------------------------- nuvole
/**
 * Nuvole volumetriche: ogni nuvola è un grappolo di sbuffi con gradiente
 * radiale, illuminati sopra e in ombra sotto. Un'ellisse piatta sembra un
 * adesivo; un grappolo con un gradiente sembra vapore.
 */
function drawClouds(
  r: Renderer,
  theme: SkyTheme,
  camX: number,
  tick: number,
  W: number,
  H: number,
): void {
  const first = Math.floor((camX * CLOUD_SPEED) / CLOUD_SPACING) - 1;
  const drift = tick * 0.05;

  for (let i = first; i < first + Math.ceil(W / CLOUD_SPACING) + 3; i++) {
    const seed = hash(i * 4.19);
    const x = i * CLOUD_SPACING - camX * CLOUD_SPEED - drift + seed * 120;
    if (x < -260 || x > W + 260) continue;

    const y = H * (0.09 + hash(i * 7.7) * 0.34);
    const scale = 0.7 + hash(i * 2.9) * 0.9;
    const density = 0.42 + hash(i * 5.3) * 0.42;
    drawCloud(r, theme, x, y, scale, density, i, tick);
  }
}

function drawCloud(
  r: Renderer,
  theme: SkyTheme,
  x: number,
  y: number,
  scale: number,
  density: number,
  seed: number,
  tick: number,
): void {
  const puffs = 6;
  r.push();

  // Ventre in ombra: sotto, la nuvola il sole non lo vede.
  for (let i = 0; i < puffs; i++) {
    const n = hash(seed * 13 + i);
    const px = x + (i - puffs / 2) * 26 * scale;
    const py = y + (10 + n * 6) * scale + Math.sin(tick / 200 + i) * 1.2;
    const rx = (26 + n * 20) * scale;
    r.radial(px, py, rx, rx * 0.5, [
      { at: 0, color: alpha(theme.cloudShade, density * 0.5) },
      { at: 1, color: alpha(theme.cloudShade, 0) },
    ]);
  }

  // Corpo illuminato: i cumuli sopra, sfalsati, col bordo che sfuma.
  for (let i = 0; i < puffs; i++) {
    const n = hash(seed * 17 + i * 3);
    const px = x + (i - puffs / 2) * 24 * scale + n * 10;
    const py = y - n * 14 * scale + Math.sin(tick / 180 + i * 1.7) * 1.4;
    const rx = (24 + n * 22) * scale;
    const ry = rx * (0.52 + n * 0.22);
    r.radial(px, py, rx, ry, [
      { at: 0, color: alpha(theme.cloudLight, density) },
      { at: 0.55, color: alpha(theme.cloudLight, density * 0.6) },
      { at: 1, color: alpha(theme.cloudLight, 0) },
    ]);
  }

  // Cresta illuminata dal sole, sul lato che lo guarda.
  const side = theme.sunX < 0.5 ? -1 : 1;
  r.setBlend('screen');
  for (let i = 0; i < 3; i++) {
    const n = hash(seed * 23 + i);
    const px = x + side * (18 + i * 22) * scale;
    const py = y - (12 + n * 10) * scale;
    r.radial(px, py, 18 * scale, 11 * scale, [
      { at: 0, color: alpha(theme.sunCore, density * 0.5) },
      { at: 1, color: alpha(theme.sunCore, 0) },
    ]);
  }
  r.pop();
}

/**
 * Nebbia al suolo: l'ultimo strato d'aria prima del mondo giocabile.
 * Serve a due cose insieme — dare atmosfera e staccare nettamente il fondale
 * dai tile su cui il giocatore può davvero camminare.
 */
function drawGroundHaze(r: Renderer, theme: SkyTheme, horizon: number, W: number, H: number): void {
  r.push();
  r.setAlpha(theme.haze);
  r.gradientRect(0, horizon - 130, W, H - horizon + 130, [
    { at: 0, color: alpha(theme.fog, 0) },
    { at: 0.62, color: alpha(theme.fog, 0.55) },
    { at: 1, color: alpha(theme.fog, 0.9) },
  ]);
  r.pop();
}

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
  const theme = SKIES[sky];
  const { width: W, height: H } = r;
  const horizon = H * HORIZON;

  drawSky(r, theme, W, H, horizon);

  if (!theme.landscape) {
    drawCaveDepth(r, theme, camX, tick, W, H);
    drawGroundHaze(r, theme, horizon, W, H);
    return;
  }

  if (theme.stars) drawStars(r, theme, camX, tick, W, H);
  drawCelestialBody(r, theme, tick, W, H);
  drawRange(r, theme, camX, FAR_RANGE, horizon, W);
  drawRange(r, theme, camX, MID_RANGE, horizon, W);
  drawClouds(r, theme, camX, tick, W, H);
  drawRange(r, theme, camX, NEAR_RANGE, horizon, W);
  drawForest(r, theme, camX, horizon, W);
  drawTreeLine(r, theme, camX, tick, horizon, W);
  drawGroundHaze(r, theme, horizon, W, H);
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

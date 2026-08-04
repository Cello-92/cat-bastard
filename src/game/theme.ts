/**
 * Palette del gioco: unico posto in cui esistono colori.
 *
 * Regola (CLAUDE.md): mai colori hardcoded nel codice di disegno. Aggiungere
 * un colore qui è una decisione di direzione artistica, non un dettaglio.
 * I valori UI sono duplicati in src/style.css — vanno tenuti allineati.
 */

export const PALETTE = {
  ink: '#14101c',
  inkSoft: '#241b30',
  paper: '#f6efe2',
  hot: '#ff2e88',
  hotDeep: '#7a0d3f',
  gold: '#f2c94c',
  goldDeep: '#b8862a',

  dirt: '#5c4033',
  dirtDark: '#3d2a22',
  grass: '#4a9d5f',
  grassLight: '#63bd7a',
  brick: '#c96a3a',
  wood: '#8a6a4a',
  stone: '#cfd6dd',
  stoneDark: '#8d99a6',
  pipe: '#2f8f52',
  pipeLight: '#57c47c',
  fur: '#8a5a3a',
  furDark: '#3a2418',
  shroom: '#e03c3c',
  used: '#9a6a3a',
} as const;

export interface SkyTheme {
  top: string;
  bottom: string;
  hills: string;
  clouds: string;
}

/** Ogni mondo ha la sua identità visiva: cielo, colline, nuvole. */
export const SKIES = {
  day: {
    top: '#8fd3d8',
    bottom: '#e8dcc0',
    hills: 'rgba(74,157,95,.35)',
    clouds: 'rgba(255,255,255,.55)',
  },
  sunset: {
    top: '#f2884b',
    bottom: '#ffd9a0',
    hills: 'rgba(122,13,63,.32)',
    clouds: 'rgba(255,236,214,.5)',
  },
  night: {
    top: '#1b2a5c',
    bottom: '#4b3a72',
    hills: 'rgba(12,10,30,.5)',
    clouds: 'rgba(200,210,255,.28)',
  },
  cave: {
    top: '#241b30',
    bottom: '#3d2a3a',
    hills: 'rgba(10,8,16,.55)',
    clouds: 'rgba(255,46,136,.08)',
  },
} as const satisfies Record<string, SkyTheme>;

export type SkyName = keyof typeof SKIES;

/** Nero semitrasparente riutilizzabile per ombre e incassi. */
export const shade = (alpha: number): string => `rgba(0,0,0,${alpha})`;

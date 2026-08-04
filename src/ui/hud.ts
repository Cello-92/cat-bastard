import { formatTicks } from './format';

/**
 * HUD in DOM, non su canvas.
 *
 * Il testo lo rende il browser: nitido a qualunque risoluzione, accessibile,
 * e non costa un solo pixel di lavoro al renderer. Si aggiorna solo quando un
 * valore cambia davvero, così non si tocca il layout 60 volte al secondo.
 */

export interface HudValues {
  deaths: number;
  coins: number;
  ticks: number;
  levelName: string;
}

type HudField = 'deaths' | 'coins' | 'time' | 'level';

export class Hud {
  private readonly fields: Record<HudField, HTMLElement | null>;
  private readonly last = new Map<HudField, string>();

  constructor(root: ParentNode) {
    this.fields = {
      deaths: root.querySelector<HTMLElement>('[data-hud="deaths"]'),
      coins: root.querySelector<HTMLElement>('[data-hud="coins"]'),
      time: root.querySelector<HTMLElement>('[data-hud="time"]'),
      level: root.querySelector<HTMLElement>('[data-hud="level"]'),
    };
  }

  update(values: HudValues): void {
    this.set('deaths', String(values.deaths));
    this.set('coins', String(values.coins));
    this.set('time', formatTicks(values.ticks));
    this.set('level', values.levelName);
  }

  private set(field: HudField, value: string): void {
    if (this.last.get(field) === value) return;
    this.last.set(field, value);
    const el = this.fields[field];
    if (el) el.textContent = value;
  }
}

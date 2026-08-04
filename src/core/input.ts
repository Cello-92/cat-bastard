/**
 * Input unificato tastiera + touch.
 *
 * I comandi non tradiscono mai (vedi CLAUDE.md): niente lag artificiale,
 * niente input persi. `justPressed` va consumato una sola volta per tick,
 * per questo `endTick()` va chiamato al termine di ogni update fisso.
 */

export type Action = 'left' | 'right' | 'jump' | 'restart';

const KEY_BINDINGS: Readonly<Record<string, Action>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  KeyR: 'restart',
};

export class Input {
  private readonly held = new Set<Action>();
  private readonly pressed = new Set<Action>();
  private readonly disposers: Array<() => void> = [];

  constructor(target: Window = window) {
    this.on(target, 'keydown', (e) => {
      const event = e as KeyboardEvent;
      if (event.repeat) return;
      const action = KEY_BINDINGS[event.code];
      if (!action) return;
      event.preventDefault();
      this.press(action);
    });

    this.on(target, 'keyup', (e) => {
      const event = e as KeyboardEvent;
      const action = KEY_BINDINGS[event.code];
      if (!action) return;
      event.preventDefault();
      this.release(action);
    });

    // Perdere il focus non deve lasciare il gatto che corre da solo.
    this.on(target, 'blur', () => this.releaseAll());
  }

  /** Collega un elemento del pad touch a un'azione. */
  bindTouch(el: HTMLElement, action: Action): void {
    const down = (e: Event) => {
      e.preventDefault();
      this.press(action);
    };
    const up = (e: Event) => {
      e.preventDefault();
      this.release(action);
    };
    this.on(el, 'pointerdown', down);
    this.on(el, 'pointerup', up);
    this.on(el, 'pointercancel', up);
    this.on(el, 'pointerleave', up);
    this.on(el, 'contextmenu', (e) => e.preventDefault());
  }

  isDown(action: Action): boolean {
    return this.held.has(action);
  }

  justPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  /** Da chiamare alla fine di ogni update a timestep fisso. */
  endTick(): void {
    this.pressed.clear();
  }

  releaseAll(): void {
    this.held.clear();
    this.pressed.clear();
  }

  dispose(): void {
    for (const off of this.disposers) off();
    this.disposers.length = 0;
    this.releaseAll();
  }

  private press(action: Action): void {
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  }

  private release(action: Action): void {
    this.held.delete(action);
  }

  private on(target: EventTarget, type: string, handler: (e: Event) => void): void {
    target.addEventListener(type, handler, { passive: false });
    this.disposers.push(() => target.removeEventListener(type, handler));
  }
}

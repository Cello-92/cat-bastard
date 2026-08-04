import { clamp, randRange } from '@core/math';

/**
 * Camera che insegue il giocatore con smoothing, più screen shake.
 * Lo shake è "juice": decade da solo, non va mai gestito da fuori.
 */

export interface CameraOptions {
  viewWidth: number;
  viewHeight: number;
  /** Frazione di schermo davanti al giocatore (0.5 = centrato). */
  lead?: number;
  /** Quanto è rapido l'inseguimento, per tick. 1 = istantaneo. */
  smoothing?: number;
}

export class Camera {
  x = 0;
  y = 0;

  private shakeAmount = 0;
  private shakeX = 0;
  private shakeY = 0;

  readonly viewWidth: number;
  readonly viewHeight: number;
  private readonly lead: number;
  private readonly smoothing: number;

  constructor({ viewWidth, viewHeight, lead = 0.4, smoothing = 0.14 }: CameraOptions) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.lead = lead;
    this.smoothing = smoothing;
  }

  /** Salta subito alla posizione target: da usare al respawn. */
  snapTo(targetX: number, worldWidth: number): void {
    this.x = this.clampX(targetX - this.viewWidth * this.lead, worldWidth);
    this.shakeAmount = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  follow(targetX: number, worldWidth: number): void {
    const desired = this.clampX(targetX - this.viewWidth * this.lead, worldWidth);
    this.x += (desired - this.x) * this.smoothing;
  }

  shake(amount: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  update(): void {
    if (this.shakeAmount <= 0.05) {
      this.shakeAmount = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }
    this.shakeX = randRange(-this.shakeAmount, this.shakeAmount);
    this.shakeY = randRange(-this.shakeAmount, this.shakeAmount);
    this.shakeAmount *= 0.88;
  }

  /** Offset da applicare al rendering (camera + shake), arrotondato ai pixel. */
  get offsetX(): number {
    return Math.round(this.x + this.shakeX);
  }

  get offsetY(): number {
    return Math.round(this.y + this.shakeY);
  }

  /** Colonne visibili, con un tile di margine: evita di disegnare il mondo intero. */
  visibleColumns(tileSize: number, cols: number): { from: number; to: number } {
    return {
      from: Math.max(0, Math.floor(this.x / tileSize) - 1),
      to: Math.min(cols - 1, Math.ceil((this.x + this.viewWidth) / tileSize) + 1),
    };
  }

  private clampX(value: number, worldWidth: number): number {
    return clamp(value, 0, Math.max(0, worldWidth - this.viewWidth));
  }
}

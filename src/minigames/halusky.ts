import type { AudioManager } from '@/systems/audio-manager';
import type { InputSystem } from '@/systems/input-system';
import { angleDiff } from '@/utils/math-utils';
import { centerText, FOLK, woodBackground, type Minigame, type MinigameResult } from './minigame';

const GRATE_GOAL = 24;
const GRATE_TIME = 8;
const STIR_ROUNDS = 8;

/** Bryndzové halušky: grate the potatoes, then stir to the rhythm. */
export class HaluskyGame implements Minigame {
  readonly title = 'Bryndzové halušky';
  help = 'Strúhaj zemiaky: striedaj ← a → (alebo A / D).';
  private phase: 'grate' | 'stir' | 'done' = 'grate';
  private time = 0;
  private grates = 0;
  private lastSide = 0;
  private angle = 0;
  private speed = 2.6;
  private zone = Math.random() * Math.PI * 2;
  private readonly zoneWidth = 0.75;
  private round = 0;
  private hits = 0;
  private flashGood = 0;
  private flashBad = 0;
  private aborted = false;
  private grateScore = 0;

  constructor(private readonly audio: AudioManager) {}

  update(dt: number, input: InputSystem): boolean {
    if (input.codePressed('Escape')) {
      this.aborted = true;
      return true;
    }
    this.time += dt;
    this.flashGood = Math.max(0, this.flashGood - dt * 3);
    this.flashBad = Math.max(0, this.flashBad - dt * 3);
    if (this.phase === 'grate') {
      const left = input.codePressed('ArrowLeft') || input.codePressed('KeyA') || input.padButtonPressed(14);
      const right = input.codePressed('ArrowRight') || input.codePressed('KeyD') || input.padButtonPressed(15);
      if (left && this.lastSide !== -1) {
        this.grates++;
        this.lastSide = -1;
        this.audio.play('straw', { volume: 0.25, pitch: 1.4 });
      } else if (right && this.lastSide !== 1) {
        this.grates++;
        this.lastSide = 1;
        this.audio.play('straw', { volume: 0.25, pitch: 1.6 });
      }
      if (this.grates >= GRATE_GOAL || this.time > GRATE_TIME) {
        this.grateScore = Math.min(1, this.grates / GRATE_GOAL);
        this.phase = 'stir';
        this.help = 'Miešaj: stlač MEDZERNÍK, keď varecha prechádza zeleným poľom.';
        this.time = 0;
      }
    } else if (this.phase === 'stir') {
      this.angle += this.speed * dt;
      if (input.codePressed('Space') || input.padButtonPressed(0)) {
        const inZone = Math.abs(angleDiff(this.angle, this.zone)) < this.zoneWidth / 2;
        if (inZone) {
          this.hits++;
          this.flashGood = 1;
          this.audio.play('coin', { pitch: 0.7, volume: 0.5 });
        } else {
          this.flashBad = 1;
          this.audio.play('miss');
        }
        this.round++;
        this.speed += 0.45;
        this.zone = Math.random() * Math.PI * 2;
        if (this.round >= STIR_ROUNDS) this.phase = 'done';
      }
    }
    return this.phase === 'done';
  }

  result(): MinigameResult {
    const score = this.grateScore * 0.4 + (this.hits / STIR_ROUNDS) * 0.6;
    return { won: !this.aborted, score, aborted: this.aborted };
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number): void {
    woodBackground(g, w, h);
    const cx = w / 2;
    const cy = h / 2 + 20;
    if (this.phase === 'grate') {
      centerText(g, 'Strúhaj zemiaky!', cx, 50, 30, FOLK.gold);
      // grater
      g.fillStyle = '#9aa0a6';
      g.fillRect(cx - 60, cy - 90, 120, 180);
      g.fillStyle = '#5c6268';
      for (let y = cy - 80; y < cy + 80; y += 14) {
        for (let x = cx - 50; x < cx + 50; x += 16) g.fillRect(x + ((y / 14) % 2) * 8, y, 7, 3);
      }
      // potato
      const px = cx + this.lastSide * 30;
      g.fillStyle = '#c9a36a';
      g.beginPath();
      g.ellipse(px, cy - 20, 34, 24, 0.3, 0, Math.PI * 2);
      g.fill();
      centerText(g, '←', cx - 140, cy, 54, this.lastSide === 1 ? FOLK.gold : FOLK.dim);
      centerText(g, '→', cx + 140, cy, 54, this.lastSide === -1 ? FOLK.gold : FOLK.dim);
      g.fillStyle = FOLK.black;
      g.fillRect(cx - 150, h - 50, 300, 14);
      g.fillStyle = FOLK.gold;
      g.fillRect(cx - 150, h - 50, (300 * Math.min(this.grates, GRATE_GOAL)) / GRATE_GOAL, 14);
      centerText(g, `${Math.max(0, GRATE_TIME - this.time).toFixed(1)} s`, cx + 200, h - 43, 18);
      return;
    }
    centerText(g, 'Miešaj v kotlíku!', cx, 42, 30, FOLK.gold);
    const r = 120;
    g.fillStyle = '#1a1a1c';
    g.beginPath();
    g.arc(cx, cy, r + 18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = this.flashBad > 0 ? '#8a5040' : '#e8e0c8';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    // dumplings
    g.fillStyle = '#d8ccb0';
    for (let i = 0; i < 40; i++) {
      const a = i * 2.4 + this.angle * 0.3;
      const d = ((i * 37) % 100) / 100;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * r * 0.85 * d, cy + Math.sin(a) * r * 0.85 * d, 7, 4, a, 0, Math.PI * 2);
      g.fill();
    }
    // target zone
    g.strokeStyle = this.flashGood > 0 ? '#bfff9a' : '#7fb069';
    g.lineWidth = 16;
    g.beginPath();
    g.arc(cx, cy, r + 9, this.zone - this.zoneWidth / 2, this.zone + this.zoneWidth / 2);
    g.stroke();
    // spoon
    g.strokeStyle = '#8a5a32';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx + Math.cos(this.angle) * 20, cy + Math.sin(this.angle) * 20);
    g.lineTo(cx + Math.cos(this.angle) * (r + 14), cy + Math.sin(this.angle) * (r + 14));
    g.stroke();
    centerText(g, `${this.hits} / ${this.round}`, cx + 230, cy, 26);
  }
}

import type { InputSystem } from '@/systems/input-system';

export interface MinigameResult {
  won: boolean;
  /** 0..1 performance */
  score: number;
  aborted: boolean;
}

export interface Minigame {
  readonly title: string;
  readonly help: string;
  /** Returns true when finished. */
  update(dt: number, input: InputSystem): boolean;
  draw(g: CanvasRenderingContext2D, w: number, h: number): void;
  result(): MinigameResult;
}

export const FOLK = {
  red: '#b3261e',
  redBright: '#d8432f',
  gold: '#d9b24a',
  ink: '#f3ead6',
  dim: '#c9bc9f',
  wood: '#2a1c13',
  wood2: '#3a281b',
  black: '#120d0a',
};

export function woodBackground(g: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#3a281b');
  grad.addColorStop(1, '#1b120c');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 1;
  for (let y = 12; y < h; y += 22) {
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 40) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 2);
    g.stroke();
  }
  // embroidery border
  g.fillStyle = FOLK.red;
  for (let x = 0; x < w; x += 14) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 7, 7);
    g.lineTo(x + 14, 0);
    g.fill();
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(x + 7, h - 7);
    g.lineTo(x + 14, h);
    g.fill();
  }
}

export function centerText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = FOLK.ink): void {
  g.font = `700 ${size}px "Alegreya SC", Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(0,0,0,0.7)';
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

import type { AudioManager } from '@/systems/audio-manager';
import type { InputSystem } from '@/systems/input-system';
import type { FujaraSong } from '@/types/game-types';
import { centerText, FOLK, woodBackground, type Minigame, type MinigameResult } from './minigame';

const LANE_KEYS = [
  ['KeyD', 'ArrowLeft'],
  ['KeyF', 'ArrowDown'],
  ['KeyJ', 'ArrowUp'],
  ['KeyK', 'ArrowRight'],
];
const PAD_LANES = [14, 13, 12, 15];
const LANE_LABELS = ['D', 'F', 'J', 'K'];
const LANE_COLORS = [FOLK.redBright, '#efe6d2', '#2a2420', FOLK.gold];
const TRAVEL = 1.7;
const LEAD_IN = 2.0;
const PERFECT = 0.1;
const GOOD = 0.2;

export const DEFAULT_SONG: FujaraSong = {
  id: 'default',
  title: 'Na Rovnej hore',
  bpm: 96,
  lanePitches: [392, 440, 493.88, 587.33],
  notes: [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 1],
    [4, 0],
    [5.5, 2],
    [6, 3],
    [7, 2],
    [8, 1],
    [9, 0],
    [10, 2],
    [11, 3],
    [12, 3],
    [13, 2],
    [14, 0],
    [15, 1],
  ],
};

interface Note {
  t: number;
  lane: number;
  state: 'pending' | 'hit' | 'miss';
}

/** Guitar-hero style fujara playing. */
export class FujaraGame implements Minigame {
  readonly title = 'Umenie fujary';
  readonly help = 'Stláčaj D F J K (alebo šípky), keď nota dopadne na čiaru. Esc = prestať hrať.';
  private time = 0;
  private readonly notes: Note[];
  private readonly end: number;
  private combo = 0;
  private bestCombo = 0;
  private points = 0;
  private feedback = '';
  private feedbackT = 0;
  private aborted = false;
  private readonly flash = [0, 0, 0, 0];

  constructor(
    private readonly song: FujaraSong,
    private readonly audio: AudioManager,
  ) {
    const spb = 60 / song.bpm;
    this.notes = song.notes.map(([beat, lane]) => ({ t: LEAD_IN + beat * spb, lane: lane % 4, state: 'pending' as const }));
    this.end = (this.notes[this.notes.length - 1]?.t ?? LEAD_IN) + 1.2;
  }

  update(dt: number, input: InputSystem): boolean {
    if (input.codePressed('Escape')) {
      this.aborted = true;
      return true;
    }
    this.time += dt;
    this.feedbackT = Math.max(0, this.feedbackT - dt);
    for (let l = 0; l < 4; l++) {
      this.flash[l] = Math.max(0, this.flash[l] - dt * 4);
      const pressed = LANE_KEYS[l].some((k) => input.codePressed(k)) || input.padButtonPressed(PAD_LANES[l]);
      if (pressed) this.press(l);
    }
    for (const n of this.notes) {
      if (n.state === 'pending' && this.time - n.t > GOOD) {
        n.state = 'miss';
        this.combo = 0;
        this.say('Pískol si!');
      }
    }
    return this.time > this.end;
  }

  private press(lane: number): void {
    this.flash[lane] = 1;
    let best: Note | null = null;
    let bestD = GOOD;
    for (const n of this.notes) {
      if (n.state !== 'pending' || n.lane !== lane) continue;
      const d = Math.abs(n.t - this.time);
      if (d <= bestD) {
        best = n;
        bestD = d;
      }
    }
    if (!best) {
      this.audio.play('miss');
      this.combo = 0;
      return;
    }
    best.state = 'hit';
    this.audio.fujaraNote(this.song.lanePitches[lane] ?? 440, 0.5);
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (bestD <= PERFECT) {
      this.points += 1;
      this.say('Výborne!');
    } else {
      this.points += 0.6;
      this.say('Dobre');
    }
  }

  private say(text: string): void {
    this.feedback = text;
    this.feedbackT = 0.6;
  }

  result(): MinigameResult {
    const score = this.notes.length ? this.points / this.notes.length : 0;
    return { won: score >= 0.5, score: this.aborted ? score * 0.5 : score, aborted: this.aborted };
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number): void {
    woodBackground(g, w, h);
    const laneW = 90;
    const left = w / 2 - laneW * 2;
    const hitY = h - 70;
    for (let l = 0; l < 4; l++) {
      const x = left + l * laneW;
      g.fillStyle = `rgba(0,0,0,${0.35 + this.flash[l] * 0.2})`;
      g.fillRect(x + 4, 16, laneW - 8, h - 32);
      if (this.flash[l] > 0) {
        g.fillStyle = `rgba(217,178,74,${this.flash[l] * 0.25})`;
        g.fillRect(x + 4, 16, laneW - 8, h - 32);
      }
      centerText(g, LANE_LABELS[l], x + laneW / 2, hitY + 34, 20, FOLK.dim);
    }
    g.strokeStyle = FOLK.gold;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(left, hitY);
    g.lineTo(left + laneW * 4, hitY);
    g.stroke();
    for (const n of this.notes) {
      if (n.state === 'hit') continue;
      const dtn = n.t - this.time;
      if (dtn > TRAVEL || dtn < -0.4) continue;
      const y = hitY - (dtn / TRAVEL) * (hitY - 20);
      const x = left + n.lane * laneW + laneW / 2;
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.fillStyle = n.state === 'miss' ? 'rgba(80,60,50,0.6)' : LANE_COLORS[n.lane];
      g.strokeStyle = n.lane === 2 ? FOLK.ink : FOLK.black;
      g.lineWidth = 3;
      g.fillRect(-15, -15, 30, 30);
      g.strokeRect(-15, -15, 30, 30);
      g.restore();
    }
    centerText(g, this.song.title, w / 2, 34, 22, FOLK.gold);
    if (this.combo > 1) centerText(g, `${this.combo}× v rade`, left - 70, h / 2, 20);
    if (this.feedbackT > 0) centerText(g, this.feedback, left + laneW * 4 + 80, h / 2, 24, this.feedback === 'Pískol si!' ? FOLK.redBright : FOLK.gold);
    if (this.time < LEAD_IN) centerText(g, 'Nadýchni sa…', w / 2, h / 2 - 40, 28);
  }
}

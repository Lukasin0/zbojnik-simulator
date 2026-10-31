import type { AudioManager } from '@/systems/audio-manager';
import type { InputSystem } from '@/systems/input-system';
import { clamp } from '@/utils/math-utils';
import { centerText, FOLK, woodBackground, type Minigame, type MinigameResult } from './minigame';

const ARROWS: { code: string; label: string; pad: number }[] = [
  { code: 'ArrowLeft', label: '←', pad: 14 },
  { code: 'ArrowRight', label: '→', pad: 15 },
  { code: 'ArrowUp', label: '↑', pad: 12 },
  { code: 'ArrowDown', label: '↓', pad: 13 },
];

export interface PakaOptions {
  opponent: string;
  /** ~0.6 (weakling) .. 1.3 (Fero) */
  strength: number;
  mode: 'paka' | 'zapas';
}

/** Arm wrestling in the šenk (and wrestling Uhorčík on Rovná hora). */
export class PakaGame implements Minigame {
  readonly title: string;
  readonly help = 'Búchaj MEDZERNÍK (alebo A na gamepade). Keď sa objaví šípka, stlač ju rýchlo!';
  private p = 0;
  private push = 0;
  private time = 0;
  private surge = 0;
  private surgeCd = 3;
  private crisis: (typeof ARROWS)[number] | null = null;
  private crisisT = 0;
  private nextCrisis = 3.2;
  private done = false;
  private won = false;
  private aborted = false;
  private msg = '';
  private msgT = 0;

  constructor(
    private readonly o: PakaOptions,
    private readonly audio: AudioManager,
  ) {
    this.title = o.mode === 'paka' ? `Páka s ${o.opponent}` : `Zápasenie s ${o.opponent}`;
  }

  update(dt: number, input: InputSystem): boolean {
    if (input.codePressed('Escape')) {
      this.aborted = true;
      return true;
    }
    if (this.done) return true;
    this.time += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    if (input.codePressed('Space') || input.padButtonPressed(0)) {
      this.push = Math.min(2, this.push + 0.3);
      if (Math.random() < 0.3) this.audio.play('ui', { pitch: 0.6 + Math.random() * 0.2, volume: 0.4 });
    }
    this.push *= Math.exp(-2.1 * dt);

    this.surgeCd -= dt;
    if (this.surgeCd <= 0 && this.surge <= 0) {
      this.surge = 0.9;
      this.surgeCd = 3 + Math.random() * 3;
      this.say(`${this.o.opponent} zaberá!`);
    }
    this.surge = Math.max(0, this.surge - dt);
    const opp = this.o.strength * (0.55 + 0.15 * Math.sin(this.time * 1.7) + (this.surge > 0 ? 0.4 : 0));

    // crisis arrow
    this.nextCrisis -= dt;
    if (!this.crisis && this.nextCrisis <= 0) {
      this.crisis = ARROWS[Math.floor(Math.random() * ARROWS.length)];
      this.crisisT = 0.95;
    }
    if (this.crisis) {
      this.crisisT -= dt;
      const ok = input.codePressed(this.crisis.code) || input.padButtonPressed(this.crisis.pad);
      const wrong = ARROWS.some((a) => a !== this.crisis && input.codePressed(a.code));
      if (ok) {
        this.p += 0.2;
        this.say('Chlapsky!');
        this.audio.play('hit', { volume: 0.5 });
        this.crisis = null;
        this.nextCrisis = 2.5 + Math.random() * 2;
      } else if (wrong || this.crisisT <= 0) {
        this.p -= 0.14;
        this.say('Ruka sa šmykla!');
        this.crisis = null;
        this.nextCrisis = 2.5 + Math.random() * 2;
      }
    }

    this.p = clamp(this.p + (this.push - opp) * 0.7 * dt, -1, 1);
    if (this.p >= 1 || this.p <= -1 || this.time > 28) {
      this.done = true;
      this.won = this.p > 0;
    }
    return this.done;
  }

  private say(t: string): void {
    this.msg = t;
    this.msgT = 1;
  }

  result(): MinigameResult {
    return { won: this.won && !this.aborted, score: (this.p + 1) / 2, aborted: this.aborted };
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number): void {
    woodBackground(g, w, h);
    const cx = w / 2;
    const cy = h * 0.62;
    // table
    g.fillStyle = '#5a3d27';
    g.fillRect(40, cy + 20, w - 80, 26);
    g.fillStyle = '#4a3220';
    g.fillRect(40, cy + 46, w - 80, 10);
    // forearms meeting at the elbows on the table
    const angle = (-this.p * Math.PI) / 2.6;
    const handX = cx + Math.sin(angle) * 130;
    const handY = cy + 10 - Math.cos(angle) * 130;
    const arm = (ex: number, color: string, sleeve: string): void => {
      g.lineCap = 'round';
      g.strokeStyle = sleeve;
      g.lineWidth = 46;
      g.beginPath();
      g.moveTo(ex - (ex < cx ? 120 : -120), cy + 30);
      g.lineTo(ex, cy + 14);
      g.stroke();
      g.strokeStyle = color;
      g.lineWidth = 30;
      g.beginPath();
      g.moveTo(ex, cy + 14);
      g.lineTo(handX, handY);
      g.stroke();
    };
    arm(cx - 60, '#d9a988', '#ece3d0');
    arm(cx + 60, '#c48e6c', this.o.mode === 'paka' ? '#8f2a22' : '#6b4a2f');
    g.fillStyle = '#d0a080';
    g.beginPath();
    g.arc(handX, handY, 26, 0, Math.PI * 2);
    g.fill();

    // balance bar
    const bw = w - 160;
    g.fillStyle = FOLK.black;
    g.fillRect(80, 40, bw, 16);
    g.fillStyle = FOLK.redBright;
    g.fillRect(80 + bw / 2, 40, (this.p * bw) / 2, 16);
    g.fillStyle = FOLK.gold;
    g.fillRect(80 + bw / 2 - 1, 34, 2, 28);
    centerText(g, 'Ty', 60, 48, 18);
    centerText(g, this.o.opponent, w - 50, 48, 16);

    if (this.crisis) {
      centerText(g, this.crisis.label, cx, 110, 64, FOLK.gold);
      g.fillStyle = FOLK.gold;
      g.fillRect(cx - 40, 150, 80 * Math.max(0, this.crisisT / 0.95), 5);
    }
    if (this.msgT > 0) centerText(g, this.msg, cx, h - 26, 22, FOLK.ink);
    if (this.done) centerText(g, this.won ? 'Vyhral si!' : 'Prehral si…', cx, 150, 44, this.won ? FOLK.gold : FOLK.redBright);
  }
}

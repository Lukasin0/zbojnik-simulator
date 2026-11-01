import type { AudioManager } from '@/systems/audio-manager';
import type { InputSystem } from '@/systems/input-system';
import { centerText, FOLK, woodBackground, type Minigame, type MinigameResult } from './minigame';

const STEPS = ['Uvoľniť šnúrku', 'Nadvihnúť mešec', 'Vytiahnuť ho'] as const;

/**
 * Vreckovanie: a needle swings across the bar – press SPACE while it is in the
 * golden zone. Three clean moves lift the purse; every slip makes the victim twitch.
 */
export class PickpocketGame implements Minigame {
  readonly title = 'Vreckovanie – mešec výbercu';
  readonly help = 'MEDZERNÍK (alebo A), keď je ručička v zlatom poli. Tri čisté pohyby – a mešec je tvoj.';
  private step = 0;
  private needle = 0;
  private dir = 1;
  private zone = 0.5;
  private attention = 0;
  private done = false;
  private won = false;
  private aborted = false;
  private msg = '';
  private msgT = 0;
  private flash = 0;

  constructor(private readonly audio: AudioManager) {
    this.placeZone();
  }

  private get zoneWidth(): number {
    return 0.2 - this.step * 0.045;
  }

  private get speed(): number {
    return 0.75 + this.step * 0.35;
  }

  private placeZone(): void {
    this.zone = 0.2 + Math.random() * 0.6;
  }

  update(dt: number, input: InputSystem): boolean {
    if (input.codePressed('Escape')) {
      this.aborted = true;
      return true;
    }
    if (this.done) return true;
    this.msgT = Math.max(0, this.msgT - dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    // the victim slowly gets restless anyway
    this.attention += dt * 0.035;
    this.needle += this.dir * this.speed * dt;
    if (this.needle > 1) {
      this.needle = 1;
      this.dir = -1;
    } else if (this.needle < 0) {
      this.needle = 0;
      this.dir = 1;
    }
    if (input.codePressed('Space') || input.padButtonPressed(0)) {
      if (Math.abs(this.needle - this.zone) < this.zoneWidth / 2) {
        this.step++;
        this.audio.play('coin', { volume: 0.35, pitch: 1.3 + this.step * 0.1 });
        this.say(['Šnúrka povolila…', 'Mešec je v dlani…', 'Mám ho!'][this.step - 1]);
        if (this.step >= STEPS.length) {
          this.done = true;
          this.won = true;
        } else {
          this.placeZone();
        }
      } else {
        this.attention += 0.4;
        this.flash = 1;
        this.audio.play('miss', { volume: 0.5 });
        this.say('Výberca sa zamrvil…');
      }
    }
    if (this.attention >= 1) {
      this.done = true;
      this.won = false;
    }
    return this.done;
  }

  private say(t: string): void {
    this.msg = t;
    this.msgT = 1.2;
  }

  result(): MinigameResult {
    return { won: this.won && !this.aborted, score: this.step / STEPS.length, aborted: this.aborted };
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number): void {
    woodBackground(g, w, h);
    const cx = w / 2;
    // the výberca's broad red back and the purse on his belt
    g.fillStyle = '#6a1f1a';
    g.beginPath();
    g.ellipse(cx, h * 0.62, 150, 120, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1412';
    g.fillRect(cx - 150, h * 0.62 + 20, 300, 22);
    const lift = this.step * 14;
    g.fillStyle = '#8a6a3a';
    g.beginPath();
    g.ellipse(cx + 60, h * 0.62 + 58 - lift, 26, 32, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = FOLK.gold;
    g.beginPath();
    g.arc(cx + 60, h * 0.62 + 34 - lift, 6, 0, Math.PI * 2);
    g.fill();

    // timing bar
    const bx = 80;
    const bw = w - 160;
    const by = 70;
    g.fillStyle = FOLK.black;
    g.fillRect(bx, by, bw, 22);
    g.fillStyle = FOLK.gold;
    g.fillRect(bx + (this.zone - this.zoneWidth / 2) * bw, by, this.zoneWidth * bw, 22);
    g.fillStyle = FOLK.ink;
    g.fillRect(bx + this.needle * bw - 2, by - 8, 4, 38);
    centerText(g, STEPS[Math.min(this.step, STEPS.length - 1)], cx, by - 26, 22, FOLK.ink);

    // victim's attention
    g.fillStyle = FOLK.black;
    g.fillRect(bx, by + 44, bw, 8);
    g.fillStyle = this.flash > 0 ? '#ff6a4a' : FOLK.redBright;
    g.fillRect(bx, by + 44, Math.min(1, this.attention) * bw, 8);
    centerText(g, 'Pozornosť výbercu', cx, by + 66, 14, FOLK.dim);

    if (this.msgT > 0) centerText(g, this.msg, cx, h - 30, 22, FOLK.ink);
    if (this.done) centerText(g, this.won ? 'Mešec je tvoj!' : 'Zlodej! Zlodej!', cx, h * 0.35, 44, this.won ? FOLK.gold : FOLK.redBright);
  }
}

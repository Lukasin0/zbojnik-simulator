import type { Game } from '@/core/game';
import type { GameState } from '@/core/scene-manager';
import type { Minigame, MinigameResult } from '@/minigames/minigame';
import { el } from '@/ui/button';

/** Full-screen canvas minigame (fujara, páka, halušky); the world keeps rendering behind it. */
export class MinigameScene implements GameState {
  readonly name = 'minigame';
  readonly blocksUpdate = true;
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly help: HTMLParagraphElement;
  private finished = false;
  private finishDelay = 0;

  constructor(
    private readonly game: Game,
    private readonly mg: Minigame,
    private readonly onDone: (r: MinigameResult) => void,
  ) {
    this.root = el('div', 'minigame interactive');
    const panel = el('div', 'panel');
    const title = el('h2');
    title.textContent = mg.title;
    this.canvas = el('canvas');
    this.canvas.width = 640;
    this.canvas.height = 400;
    this.ctx = this.canvas.getContext('2d');
    this.help = el('p', 'help');
    panel.append(title, this.canvas, this.help);
    this.root.appendChild(panel);
  }

  enter(): void {
    this.game.uiRoot.appendChild(this.root);
    this.game.hud.setPrompt(null);
  }

  exit(): void {
    this.root.remove();
  }

  update(dt: number): void {
    if (this.finished) {
      this.finishDelay -= dt;
      if (this.finishDelay <= 0) {
        this.game.scenes.pop();
        this.onDone(this.mg.result());
        if (this.game.scenes.top?.name === 'play') this.game.input.requestPointerLock();
      }
      return;
    }
    if (this.mg.update(dt, this.game.input)) {
      this.finished = true;
      this.finishDelay = this.mg.result().aborted ? 0 : 1.1;
    }
  }

  render(): void {
    if (this.ctx) this.mg.draw(this.ctx, this.canvas.width, this.canvas.height);
    if (this.help.textContent !== this.mg.help) this.help.textContent = this.mg.help;
  }
}

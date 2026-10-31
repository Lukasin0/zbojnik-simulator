import type { Game } from '@/core/game';
import type { GameState } from '@/core/scene-manager';
import { formatTime } from '@/utils/math-utils';
import { createControlsPanel, createInfoScreen, createPauseMenu, createSettingsPanel } from '@/ui/menu';
import { OverlayScene } from './overlay-scene';

/** Main gameplay state. */
export class GameScene implements GameState {
  readonly name = 'play';
  readonly blocksUpdate = true;
  private wasLocked = false;

  constructor(
    private readonly game: Game,
    private readonly toMenu: () => void,
  ) {}

  enter(): void {
    const g = this.game;
    g.input.lockOnClick = true;
    g.onPlayerDown = (lost) => this.showDeath(lost);
    g.onPrologueEnd = () => this.showPrologueEnd();
  }

  exit(): void {
    this.game.input.lockOnClick = false;
    this.game.onPlayerDown = null;
    this.game.onPrologueEnd = null;
  }

  update(dt: number): void {
    const g = this.game;
    const isTop = g.scenes.top === this;
    g.input.lockOnClick = isTop;
    if (isTop) {
      // browsers swallow the Esc that releases pointer lock – treat losing the lock as "pause"
      const lostLock = this.wasLocked && !g.input.pointerLocked;
      if (g.input.justPressed('pause') || lostLock) {
        this.wasLocked = false;
        this.pause();
        return;
      }
      this.wasLocked = g.input.pointerLocked;
    } else {
      this.wasLocked = false;
    }
    g.update(dt);
  }

  render(alpha: number, frameDt: number): void {
    this.game.render(alpha, frameDt);
  }

  private overlay(name: string, el: HTMLElement, closable: boolean): OverlayScene {
    const g = this.game;
    const scene = new OverlayScene(name, g.uiRoot, el, g.input, closable ? () => g.scenes.pop() : null);
    g.scenes.push(scene);
    return scene;
  }

  pause(): void {
    const g = this.game;
    g.input.exitPointerLock();
    g.hud.setPrompt(null);
    const resume = (): void => {
      g.scenes.popTo('play');
      g.input.requestPointerLock();
    };
    const menu = createPauseMenu({
      onResume: resume,
      onSave: () => {
        if (g.saves.save(g.snapshot())) g.toast('Hra uložená.', 'good');
      },
      onExport: () => g.saves.exportBase64(g.snapshot()),
      onSettings: () => this.overlay('settings', createSettingsPanel(g.audio, g.app, () => g.scenes.pop()), true),
      onControls: () => this.overlay('controls', createControlsPanel(() => g.scenes.pop()), true),
      onMenu: () => {
        g.saves.save(g.snapshot());
        this.toMenu();
      },
    });
    g.scenes.push(new OverlayScene('pause', g.uiRoot, menu, g.input, resume));
  }

  private showDeath(lost: number): void {
    const g = this.game;
    g.input.exitPointerLock();
    const screen = createInfoScreen(
      'Drábi ťa zbili do bezvedomia…',
      lost > 0
        ? `Prebudil si sa na Rovnej hore. Z mešca ti zmizlo ${lost} dukátov – škoda, že neboli u brata Jána.`
        : 'Prebudil si sa na Rovnej hore s boľavou hlavou. Aspoň mešec bol prázdny.',
      [],
      [
        {
          label: 'Vstať a ísť ďalej',
          primary: true,
          fn: () =>
            g.scenes.transition(() => {
              g.scenes.popTo('play');
              g.respawn(lost);
            }),
        },
      ],
    );
    this.overlay('death', screen, false);
  }

  private showPrologueEnd(): void {
    const g = this.game;
    g.input.exitPointerLock();
    const s = g.data.stats;
    const screen = createInfoScreen(
      'Kapitán Liptova',
      'Prísaha zložená, družina naverbovaná, prvý koč vyžmýkaný a chudoba sa po rokoch najedla do sýta. Legenda o Jánošíkovi sa práve začína… Hra pokračuje voľným režimom – pýtaj si u bača typy na ďalšie koče.',
      [
        ['Prepadnuté koče', String(s.coachesRobbed)],
        ['Porazení pandúri', String(s.pandursBeaten)],
        ['Rozdané chudobe', `${s.givenToPoor} d`],
        ['Ukryté u Jána', `${g.data.stash} d`],
        ['Reputácia', String(g.data.reputation)],
        ['Čas hry', formatTime(s.playTime)],
      ],
      [
        {
          label: 'Pokračovať vo voľnej hre',
          primary: true,
          fn: () => {
            g.scenes.popTo('play');
            g.input.requestPointerLock();
          },
        },
      ],
    );
    this.overlay('prologue', screen, false);
  }
}

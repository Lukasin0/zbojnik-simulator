import type { Game } from '@/core/game';
import type { GameState } from '@/core/scene-manager';
import { createNewSave } from '@/systems/save-manager';
import type { SaveData } from '@/types/game-types';
import { createControlsPanel, createImportPanel, createMainMenu, createSettingsPanel } from '@/ui/menu';
import { GameScene } from './game-scene';
import { OverlayScene } from './overlay-scene';

/** Title screen with a slow cinematic orbit over Rovná hora behind it. */
export class MenuScene implements GameState {
  readonly name = 'menu';
  readonly blocksUpdate = true;
  private root: HTMLDivElement | null = null;

  constructor(private readonly game: Game) {}

  enter(): void {
    const g = this.game;
    g.stop();
    g.audio.setMusicMode('explore');
    this.root = createMainMenu(g.assets.image('janosik'), {
      canContinue: g.saves.hasSave(),
      onNew: () => {
        if (g.saves.hasSave() && !window.confirm('Začať novú hru? Doterajšie uloženie sa prepíše.')) return;
        g.saves.clear();
        this.startGame(createNewSave());
      },
      onContinue: () => {
        const data = g.saves.load();
        this.startGame(data ?? createNewSave());
      },
      onSettings: () => this.overlay('settings', createSettingsPanel(g.audio, g.app, () => g.scenes.pop())),
      onControls: () => this.overlay('controls', createControlsPanel(() => g.scenes.pop())),
      onImport: () =>
        this.overlay(
          'import',
          createImportPanel(
            (code) => {
              const data = g.saves.importBase64(code);
              if (!data) return false;
              g.saves.save(data);
              this.startGame(data);
              return true;
            },
            () => g.scenes.pop(),
          ),
        ),
    });
    g.uiRoot.appendChild(this.root);
  }

  exit(): void {
    this.root?.remove();
    this.root = null;
  }

  private overlay(name: string, el: HTMLElement): void {
    const g = this.game;
    g.scenes.push(new OverlayScene(name, g.uiRoot, el, g.input, () => g.scenes.pop()));
  }

  private startGame(data: SaveData): void {
    const g = this.game;
    g.scenes.transition(() => {
      g.scenes.replaceAll(
        new GameScene(g, () => {
          g.scenes.transition(() => g.scenes.replaceAll(new MenuScene(g)));
        }),
      );
      g.start(data);
      g.saves.save(g.snapshot());
    });
  }

  render(_alpha: number, frameDt: number): void {
    this.game.renderMenu(frameDt);
    this.game.audio.update(this.game.app.camera.position, 0);
  }
}

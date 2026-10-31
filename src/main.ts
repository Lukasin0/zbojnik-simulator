import '@/ui/styles.css';
import { App } from '@/core/app';
import { Game } from '@/core/game';
import { GameLoop } from '@/core/game-loop';
import { preloadAssets } from '@/core/preloader';
import { SceneManager } from '@/core/scene-manager';
import { MenuScene } from '@/scenes/menu-scene';
import { AudioManager } from '@/systems/audio-manager';
import { InputSystem } from '@/systems/input-system';
import { SaveManager } from '@/systems/save-manager';
import { setButtonSound } from '@/ui/button';

async function boot(): Promise<void> {
  const container = document.getElementById('game');
  const uiRoot = document.getElementById('ui');
  const loading = document.getElementById('loading');
  if (!container || !uiRoot || !loading) throw new Error('Chýba #game / #ui / #loading');
  const fill = loading.querySelector<HTMLDivElement>('.loading-fill');
  const status = loading.querySelector<HTMLParagraphElement>('.loading-status');
  const setProgress = (p: number, label: string): void => {
    if (fill) fill.style.width = `${Math.round(p * 100)}%`;
    if (status) status.textContent = label;
  };

  const assets = await preloadAssets((p, label) => setProgress(p * 0.6, label));
  setProgress(0.7, 'Staviam Liptov…');
  // give the browser a frame to paint the progress before the heavy world build
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const app = new App(container);
  const input = new InputSystem(app.renderer.domElement);
  const audio = new AudioManager();
  setButtonSound(() => audio.play('ui'));
  const saves = new SaveManager();
  const scenes = new SceneManager(uiRoot);
  const game = new Game(app, input, audio, saves, scenes, assets, uiRoot);

  const loop = new GameLoop(
    (dt) => {
      scenes.update(dt);
      input.endTick();
    },
    (alpha, frameDt) => {
      input.pollGamepad();
      scenes.render(alpha, frameDt);
      app.render(frameDt);
    },
  );

  scenes.push(new MenuScene(game));
  loop.start();
  setProgress(1, 'Hotovo');

  window.addEventListener('beforeunload', () => {
    if (game.playing) saves.save(game.snapshot());
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.playing) saves.save(game.snapshot());
  });

  if (import.meta.env.DEV) {
    const { installDebugTools } = await import('@/debug/debug-tools');
    installDebugTools(game, loop);
  }

  window.setTimeout(() => loading.classList.add('done'), 200);
  window.setTimeout(() => loading.remove(), 900);
}

boot().catch((err: unknown) => {
  console.error(err);
  const status = document.querySelector('.loading-status');
  if (status) status.textContent = `Chyba pri spúšťaní: ${err instanceof Error ? err.message : String(err)}`;
});

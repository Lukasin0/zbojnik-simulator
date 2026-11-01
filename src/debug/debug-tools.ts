import type { Game } from '@/core/game';
import type { GameLoop } from '@/core/game-loop';
import { LOC } from '@/config/constants';
import { QUEST_STEPS } from '@/systems/quest-system';
import type { WeatherKind } from '@/world/weather';
import type { AttackAnim } from '@/entities/attacks';
import type { QuestStepId } from '@/types/game-types';

interface DebugCommands {
  god(on?: boolean): string;
  money(n?: number): string;
  skip(): string;
  coach(): string;
  tp(place: keyof typeof LOC): string;
  at(x: number, z: number): string;
  heal(): string;
  look(yaw: number, pitch?: number): string;
  time(hours: number, speed?: number): string;
  weather(kind: WeatherKind): string;
  pose(kind: AttackAnim | null, t?: number): string;
  face(yaw: number): string;
  state(): unknown;
  pools(): unknown;
  npcs(): unknown;
  town(): unknown;
  step(id: QuestStepId): string;
  disguise(on: boolean): string;
  halt(on: boolean): string;
}

declare global {
  interface Window {
    zbojnik?: DebugCommands;
  }
}

/**
 * Developer helpers: FPS / perf overlay (F3) and console commands under `window.zbojnik`.
 * Only installed in dev builds.
 */
export function installDebugTools(game: Game, loop: GameLoop): void {
  const overlay = document.createElement('div');
  overlay.className = 'debug';
  overlay.style.display = 'none';
  document.body.appendChild(overlay);
  let visible = false;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      visible = !visible;
      overlay.style.display = visible ? 'block' : 'none';
    }
  });

  const tick = (): void => {
    if (visible) {
      const r = game.app.renderer.info;
      const p = game.player.position;
      overlay.textContent =
        `FPS ${loop.fps}\n` +
        `draw calls ${r.render.calls}  tris ${(r.render.triangles / 1000).toFixed(0)}k\n` +
        `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n` +
        `quest ${game.data.questStep} (${game.data.questCounter})\n` +
        `particles ${game.particles.stats.active}  enemies ${game.ambush.escorts.length}\n` +
        `scene ${game.scenes.top?.name ?? '-'}`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  window.zbojnik = {
    god(on = !game.player.godMode) {
      game.player.godMode = on;
      return `god mode ${on ? 'ON' : 'OFF'}`;
    },
    money(n = 100) {
      game.data.dukaty += n;
      return `dukáty: ${game.data.dukaty}`;
    },
    skip() {
      const idx = QUEST_STEPS.findIndex((s) => s.id === game.data.questStep);
      game.quests.advance(QUEST_STEPS[idx].id);
      return `quest → ${game.data.questStep}`;
    },
    coach() {
      return game.spawnFreeCoach();
    },
    tp(place) {
      const l = LOC[place];
      if (typeof l === 'number') return 'neznáme miesto';
      game.player.teleport(l.x + 3, l.z + 3, game.world);
      return `teleport → ${place}`;
    },
    at(x, z) {
      game.player.teleport(x, z, game.world);
      return `teleport → ${x} ${z}`;
    },
    heal() {
      game.player.heal(999);
      return 'zdravie plné';
    },
    look(yaw, pitch = game.cameraCtl.pitch) {
      game.cameraCtl.yaw = yaw;
      game.cameraCtl.pitch = pitch;
      return `camera yaw ${yaw}`;
    },
    time(hours, speed) {
      game.dayNight.setTime(hours);
      if (speed !== undefined) game.dayNight.speed = speed;
      return `čas ${game.dayNight.clock()}`;
    },
    weather(kind) {
      game.weather.set(kind);
      return `počasie → ${kind}`;
    },
    pose(kind, t = 0.5) {
      game.debugPose = kind ? { kind, t } : null;
      return kind ? `póza ${kind} @ ${t}` : 'póza vypnutá';
    },
    face(yaw) {
      game.player.facing = yaw;
      game.player.beginTick();
      return `natočenie ${yaw}`;
    },
    state() {
      return game.snapshot();
    },
    pools() {
      return { particles: game.particles.stats };
    },
    npcs() {
      return [...game.npcs.values()].map((n) => ({
        id: n.id,
        visible: n.model.root.visible,
        asleep: n.asleep,
        x: Math.round(n.position.x * 10) / 10,
        z: Math.round(n.position.z * 10) / 10,
        facing: Math.round(n.facing * 100) / 100,
      }));
    },
    town() {
      return {
        alarm: game.town.alarm,
        disguised: game.disguised,
        step: game.data.questStep,
        guards: game.town.guards.map((g) => ({ hp: Math.round(g.hp), state: g.state, x: Math.round(g.position.x), z: Math.round(g.position.z) })),
      };
    },
    step(id) {
      game.data.questStep = id;
      game.data.questCounter = 0;
      return `quest → ${id}`;
    },
    halt(on) {
      const v = game.npcs.get('vyberca');
      if (v) v.halted = on;
      return `výberca ${on ? 'stojí' : 'chodí'}`;
    },
    disguise(on) {
      game.data.flags.hasDisguise = true;
      game.setDisguise(on);
      return `prestrojenie ${on ? 'ON' : 'OFF'}`;
    },
  };
  console.info('%cZbojník debug: F3 = overlay, window.zbojnik.{god, money, skip, coach, tp, heal, look, time, weather, state, pools}', 'color:#d9b24a');
}

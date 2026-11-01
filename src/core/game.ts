import * as THREE from 'three';
import {
  COMPANION_TUNING,
  ECONOMY,
  ITEMS,
  LOC,
  PANDUR_TUNING,
  PLAYER_TUNING,
  ROAD_END_X,
  ROAD_START_X,
} from '@/config/constants';
import type { App } from './app';
import type { AssetStore } from './preloader';
import type { SceneManager } from './scene-manager';
import { PlayerInputHandler } from '@/components/input-handler';
import type { CharacterLook } from '@/components/character-model';
import type { Actor } from '@/entities/actor';
import { Companion } from '@/entities/companion';
import type { Pandur } from '@/entities/enemy';
import { DISGUISE, GAJDOSIK, ILCIK, UHORCIK } from '@/entities/looks';
import type { Npc } from '@/entities/npc';
import { Player, type PlayerHooks } from '@/entities/player';
import { DEFAULT_SONG, FujaraGame } from '@/minigames/fujara';
import type { Minigame, MinigameResult } from '@/minigames/minigame';
import { DialogScene } from '@/scenes/dialog-scene';
import { MinigameScene } from '@/scenes/minigame-scene';
import { AmbushSystem } from '@/systems/ambush-system';
import type { AudioManager, SfxId } from '@/systems/audio-manager';
import { CameraController } from '@/systems/camera-controller';
import { CombatSystem } from '@/systems/combat-system';
import type { InputSystem } from '@/systems/input-system';
import { ParticleSystem } from '@/systems/particle-system';
import { CHAPTER_TITLES, QuestSystem, type QuestStepDef } from '@/systems/quest-system';
import { createNewSave, type SaveManager } from '@/systems/save-manager';
import { createInteractables, createNpcs, type Interactable } from '@/story/dialogs';
import type { GameEvents, ToastKind } from '@/types/events';
import type { CompanionId, ItemId, NpcId, SaveData } from '@/types/game-types';
import { DialogBox, type DialogNode } from '@/ui/dialog';
import { Hud, type MapMarker } from '@/ui/hud';
import { EventEmitter } from '@/utils/event-emitter';
import { angleDiff, mulberry32, pick } from '@/utils/math-utils';
import { TOWN_RADIUS, TownSystem } from '@/systems/town-system';
import { Scheduler } from '@/utils/timer';
import { World } from '@/world/world';
import { DayNight } from '@/world/day-night';
import { Weather } from '@/world/weather';
import { WeaponTrail } from '@/systems/weapon-trail';
import type { AttackDef } from '@/entities/attacks';
import {
  AFTER_FIGHT,
  BANTER,
  BANTER_HURT,
  BANTER_MUD,
  BANTER_NIGHT,
  BANTER_RAIN,
  HOUR_NAMES,
  KRAMAR_GRUMBLE,
  PANDUR_DOWN,
  PONOCNY_CALL,
  VYBERCA_TAX,
  VILLAGER_DANCE,
  VILLAGER_LAUGH,
  VILLAGER_WAVE,
  line,
} from '@/story/lines';

export type EmoteId = 'wave' | 'odzemok' | 'hej' | 'laugh' | 'sit';

export const EMOTES: { id: EmoteId; name: string }[] = [
  { id: 'wave', name: 'Mávanie' },
  { id: 'odzemok', name: 'Odzemok' },
  { id: 'hej', name: 'Hej-hou!' },
  { id: 'laugh', name: 'Smiech' },
  { id: 'sit', name: 'Sadnúť si' },
];

export const COMPANION_DEFS: Record<CompanionId, { name: string; look: CharacterLook; slot: { side: number; back: number } }> = {
  uhorcik: { name: 'Uhorčík', look: UHORCIK, slot: { side: -1.7, back: 2.2 } },
  ilcik: { name: 'Ilčík', look: ILCIK, slot: { side: 1.7, back: 2.2 } },
  gajdosik: { name: 'Gajdošík', look: GAJDOSIK, slot: { side: 0, back: 3.8 } },
};

const NOBLES = [
  'zeman Mastnobruchý z Hrádku',
  'gróf Pivnicový z Likavy',
  'barón Dukátik z Okoličného',
  'pani grófka Perinková',
  'slúžny Hrabivý',
];

/** Which vendor grumbles after the výberca's stop i on his round (null = empty stall). */
const VENDOR_AT_STOP: (NpcId | null)[] = ['kramar1', 'kramar2', 'kramar3', null, 'kramar4', null];

const tmpV = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Central gameplay orchestrator: owns the world, actors, systems and the save state. */
export class Game {
  readonly events = new EventEmitter<GameEvents>();
  readonly world: World;
  readonly particles: ParticleSystem;
  readonly cameraCtl: CameraController;
  readonly combat = new CombatSystem();
  readonly ambush: AmbushSystem;
  readonly town: TownSystem;
  readonly player: Player;
  readonly companions: Companion[] = [];
  readonly npcs = new Map<NpcId, Npc>();
  readonly hud: Hud;
  readonly quests: QuestSystem;
  readonly scheduler = new Scheduler();
  readonly dayNight = new DayNight();
  readonly dialogBox: DialogBox;
  readonly rng = mulberry32(Date.now() & 0xffff);
  data: SaveData = createNewSave();
  time = 0;
  playing = false;
  tipReadyAt = 0;
  fieldReadyAt = 0;
  haluskyUntil = 0;
  /** Freeze-frame timer after a solid melee hit. */
  private hitStop = 0;
  private emoteMenu = false;
  private odzemokReadyAt = 0;
  private banterTimer = 35;
  /** Last full hour the ponocný called out. */
  private calledHour = -1;
  /** Ponocný's lantern – always in the scene so the light count never changes (no shader recompiles). */
  private readonly lantern = new THREE.PointLight(0xffa850, 0, 11, 1.7);
  private readonly trail: WeaponTrail;
  readonly weather: Weather;
  /** Dev tools: freeze the captain in a given attack frame. */
  debugPose: { kind: AttackDef['anim']; t: number } | null = null;
  /** Set by the play scene: show death / prologue-end screens. */
  onPlayerDown: ((lost: number) => void) | null = null;
  onPrologueEnd: (() => void) | null = null;
  private interactables: Interactable[] = [];
  private focused: Interactable | null = null;
  private readonly inputHandler: PlayerInputHandler;
  private readonly marker: THREE.Mesh;
  private burnCd = 0;
  private deathTimer = -1;
  private autosaveTimer = 0;
  private menuTime = 0;
  private readonly playerHooks: PlayerHooks;

  constructor(
    readonly app: App,
    readonly input: InputSystem,
    readonly audio: AudioManager,
    readonly saves: SaveManager,
    readonly scenes: SceneManager,
    readonly assets: AssetStore,
    readonly uiRoot: HTMLElement,
  ) {
    this.world = new World(app.scene);
    this.particles = new ParticleSystem(app.scene);
    this.trail = new WeaponTrail(app.scene);
    this.weather = new Weather(app.scene);
    this.weather.setDropCount(app.preset.rainDrops);
    this.particles.density = app.preset.particleDensity;
    this.world.mist.setEnabled(app.preset.mist);
    app.onQualityChange = (p) => {
      this.particles.density = p.particleDensity;
      this.world.mist.setEnabled(p.mist);
      this.weather.setDropCount(p.rainDrops);
    };
    this.cameraCtl = new CameraController(app.camera, (x, z) => this.world.groundHeight(x, z));
    this.cameraCtl.occluders = this.world.occluders;
    this.ambush = new AmbushSystem(app.scene, this.world);
    this.town = new TownSystem(app.scene, this.world);
    this.combat.addSource(() => this.ambush.escorts);
    this.combat.addSource(() => this.town.guards);
    this.player = new Player(app.scene);
    this.player.onHurt = (_p, amount) => this.onPlayerHurt(amount);
    this.player.teleport(LOC.vatra.x + 5, LOC.vatra.z + 6, this.world);
    this.player.facing = Math.atan2(-5, -6);
    this.inputHandler = new PlayerInputHandler(input);
    this.hud = new Hud(uiRoot, this.world.terrain.renderMinimap(420));
    this.dialogBox = new DialogBox(uiRoot);
    this.quests = new QuestSystem(
      () => this.data.questStep,
      (id, n) => {
        this.data.questStep = id;
        this.data.questCounter = n;
      },
      () => this.data.questCounter,
      (from, to) => this.onQuestAdvance(from, to),
    );

    this.marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd34a, emissive: 0xffa020, emissiveIntensity: 1.4, flatShading: true }),
    );
    app.scene.add(this.marker);
    app.scene.add(this.lantern);

    for (const npc of createNpcs(this)) this.npcs.set(npc.id, npc);
    this.interactables = createInteractables(this);
    const collector = this.npcs.get('vyberca') ?? null;
    this.town.collector = collector;
    if (collector) collector.onRouteStop = (npc, stop) => this.onCollectorStop(npc, stop);
    this.wireWorldProps();
    this.combat.register(this.player);

    this.playerHooks = {
      onSwing: (_p, def) =>
        this.audio.play('swing', {
          pos: this.player.position,
          pitch: def.anim === 'spin' ? 0.6 : def.anim === 'overhead' ? 0.8 : 0.95 + this.rng() * 0.15,
        }),
      onMeleeHit: (p, def) => this.playerMelee(p, def),
      onShoot: (p) => this.playerShoot(p),
      onJump: () => this.sfx('jump'),
      onHurt: () => undefined,
      onNoStamina: () => this.toastOnce('stamina', 'Nemáš dosť síl – oddýchni si chvíľu.', 'bad'),
      onReloading: () => this.toastOnce('reload', 'Kresadlovka sa ešte nabíja…', 'info', 2),
    };

    this.events.on('toast', ({ text, kind }) => this.hud.toast(text, kind));
    this.events.on('combat:start', () => this.audio.setMusicMode('combat'));
    this.events.on('combat:end', () => this.audio.setMusicMode('explore'));
  }

  // ------------------------------------------------------------------ setup

  private wireWorldProps(): void {
    this.world.dummies.forEach((d, i) => {
      this.combat.register(d);
      d.onHit = (pos) => {
        this.sfx('straw', pos);
        this.particles.emit({ x: pos.x, y: pos.y + 1.2, z: pos.z, count: 14, color: [0xd8c26a, 0xb89a40], speed: 3, up: 3, gravity: -9 });
      };
      d.onDestroyed = () => {
        this.data.flags[`dummy${i}`] = true;
        this.toast('Slamený pán padol! Ľud by sa smial.', 'good');
        this.quests.progress('c1_serm');
      };
    });
    this.world.targets.forEach((t, i) => {
      this.combat.register(t);
      t.onDestroyed = () => {
        this.data.flags[`target${i}`] = true;
        this.sfx('hit', t.position);
        this.particles.emit({ x: t.position.x, y: t.position.y + 1.5, z: t.position.z, count: 12, color: [0xece6da, 0xb3261e], speed: 3 });
        this.toast('Zásah do čierneho!', 'good');
        this.quests.progress('c1_strelba');
      };
    });
    const tree = this.world.ambushTree;
    this.combat.register(tree);
    tree.onBlocked = () => this.toastOnce('tree', 'Tento smrek si zatiaľ nechaj – bača vraj s ním má plány.', 'info');
    tree.onChop = (pos, left) => {
      this.sfx('chop', pos);
      this.particles.emit({ x: pos.x, y: pos.y + 1.2, z: pos.z, count: 10, color: [0xc8a070, 0x8a6040], speed: 3, up: 2 });
      if (left > 0) this.toast(`Smrek praská… (${left})`);
    };
    tree.onFallen = () => {
      this.sfx('treeFall', tree.position);
      this.cameraCtl.shake(0.5);
      this.data.flags.treeFallen = true;
      const z = this.world.roadZ(tree.position.x);
      this.particles.emit({ x: tree.position.x, y: tree.position.y + 0.5, z, count: 40, spread: 6, color: [0x8a7a60, 0x6a5a40], speed: 4, up: 2, life: [0.6, 1.4] });
      this.toast('Smrek leží cez hradskú. Koč tadiaľ neprejde!', 'quest');
      this.quests.advance('c3_strom');
    };
  }

  /** Apply a save (new game or loaded) and place everything in the world. */
  start(data: SaveData): void {
    this.data = data;
    this.time = 0;
    this.deathTimer = -1;
    this.haluskyUntil = 0;
    this.ambush.despawn();
    for (const c of this.companions) {
      this.combat.unregister(c);
      c.dispose();
    }
    this.companions.length = 0;

    if (this.data.questStep === 'c3_lup') {
      this.data.questStep = 'c3_prepad';
      this.data.questCounter = 0;
    }

    this.dayNight.setTime(this.data.timeOfDay);
    this.weather.reset();
    this.world.setWetness(0);
    const p = this.data.player;
    this.player.teleport(p.x, p.z, this.world);
    this.player.stamina = p.stamina;
    this.player.raz = p.raz;
    this.player.pose = 'normal';
    this.applyEquipment();
    this.player.hp = Math.min(this.player.maxHp, Math.max(1, p.hp));
    this.player.facing = Math.atan2(LOC.vatra.x - p.x, LOC.vatra.z - p.z);

    for (const id of this.data.companions) this.spawnCompanion(id);

    const reachedShooting = this.quests.reached('c1_strelba');
    this.world.dummies.forEach((d, i) => {
      if (reachedShooting || this.data.flags[`dummy${i}`]) d.setDestroyed();
    });
    const reachedWrestle = this.quests.reached('c1_zapas');
    this.world.targets.forEach((t, i) => {
      if (reachedWrestle || this.data.flags[`target${i}`]) t.setDestroyed();
    });
    this.world.ambushTree.setFallen(!!this.data.flags.treeFallen);
    this.world.ambushTree.cuttable = this.data.questStep === 'c3_strom';

    this.refreshNpcVisibility();
    if (this.data.questStep === 'c3_prepad') this.spawnStoryCoach();
    this.town.reset();
    this.setDisguise(!!this.data.flags.disguised && !!this.data.flags.hasDisguise, true);

    this.cameraCtl.snap(this.player.position, this.player.facing);
    this.playing = true;
    this.audio.setMusicMode('explore');
    this.hud.show(true);
    window.setTimeout(() => this.hud.chapterCard(this.quests.chapter, CHAPTER_TITLES[this.quests.chapter] ?? ''), 600);
  }

  stop(): void {
    this.playing = false;
    this.hud.show(false);
    this.setEmoteMenu(false);
    this.audio.setMusicMode('off');
    this.audio.setAmbience(0, 0);
    this.weather.reset();
    this.world.setWetness(0);
    this.input.exitPointerLock();
  }

  refreshNpcVisibility(): void {
    for (const id of ['uhorcik', 'ilcik', 'gajdosik'] as const) {
      const npc = this.npcs.get(id);
      if (npc) npc.model.setVisible(!this.data.companions.includes(id));
    }
  }

  // ------------------------------------------------------------------ disguise, town & sleep

  get disguised(): boolean {
    return !!this.data.flags.disguised;
  }

  /** Any fight going on – a coach escort or the Mikuláš guards. */
  get inCombat(): boolean {
    return this.ambush.combatActive || this.town.combatActive;
  }

  setDisguise(on: boolean, silent = false): void {
    if (on && !this.data.flags.hasDisguise) return;
    this.data.flags.disguised = on;
    this.player.model.setDisguise(on, DISGUISE.coat, DISGUISE.cap);
    if (silent) return;
    this.sfx('straw', this.player.position);
    this.toast(on ? 'Handlársky kabát na sebe – teraz si len obyčajný kramár.' : 'Kabát dolu – zas si Jánošík.', 'info');
    this.requestSave();
  }

  /** True when the captain stands behind `who` (outside his field of view). */
  behind(who: Actor): boolean {
    const dx = this.player.position.x - who.position.x;
    const dz = this.player.position.z - who.position.z;
    return Math.abs(angleDiff(who.facing, Math.atan2(dx, dz))) > Math.PI * 0.6;
  }

  raiseTownAlarm(): void {
    this.town.raiseAlarm(this.townContext());
  }

  /** A night in the šenk or the inn: morning, full health and stamina. */
  sleepUntilMorning(): void {
    this.dayNight.setTime(6.5);
    this.player.heal(999);
    this.player.stamina = PLAYER_TUNING.maxStamina;
    this.toast('Vyspal si sa do ružova. Je ráno, kohúty kikiríkajú a pandúri ešte spia.', 'good');
    this.requestSave();
  }

  /** The výberca taxes a stall; the vendor grumbles once he has moved on. */
  private onCollectorStop(npc: Npc, stop: number): void {
    if (npc.position.distanceTo(this.player.position) > 35) return;
    this.bark(npc.model.root, line(VYBERCA_TAX, this.rng), 3.5);
    const vendorId = VENDOR_AT_STOP[stop];
    const vendor = vendorId ? this.npcs.get(vendorId) : null;
    if (vendor) this.scheduler.after(4.5, () => vendor.model.root.visible && this.bark(vendor.model.root, line(KRAMAR_GRUMBLE, this.rng), 3));
  }

  private townContext(): Parameters<TownSystem['update']>[1] {
    return {
      zbojnici: [this.player, ...this.companions],
      disguised: this.disguised,
      violent: this.player.attacking,
      onStrike: (e, t) => this.enemyStrike(e, t),
      onPandurDown: (e) => this.onPandurDown(e),
      onAlarm: () => {
        if (this.disguised) this.setDisguise(false, true);
        this.toast('Pandúri ťa spoznali! Bež z mesta, alebo im ukáž valašku!', 'bad');
        this.events.emit('combat:start', { enemies: this.town.guards.length });
      },
      onCalm: () => {
        this.toast('Pandúri ťa stratili z očí.', 'good');
        this.events.emit('combat:end', { won: false });
      },
      bark: (t, text, s) => this.bark(t, text, s),
      setSuspicion: (v) => this.hud.setSuspicion(v),
    };
  }

  /** Mikuláš quest progress that depends on where the captain is. */
  private updateTownQuest(): void {
    const p = this.player.position;
    const d = Math.hypot(p.x - LOC.mikulas.x, p.z - LOC.mikulas.z);
    if (this.quests.is('c4_cesta') && d < TOWN_RADIUS) {
      if (!this.disguised) this.toastOnce('town-warn', 'Bez prestrojenia ťa tu spoznajú! Stlač H a obleč si kabát.', 'bad', 8);
      this.quests.advance('c4_cesta');
    } else if (this.quests.is('c4_vreckuj') && d < TOWN_RADIUS) {
      const h = this.dayNight.time;
      if (h >= 19 || h < 7) this.toastOnce('fair-closed', 'Jarmok je zatvorený – výberca spí na radnici. Príď ráno, alebo sa vyspi v hostinci.', 'info', 60);
    } else if (this.quests.is('c4_utek') && d > TOWN_RADIUS + 25) {
      this.quests.advance('c4_utek');
    }
  }

  // ------------------------------------------------------------------ economy & items

  get capacity(): number {
    return ECONOMY.baseCapacity + ECONOMY.capacityPerOpasok[this.data.equipment.opasok];
  }

  get charisma(): number {
    return this.data.equipment.klobuk + Math.floor(Math.max(0, this.data.reputation) / 40);
  }

  get roundCost(): number {
    return Math.max(4, ECONOMY.roundCost - this.charisma * 2);
  }

  /** Adds ducats up to the purse capacity; returns how many fit. */
  addDukaty(n: number): number {
    const fit = Math.max(0, Math.min(n, this.capacity - this.data.dukaty));
    this.data.dukaty += fit;
    if (fit > 0) this.sfx('coin');
    if (fit < n) this.toast(`Mešec je plný! ${n - fit} dukátov sa rozkotúľalo do blata. Rozšír si opasok.`, 'bad');
    return fit;
  }

  spend(n: number): boolean {
    if (this.data.dukaty < n) {
      this.toast('Nemáš dosť dukátov.', 'bad');
      return false;
    }
    this.data.dukaty -= n;
    this.sfx('coin', undefined, 0.8);
    this.requestSave();
    return true;
  }

  giveItem(id: ItemId, n = 1): void {
    this.data.inventory[id] += n;
    this.events.emit('item:changed', { item: id, count: this.data.inventory[id] });
  }

  takeItem(id: ItemId, n = 1): boolean {
    if (this.data.inventory[id] < n) return false;
    this.data.inventory[id] -= n;
    this.events.emit('item:changed', { item: id, count: this.data.inventory[id] });
    return true;
  }

  useItem(id: ItemId): void {
    const def = ITEMS[id];
    if (!def.consumable) return;
    if (this.data.inventory[id] <= 0) {
      this.toast(`Nemáš ${def.name.toLowerCase()}.`, 'bad');
      return;
    }
    if (id !== 'halusky' && id !== 'borovicka' && this.player.hp >= this.player.maxHp) {
      this.toast('Si sýty ako bača po Vianociach.');
      return;
    }
    this.takeItem(id);
    this.player.heal(def.heal);
    this.player.raz = Math.min(100, this.player.raz + def.raz);
    if (id === 'halusky') {
      for (const c of this.companions) c.reviveFull();
      this.haluskyUntil = this.time + 120;
      this.toast('Bryndzové halušky! Celá družina je ako znovuzrodená.', 'good');
    }
    this.sfx(id === 'borovicka' ? 'drink' : 'eat');
    this.requestSave();
  }

  applyEquipment(): void {
    const eq = this.data.equipment;
    const ratio = this.player.hp / this.player.maxHp;
    this.player.maxHp = PLAYER_TUNING.baseHp + PLAYER_TUNING.hpPerOpasok * eq.opasok;
    this.player.hp = Math.max(1, Math.round(this.player.maxHp * ratio));
    this.player.model.setBeltLevel(eq.opasok);
    this.player.model.setFeather(eq.klobuk > 0);
    this.player.krpce = eq.krpce > 0;
  }

  // ------------------------------------------------------------------ party

  spawnCompanion(id: CompanionId): Companion {
    const def = COMPANION_DEFS[id];
    const c = new Companion(id, def.name, def.look, this.app.scene, def.slot);
    const fx = Math.sin(this.player.facing);
    const fz = Math.cos(this.player.facing);
    c.teleport(this.player.position.x - fx * def.slot.back - fz * def.slot.side, this.player.position.z - fz * def.slot.back + fx * def.slot.side, this.world);
    c.facing = this.player.facing;
    this.companions.push(c);
    this.combat.register(c);
    return c;
  }

  recruit(id: CompanionId): void {
    if (this.data.companions.includes(id)) return;
    this.data.companions.push(id);
    const npc = this.npcs.get(id);
    const c = this.spawnCompanion(id);
    if (npc) {
      c.teleport(npc.position.x, npc.position.z, this.world);
      npc.model.setVisible(false);
    }
    this.toast(`${COMPANION_DEFS[id].name} sa pridal k družine!`, 'quest');
    this.sfx('quest');
    if (id !== 'uhorcik') this.quests.progress('c2_verbuj');
    this.requestSave();
  }

  // ------------------------------------------------------------------ encounters

  spawnStoryCoach(): void {
    this.ambush.spawn({
      startX: LOC.ambushX - 100,
      dir: 1,
      loot: ECONOMY.storyLoot,
      noble: NOBLES[0],
      story: true,
      escorts: 3,
    });
  }

  spawnFreeCoach(): string {
    const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    const noble = pick(this.rng, NOBLES);
    this.ambush.spawn({
      startX: dir === 1 ? ROAD_START_X + 5 : ROAD_END_X - 5,
      dir,
      loot: Math.round(60 + this.rng() * 100 + Math.max(0, this.data.reputation) / 2),
      noble,
      story: false,
      escorts: this.rng() < 0.5 ? 3 : 4,
    });
    return noble;
  }

  lootCoach(extra: number): number {
    const gained = this.addDukaty(this.ambush.loot + extra);
    this.ambush.markLooted();
    this.data.stats.coachesRobbed++;
    this.data.reputation += 3;
    this.toast(`+${gained} dukátov z panskej truhlice!`, 'good');
    this.quests.advance('c3_lup');
    this.requestSave();
    return gained;
  }

  /** Called when the fujara minigame ends. */
  playFujara(): void {
    if (this.inCombat) {
      this.toast('Teraz nie je čas na muziku!', 'bad');
      return;
    }
    const song = this.assets.fujaraSongs()[0] ?? DEFAULT_SONG;
    this.startMinigame(new FujaraGame(song, this.audio), (r) => {
      if (r.aborted && r.score < 0.05) return;
      const gain = Math.round(10 + r.score * 30);
      this.player.raz = Math.min(100, this.player.raz + gain);
      this.toast(`Fujara pohladila dušu. Ráž +${gain}`, 'good');
      const coach = this.ambush.coach;
      if (!coach) return;
      const logX = this.world.ambushTree.fallen ? this.world.ambushTree.position.x : null;
      const nearCoach = coach.position.distanceTo(this.player.position) < 55;
      const nearLog =
        logX !== null &&
        Math.hypot(this.player.position.x - logX, this.player.position.z - this.world.roadZ(logX)) < 45;
      if (!nearCoach && !nearLog) return;
      if (r.score >= 0.4 && this.ambush.lull()) {
        this.toast('Tklivá melódia sa nesie dolinou… pandúrom oťaželi viečka.', 'quest');
      } else if (r.score < 0.4) {
        this.toast('Pandúri sa len zasmiali nad tvojím pískaním.', 'bad');
      }
    });
  }

  // ------------------------------------------------------------------ UI helpers

  toast(text: string, kind: ToastKind = 'info'): void {
    this.events.emit('toast', { text, kind });
  }

  private toastTimes = new Map<string, number>();

  toastOnce(key: string, text: string, kind: ToastKind = 'info', cooldown = 4): void {
    const last = this.toastTimes.get(key) ?? -999;
    if (this.time - last < cooldown) return;
    this.toastTimes.set(key, this.time);
    this.toast(text, kind);
  }

  sfx(id: SfxId, pos?: THREE.Vector3, pitch?: number): void {
    this.audio.play(id, { pos: pos ? { x: pos.x, y: pos.y + 1, z: pos.z } : undefined, pitch });
  }

  bark(target: THREE.Object3D, text: string, seconds = 2.5): void {
    this.hud.bark(target, text, seconds, this.time);
  }

  openDialog(node: DialogNode): void {
    this.input.exitPointerLock();
    this.scenes.push(new DialogScene(this, node));
  }

  startMinigame(mg: Minigame, onDone: (r: MinigameResult) => void): void {
    this.input.exitPointerLock();
    this.scenes.push(new MinigameScene(this, mg, onDone));
  }

  requestSave(): void {
    if (!this.playing) return;
    this.saves.scheduleSave(() => this.snapshot());
  }

  snapshot(): SaveData {
    const p = this.player;
    this.data.player = {
      x: p.position.x,
      z: p.position.z,
      hp: Math.max(1, Math.round(p.hp)),
      stamina: Math.round(p.stamina),
      raz: Math.round(p.raz),
    };
    this.data.timeOfDay = Math.round(this.dayNight.time * 100) / 100;
    return JSON.parse(JSON.stringify(this.data)) as SaveData;
  }

  // ------------------------------------------------------------------ quest flow

  private onQuestAdvance(from: QuestStepDef, to: QuestStepDef): void {
    this.sfx('quest');
    this.world.ambushTree.cuttable = to.id === 'c3_strom';
    if (to.chapter !== from.chapter) {
      this.events.emit('chapter:start', { chapter: to.chapter, title: CHAPTER_TITLES[to.chapter] ?? '' });
      this.hud.chapterCard(to.chapter, CHAPTER_TITLES[to.chapter] ?? '');
    } else {
      this.toast('Úloha splnená!', 'quest');
    }
    if (to.id === 'c3_prepad') this.spawnStoryCoach();
    if (to.id === 'c3_lup') this.toast('Hliadka leží v blate. Zeman sa trasie v koči!', 'quest');
    if (to.id === 'free') {
      this.data.flags.prologueDone = true;
      window.setTimeout(() => this.onPrologueEnd?.(), 1200);
    }
    this.events.emit('quest:advanced', { from: from.id, to: to.id });
    this.requestSave();
  }

  objectivePosition(): THREE.Vector3 | null {
    const npc = (id: NpcId): THREE.Vector3 | null => this.npcs.get(id)?.position ?? null;
    switch (this.data.questStep) {
      case 'c1_talk':
      case 'c1_zapas':
      case 'c1_prisaha':
        return npc('uhorcik');
      case 'c1_serm':
        return this.world.dummies.find((d) => d.isAlive())?.position ?? null;
      case 'c1_strelba':
        return this.world.targets.find((t) => t.isAlive())?.position ?? null;
      case 'c1_skok':
        return this.world.vatraPos;
      case 'c2_verbuj':
        return tmpV.set(LOC.krcma.x - 10, this.world.groundHeight(LOC.krcma.x - 10, LOC.krcma.z), LOC.krcma.z);
      case 'c2_baca':
        return npc('baca');
      case 'c3_strom':
        return this.world.ambushTree.position;
      case 'c3_prepad':
      case 'c3_lup':
        return this.ambush.coach?.position ?? this.world.ambushTree.position;
      case 'c3_rozdel':
        return npc('katarina');
      case 'c3_ukry':
        return npc('jan');
      case 'c4_tip':
        return npc('krcmar');
      case 'c4_prestroj':
        return npc('gazdina');
      case 'c4_cesta':
        return tmpV.set(LOC.mikulas.x, this.world.groundHeight(LOC.mikulas.x, LOC.mikulas.z), LOC.mikulas.z);
      case 'c4_vreckuj':
        return npc('vyberca');
      case 'c4_utek':
      case 'c4_rozdel':
        return npc('hana');
      case 'free':
        return this.ambush.coach?.position ?? null;
    }
  }

  // ------------------------------------------------------------------ combat callbacks

  private playerMelee(p: Player, def: AttackDef): void {
    const hits = this.combat.melee(p.position, p.facing, def.range, def.arc, p.damage * def.damage, 'zbojnik', 'player', def.knockback);
    let struckEnemy = false;
    for (const h of hits) {
      if (h.faction !== 'pandur') continue;
      struckEnemy = true;
      this.sfx('hit', h.position, def.anim === 'spin' || def.anim === 'overhead' ? 0.75 : 1);
      this.particles.emit({ x: h.position.x, y: h.position.y + 1.2, z: h.position.z, count: def.damage > 1.5 ? 16 : 9, color: [0xffe0a0, 0xffffff], speed: 4 + def.knockback * 0.3, life: [0.2, 0.45] });
    }
    // ground impact of the leap and the whirl – dust ring around the captain
    if (def.anim === 'overhead' || def.anim === 'spin') {
      const g = p.position;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = def.anim === 'spin' ? 1.6 : 1.0;
        const ox = def.anim === 'overhead' ? Math.sin(p.facing) * 1.4 : 0;
        const oz = def.anim === 'overhead' ? Math.cos(p.facing) * 1.4 : 0;
        this.particles.emit({ x: g.x + ox + Math.cos(a) * r, y: g.y + 0.15, z: g.z + oz + Math.sin(a) * r, count: 2, color: [0x8a7a60, 0xa89878], speed: 1.5, up: 1, gravity: -2, life: [0.4, 0.8], size: [0.12, 0.22], grow: 0.25 });
      }
    }
    if (struckEnemy) {
      this.hitStop = def.hitStop;
      this.cameraCtl.shake(def.shake);
    } else if (def.anim === 'spin' || def.anim === 'overhead') {
      this.cameraCtl.shake(def.shake * 0.4);
    }
  }

  private playerShoot(p: Player): void {
    const cam = this.app.camera;
    cam.getWorldDirection(tmpDir);
    p.model.handPosition(tmpV);
    this.sfx('shot', p.position);
    this.cameraCtl.shake(0.25);
    this.particles.emit({ x: tmpV.x, y: tmpV.y, z: tmpV.z, count: 14, color: [0xd8d4cc, 0xa8a49c], speed: 1.2, up: 0.8, gravity: 1, drag: 2, life: [0.6, 1.4], size: [0.1, 0.25], grow: 0.3 });
    this.particles.emit({ x: tmpV.x, y: tmpV.y, z: tmpV.z, count: 6, color: [0xffd060, 0xff8020], speed: 3, dir: { x: tmpDir.x * 4, y: tmpDir.y * 4, z: tmpDir.z * 4 }, life: [0.08, 0.15] });
    const hit = this.combat.raycast(cam.position, tmpDir, PLAYER_TUNING.shootRange + 10, 'zbojnik');
    if (!hit) return;
    tmpV.copy(cam.position).addScaledVector(tmpDir, hit.dist);
    this.particles.emit({ x: tmpV.x, y: tmpV.y, z: tmpV.z, count: 10, color: [0xffe0a0, 0x8a7a60], speed: 3, life: [0.2, 0.5] });
    hit.target.receiveHit(PLAYER_TUNING.shootDamage, p.position, 'shot');
    if (hit.target.faction === 'pandur') this.sfx('hit', hit.target.position);
  }

  private onPlayerHurt(amount: number): void {
    this.sfx('hurt', this.player.position);
    this.app.flashDamage(Math.min(1, amount / 20));
    this.cameraCtl.shake(0.25);
    this.events.emit('player:hurt', { amount });
  }

  private onPandurDown(e: Pandur): void {
    this.data.stats.pandursBeaten++;
    this.sfx('death', e.position);
    if (this.rng() < 0.6) this.bark(e.model.root, line(PANDUR_DOWN, this.rng), 3);
    this.particles.emit({ x: e.position.x, y: e.position.y + 0.3, z: e.position.z, count: 16, color: [0x6a5a40, 0x8a7a60], speed: 2, up: 1.5 });
  }

  private enemyStrike(e: Pandur, target: Actor): void {
    const dmg = PANDUR_TUNING.damage * (e.drowsy > 0 ? 0.6 : 1);
    target.receiveHit(dmg, e.position, 'enemy');
    if (target !== this.player) this.sfx('hit', target.position, 0.8);
  }

  // ------------------------------------------------------------------ update

  update(dt: number): void {
    if (!this.playing) return;
    // freeze-frame after a solid hit: the world holds its breath for a few frames
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.particles.update(dt * 0.15);
      return;
    }
    this.time += dt;
    this.data.stats.playTime += dt;
    this.scheduler.update(dt);
    this.burnCd = Math.max(0, this.burnCd - dt);

    const controllable = this.player.isAlive();
    const intent = this.inputHandler.read(this.cameraCtl.yaw, controllable);
    this.player.damageBonus =
      (this.data.flags.captain ? PLAYER_TUNING.captainBonus : 0) + (this.time < this.haluskyUntil ? 8 : 0);
    this.player.update(dt, intent, this.world, this.playerHooks);

    this.updateVatra();

    const logX = this.world.ambushTree.fallen ? this.world.ambushTree.position.x : null;
    const zbojnici: Actor[] = [this.player, ...this.companions];
    const wasCombat = this.ambush.combatActive;
    this.ambush.update(dt, {
      zbojnici,
      logX,
      onStrike: (e, t) => this.enemyStrike(e, t),
      onPandurDown: (e) => this.onPandurDown(e),
      onAlert: () => {
        this.toast('Pandúri vás zbadali! Do boja!', 'bad');
        this.events.emit('combat:start', { enemies: this.ambush.escorts.length });
      },
      onDefeated: () => {
        this.toast('Panská hliadka je porazená!', 'good');
        const speaker = this.companions.find((c) => c.isAlive());
        if (speaker) this.scheduler.after(2, () => this.bark(speaker.model.root, line(AFTER_FIGHT, this.rng), 4));
        this.events.emit('combat:end', { won: true });
        this.quests.advance('c3_prepad');
      },
      onEscaped: (story) => {
        this.toast('Koč ušiel po hradskej…', 'bad');
        if (story) this.scheduler.after(8, () => this.data.questStep === 'c3_prepad' && !this.ambush.active && this.spawnStoryCoach());
      },
      bark: (t, text, s) => this.bark(t, text, s),
      hearing: 1 - this.weather.rain * 0.35 - this.weather.wind * 0.1,
    });
    if (wasCombat && !this.ambush.combatActive && !this.ambush.defeated) this.events.emit('combat:end', { won: false });

    // a valaška out from under the pedlar's coat gives the game away
    if (this.disguised && this.player.attacking) {
      this.setDisguise(false, true);
      this.toastOnce('disguise-off', 'Valaška spod kabáta – prestrojenie je fuč!', 'bad');
    }
    this.town.update(dt, this.townContext());
    this.updateTownQuest();

    const enemies = [...this.ambush.escorts, ...this.town.guards];
    const fighting = this.inCombat;
    for (const c of this.companions) {
      c.update(dt, {
        world: this.world,
        leader: this.player,
        leaderYaw: this.player.facing,
        enemies,
        combat: fighting,
        onStrike: (comp, target) => {
          target.receiveHit(COMPANION_TUNING.damage * (this.time < this.haluskyUntil ? 1.3 : 1), comp.position, 'companion');
          this.sfx('hit', target.position, 1.1);
        },
      });
    }
    for (const npc of this.npcs.values()) npc.update(dt, this.world, this.player.position, this.dayNight.time);
    this.separateActors();
    this.updatePonocny();

    this.dayNight.update(dt);
    this.weather.update(dt, this.rng);
    this.world.setWetness(this.weather.wetness);
    this.emitRainSplashes();
    this.world.update(dt, this.time);
    this.particles.update(dt);
    this.emitFireParticles();

    this.updateInteraction();
    this.handleHotkeys();
    this.checkDeath(dt);
    this.updateBanter(dt);

    this.autosaveTimer += dt;
    if (this.autosaveTimer > 45) {
      this.autosaveTimer = 0;
      if (!this.inCombat && this.player.isAlive()) this.requestSave();
    }
  }

  private updateVatra(): void {
    const p = this.player.position;
    const v = this.world.vatraPos;
    const d = Math.hypot(p.x - v.x, p.z - v.z);
    if (d > 1.1) return;
    const above = p.y - this.world.groundHeight(p.x, p.z);
    if (above < 0.8) {
      if (this.burnCd <= 0) {
        this.burnCd = 0.7;
        this.player.receiveHit(8, v, 'enemy');
        this.sfx('burn', p);
        this.toast('Au! Pripálil si si gate!', 'bad');
        this.particles.emit({ x: p.x, y: p.y + 0.5, z: p.z, count: 12, color: [0xff8a2a, 0xffd050], speed: 2, up: 3 });
      }
    } else if (d < 0.75 && this.data.questStep === 'c1_skok') {
      this.sfx('quest');
      this.particles.emit({ x: v.x, y: v.y + 2, z: v.z, count: 40, color: [0xffd050, 0xff8a2a, 0xffffff], speed: 5, up: 4 });
      this.toast('Legendárny skok cez vatru! Starí zbojníci by plakali od dojatia.', 'quest');
      this.quests.advance('c1_skok');
    }
  }

  /** Tiny splashes around the captain while it rains. */
  private emitRainSplashes(): void {
    const r = this.weather.rain;
    if (r < 0.15) return;
    const p = this.player.position;
    const count = r * 2.5;
    for (let i = 0; i < count; i++) {
      if (this.rng() > count - i) break;
      const x = p.x + (this.rng() - 0.5) * 18;
      const z = p.z + (this.rng() - 0.5) * 18;
      const y = Math.max(this.world.groundHeight(x, z), -0.9) + 0.03;
      this.particles.emit({ x, y, z, count: 1, spread: 0, speed: 0.6, up: 1.1, gravity: -9, drag: 1, color: [0xdfe8ee, 0xbcc8d0], life: [0.18, 0.3], size: [0.035, 0.06] });
    }
  }

  private emitFireParticles(): void {
    for (const f of this.world.fires) {
      if (f.pos.distanceTo(this.player.position) > 70 || this.rng() > 0.5) continue;
      this.particles.emit({
        x: f.pos.x,
        y: f.pos.y + 0.6 * f.size,
        z: f.pos.z,
        count: 1,
        spread: 0.8 * f.size,
        speed: 0.3,
        up: 2.2 * f.size,
        gravity: 1.5,
        drag: 0.5,
        color: [0xffb040, 0xff6a10, 0xffe080],
        life: [0.5, 1.1],
        size: [0.08 * f.size + 0.04, 0.16 * f.size + 0.04],
      });
    }
  }

  private separateActors(): void {
    const list: Actor[] = [this.player, ...this.companions.filter((c) => c.isAlive())];
    for (const e of this.ambush.escorts) if (e.isAlive() && e.state !== 'sleepy') list.push(e);
    for (const e of this.town.guards) if (e.isAlive()) list.push(e);
    for (const n of this.npcs.values()) if (n.basePose === 'normal' && n.model.root.visible) list.push(n);
    for (let i = 0; i < list.length; i++) {
      const a = list[i].position;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j].position;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = list[i].radius + list[j].radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
    }
    const coach = this.ambush.coach;
    if (coach) {
      const circles: [number, number, number][] = [[0, 0, 1.8], [4.0, 0, 1.3]];
      for (const [ahead, side, r] of circles) {
        coach.offsetPoint(ahead, side, tmpV);
        for (const actor of list) {
          const p = actor.position;
          const dx = p.x - tmpV.x;
          const dz = p.z - tmpV.z;
          const min = r + actor.radius;
          const d = Math.hypot(dx, dz);
          if (d < min && d > 1e-4) {
            p.x = tmpV.x + (dx / d) * min;
            p.z = tmpV.z + (dz / d) * min;
          }
        }
      }
    }
  }

  private updateInteraction(): void {
    this.focused = null;
    if (!this.player.isAlive()) return;
    let best = 99;
    for (const it of this.interactables) {
      const d = it.position().distanceTo(this.player.position);
      if (d > it.radius || d >= best) continue;
      if (it.label() === null) continue;
      best = d;
      this.focused = it;
    }
    if (this.focused && this.input.justPressed('interact')) {
      this.sfx('ui');
      this.focused.act();
    }
  }

  private handleHotkeys(): void {
    if (!this.player.isAlive()) {
      this.setEmoteMenu(false);
      return;
    }
    if (this.input.justPressed('emote')) this.setEmoteMenu(!this.emoteMenu);
    if (this.emoteMenu) {
      // while the emote menu is open the number keys pick an emote instead of food
      for (let i = 0; i < EMOTES.length; i++) {
        if (this.input.codePressed(`Digit${i + 1}`)) {
          this.setEmoteMenu(false);
          this.playEmote(EMOTES[i].id);
          return;
        }
      }
    } else {
      const keys: [Parameters<InputSystem['justPressed']>[0], ItemId][] = [
        ['item1', 'slanina'],
        ['item2', 'parenica'],
        ['item3', 'halusky'],
        ['item4', 'borovicka'],
      ];
      for (const [action, item] of keys) if (this.input.justPressed(action)) this.useItem(item);
    }
    if (this.input.justPressed('fujara')) this.playFujara();
    if (this.input.justPressed('map')) this.hud.toggleBigMap();
    if (this.input.justPressed('disguise')) {
      if (!this.data.flags.hasDisguise) this.toastOnce('no-disguise', 'Nemáš prestrojenie – gazdiná Mara v dedine šije handlárske kabáty.', 'info');
      else if (this.inCombat) this.toast('Teraz sa neprezliekaj – bij sa!', 'bad');
      else this.setDisguise(!this.disguised);
    }
  }

  setEmoteMenu(open: boolean): void {
    if (this.emoteMenu === open) return;
    this.emoteMenu = open;
    this.hud.showEmotes(open ? EMOTES.map((e) => e.name) : null);
  }

  /** B-menu emotes: wave, odzemok, Hej-hou!, laugh, sit. */
  playEmote(id: EmoteId): void {
    const p = this.player;
    if (!p.isAlive() || p.attacking) return;
    if (this.inCombat && id !== 'hej') {
      this.toast('Teraz nie je čas na parádu – bij pandúrov!', 'bad');
      return;
    }
    switch (id) {
      case 'wave':
        p.playEmote('wave', 2.2);
        this.reactNearby(VILLAGER_WAVE, 'wave');
        break;
      case 'odzemok': {
        p.playEmote('odzemok', 5.5);
        this.audio.playDance(5.5);
        this.companions.forEach((c, i) => {
          if (c.isAlive() && c.position.distanceTo(p.position) < 14) {
            this.scheduler.after(0.3 + i * 0.25, () => c.playEmote('odzemok', 5.2 - i * 0.25));
          }
        });
        this.reactNearby(VILLAGER_DANCE, 'cheer');
        if (this.time >= this.odzemokReadyAt) {
          this.odzemokReadyAt = this.time + 45;
          this.scheduler.after(5, () => {
            if (p.pose !== 'odzemok') return;
            p.raz = Math.min(100, p.raz + 12);
            this.toast('Odzemok rozprúdil krv v žilách! Ráž +12', 'good');
          });
        }
        break;
      }
      case 'hej':
        p.playEmote('cheer', 1.8);
        this.bark(p.model.root, 'Hej-hou!', 1.8);
        this.sfx('quest');
        this.companions.forEach((c, i) => {
          if (!c.isAlive()) return;
          this.scheduler.after(0.5 + i * 0.3, () => {
            c.playEmote('cheer', 1.5);
            this.bark(c.model.root, i === 2 ? 'Hej-hou-hou-hou!' : 'Hej-hou!', 1.6);
          });
        });
        break;
      case 'laugh':
        p.playEmote('laugh', 2.5);
        this.bark(p.model.root, 'Hahaha!', 2);
        this.reactNearby(VILLAGER_LAUGH);
        break;
      case 'sit':
        p.playEmote('sit', Infinity);
        this.toastOnce('sit', 'Oddychuješ – sila sa obnovuje dvakrát rýchlejšie. Pohni sa a vstaneš.', 'info', 60);
        break;
    }
  }

  /** The nearest standing villager answers an emote. */
  private reactNearby(pool: readonly string[], pose?: 'wave' | 'cheer'): void {
    let best: Npc | null = null;
    let bestD = 12;
    for (const n of this.npcs.values()) {
      if (n.basePose !== 'normal' || !n.model.root.visible) continue;
      const d = n.position.distanceTo(this.player.position);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    const npc = best;
    if (!npc) return;
    this.scheduler.after(0.7, () => {
      this.bark(npc.model.root, line(pool, this.rng), 3.5);
      if (pose) npc.playEmote(pose, 2);
    });
  }

  /** The night watchman calls out every full hour when the captain is within earshot. */
  private updatePonocny(): void {
    const hour = Math.floor(this.dayNight.time);
    if (hour === this.calledHour) return;
    this.calledHour = hour;
    const npc = this.npcs.get('ponocny');
    if (!npc || npc.asleep || !npc.model.root.visible || npc.position.distanceTo(this.player.position) > 45) return;
    this.bark(npc.model.root, line(PONOCNY_CALL, this.rng).replace('{h}', HOUR_NAMES[hour % 12]), 5);
  }

  /** Companions chat on the road – what they say depends on weather, time and the captain. */
  private updateBanter(dt: number): void {
    this.banterTimer -= dt;
    if (this.banterTimer > 0) return;
    this.banterTimer = 45 + this.rng() * 45;
    if (this.inCombat || !this.player.isAlive()) return;
    const near = this.companions.filter((c) => c.isAlive() && c.position.distanceTo(this.player.position) < 15);
    if (near.length === 0) return;
    const c = near[Math.floor(this.rng() * near.length)];
    const pp = this.player.position;
    let pool: readonly string[] = BANTER[c.id];
    if (this.weather.rain > 0.4 && this.rng() < 0.6) pool = BANTER_RAIN;
    else if (this.dayNight.night > 0.6 && this.rng() < 0.45) pool = BANTER_NIGHT;
    else if (this.world.isMud(pp.x, pp.z)) pool = BANTER_MUD;
    else if (this.player.hp < this.player.maxHp * 0.35) pool = BANTER_HURT;
    this.bark(c.model.root, line(pool, this.rng), 5);
  }

  private checkDeath(dt: number): void {
    if (this.player.isAlive()) {
      this.deathTimer = -1;
      return;
    }
    if (this.deathTimer < 0) {
      this.deathTimer = 0;
      this.sfx('death');
      this.events.emit('combat:end', { won: false });
    }
    this.deathTimer += dt;
    if (this.deathTimer > 1.8 && this.deathTimer - dt <= 1.8) {
      const lost = Math.floor(this.data.dukaty / 2);
      this.events.emit('player:died', { lost });
      this.onPlayerDown?.(lost);
    }
  }

  /** Wake up at Rovná hora after a lost fight. */
  respawn(lost: number): void {
    this.data.dukaty -= lost;
    this.ambush.despawn();
    const v = LOC.vatra;
    this.player.teleport(v.x + 5, v.z + 6, this.world);
    this.player.revive(0.6);
    for (const c of this.companions) {
      c.reviveFull();
      c.teleport(v.x + 3 + this.rng() * 3, v.z + 7 + this.rng() * 2, this.world);
    }
    if (this.data.questStep === 'c3_lup') {
      this.data.questStep = 'c3_prepad';
      this.data.questCounter = 0;
    }
    if (this.data.questStep === 'c3_prepad') this.scheduler.after(6, () => !this.ambush.active && this.spawnStoryCoach());
    this.cameraCtl.snap(this.player.position, this.player.facing);
    this.audio.setMusicMode('explore');
    this.requestSave();
  }

  // ------------------------------------------------------------------ render

  render(alpha: number, frameDt: number): void {
    if (!this.playing) return;
    const m = this.input.consumeMouse();
    const look = this.input.lookAxis();
    const canLook = this.input.pointerLocked && this.scenes.top?.name === 'play';
    this.cameraCtl.handleInput(canLook ? m.dx : 0, canLook ? m.dy : 0, this.scenes.top?.name === 'play' ? m.wheel : 0, look.x, look.y, frameDt);

    this.player.render(alpha, frameDt);
    for (const c of this.companions) c.render(alpha, frameDt);
    for (const n of this.npcs.values()) n.render(alpha, frameDt);
    this.ambush.render(alpha, frameDt, this.time);
    this.town.render(alpha, frameDt);
    const watchman = this.npcs.get('ponocny');
    if (watchman?.model.root.visible) {
      watchman.model.lanternPosition(this.lantern.position);
      this.lantern.intensity = 2 + this.dayNight.night * 7;
    } else {
      this.lantern.intensity = 0;
    }

    if (this.debugPose) {
      const dp = this.debugPose;
      for (let i = 0; i < 8; i++) {
        this.player.model.update(0.1, { speed: 0, onGround: true, attack: dp.t, attackKind: dp.kind, aim: 0, pose: 'normal', hurt: 0 });
      }
    }

    // swing trail behind the valaška during the striking part of each blow
    const cur = this.player.current;
    let swinging = false;
    if (cur) {
      const t = this.player.swingProgress;
      swinging = cur.anim === 'spin' ? t > 0.26 && t < 0.86 : t > cur.hitAt - 0.24 && t < cur.hitAt + 0.1;
    }
    this.player.model.root.updateMatrixWorld(true);
    if (this.player.model.weaponPoints(tmpA, tmpB)) this.trail.update(frameDt, swinging, tmpA, tmpB);

    this.cameraCtl.update(this.player.model.root.position, frameDt, false, this.player.aiming);
    this.weather.render(frameDt, this.app.camera.position, this.player.position, this.audio, (x, z) =>
      this.world.groundHeight(x, z),
    );
    this.dayNight.apply(this.app, this.world, this.player.model.root.position, frameDt, this.weather);
    const w = this.weather.label();
    this.hud.setClock(
      `${this.dayNight.clock()} · ${this.dayNight.periodName()}${w ? ` · ${w}` : ''}`,
      this.dayNight.night > 0.5,
      this.weather.icon(this.dayNight.night > 0.5),
    );
    this.audio.update(this.app.camera.position, this.cameraCtl.yaw);

    const obj = this.objectivePosition();
    if (obj && obj.distanceTo(this.player.position) > 5) {
      this.marker.visible = true;
      this.marker.position.set(obj.x, obj.y + 3.6 + Math.sin(this.time * 2.5) * 0.25, obj.z);
      this.marker.rotation.y += frameDt * 1.5;
    } else {
      this.marker.visible = false;
    }

    const prompt = this.focused?.label() ?? null;
    this.hud.setPrompt(prompt && this.scenes.top?.name === 'play' ? `<kbd>E</kbd> ${prompt}` : null);
    const d = this.data;
    const buff: string[] = [];
    if (this.time < this.haluskyUntil) buff.push(`Sila halušiek ${Math.ceil(this.haluskyUntil - this.time)} s`);
    if (this.player.raz > 60) buff.push('Zbojnícka ráž!');
    this.hud.update({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      raz: this.player.raz,
      dukaty: d.dukaty,
      capacity: this.capacity,
      stash: d.stash,
      reputation: d.reputation,
      inventory: d.inventory,
      party: this.companions.map((c) => ({ name: c.displayName, hp: c.hp, maxHp: c.maxHp, downed: c.downed })),
      chapter: this.quests.chapter <= 4 ? `Kapitola ${this.quests.chapter}: ${CHAPTER_TITLES[this.quests.chapter]}` : 'Voľná hra',
      objective: this.quests.objectiveText(),
      hint: this.quests.def.hint ?? '',
      crosshair: this.input.pointerLocked && this.scenes.top?.name === 'play',
      aiming: this.cameraCtl.aimAmount > 0.5,
      reload: this.player.reloadProgress,
      buff: buff.join(' · '),
      clickHint: !this.input.pointerLocked && !this.input.usingGamepad && this.scenes.top?.name === 'play',
    });
    this.hud.drawMap(this.player.position.x, this.player.position.z, this.player.facing, this.mapMarkers(), obj);
    this.hud.updateBarks(this.app.camera, this.time);
  }

  private mapMarkers(): MapMarker[] {
    const markers: MapMarker[] = [
      { x: LOC.vatra.x, z: LOC.vatra.z, color: '#ff8a2a', label: 'Rovná hora' },
      { x: LOC.krcma.x - 6, z: LOC.krcma.z, color: '#d9b24a', label: 'Šenk' },
      { x: LOC.shop.x, z: LOC.shop.z, color: '#9aa0a6', label: 'Kováč' },
      { x: LOC.poor.x, z: LOC.poor.z, color: '#7fb069', label: 'Katarína' },
      { x: LOC.salas.x, z: LOC.salas.z, color: '#f3ead6', label: 'Salaš' },
      { x: LOC.terchova.x, z: LOC.terchova.z, color: '#6a9ad8', label: 'Terchová – brat Ján' },
      { x: LOC.castle.x, z: LOC.castle.z, color: '#8f8a80', label: 'Hrad', size: 4 },
      { x: LOC.field.x, z: LOC.field.z, color: '#c9a36a', label: 'Zemiaky', size: 4 },
      { x: LOC.mikulas.x, z: LOC.mikulas.z, color: '#e8dcc0', label: 'Liptovský Mikuláš', size: 6 },
      { x: LOC.hana.x, z: LOC.hana.z, color: '#7fb069', label: 'Vdova Hana', size: 4 },
    ];
    for (const g of this.town.guards) if (g.alerted && g.isAlive()) markers.push({ x: g.position.x, z: g.position.z, color: '#2c3e66', size: 3 });
    for (const c of this.companions) markers.push({ x: c.position.x, z: c.position.z, color: '#ece3d0', size: 3 });
    if (this.ambush.coach) markers.push({ x: this.ambush.coach.position.x, z: this.ambush.coach.position.z, color: '#d8432f', label: 'Panský koč', size: 6 });
    return markers;
  }

  /** Main menu backdrop: slow orbit over Liptov. */
  renderMenu(frameDt: number): void {
    this.menuTime += frameDt;
    this.world.update(frameDt, this.menuTime);
    this.particles.update(frameDt);
    for (const n of this.npcs.values()) n.render(1, frameDt);
    this.player.render(1, frameDt);
    const v = this.world.vatraPos;
    this.cameraCtl.orbit(tmpV.set(v.x, v.y + 2, v.z), 34, 14, this.menuTime);
    // the title screen lives in an eternal golden sunset by the bonfire
    this.dayNight.setTime(19.45);
    this.dayNight.apply(this.app, this.world, v, frameDt, null);
    if (this.rng() < 0.6) {
      const f = this.world.fires[0];
      if (f) this.particles.emit({ x: f.pos.x, y: f.pos.y + 0.6, z: f.pos.z, count: 1, spread: 0.8, speed: 0.3, up: 2.2, gravity: 1.5, drag: 0.5, color: [0xffb040, 0xff6a10], life: [0.5, 1.1], size: [0.1, 0.2] });
    }
  }
}

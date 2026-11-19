import type { ItemId } from '@/types/game-types';

// --- World -------------------------------------------------------------------
export const WORLD_SIZE = 1040;
export const TERRAIN_SEGMENTS = 250;
/** Terrain is split into CHUNKS×CHUNKS meshes so whatever is behind the camera is culled. */
export const TERRAIN_CHUNKS = 10;
export const WATER_LEVEL = -0.9;
export const ROAD_HEIGHT = 1.4;
export const ROAD_HALF_WIDTH = 3.2;
export const ROAD_START_X = -175;
export const ROAD_END_X = 175;

export interface Region {
  x: number;
  z: number;
  r: number;
}

/**
 * The open land is a union of discs – mountains rise outside it and the captain
 * can walk BOUNDS_MARGIN metres up the slopes before the edge stops him.
 */
export const REGIONS: readonly Region[] = [
  { x: 0, z: 0, r: 160 }, // dolina: dedina, Rovná hora, salaš, Terchová, hrad
  { x: 185, z: 88, r: 78 }, // údolie Váhu na východ
  { x: 330, z: 68, r: 100 }, // Liptovský Mikuláš
];
export const BOUNDS_MARGIN = 32;

export interface GorgeNode {
  x: number;
  z: number;
  /** floor height above the gorge entrance */
  dh: number;
  /** half-width of the walkable floor */
  r: number;
}

/**
 * Jánošíkove diery – a narrow rock gorge climbing north from Terchová. Where the floor
 * jumps between two nodes there is a waterfall and a ladder (see GORGE_STEPS).
 */
export const GORGE: readonly GorgeNode[] = [
  { x: 130, z: -106, dh: 0, r: 7 },
  { x: 140, z: -134, dh: 1, r: 6.5 },
  { x: 146, z: -158, dh: 2, r: 9 }, // Dolné diery – Ondrášov tábor
  { x: 150, z: -172, dh: 10, r: 5.5 },
  { x: 158, z: -195, dh: 11, r: 5.5 },
  { x: 161, z: -207, dh: 19, r: 5.5 },
  { x: 170, z: -226, dh: 20, r: 5.5 },
  { x: 173, z: -237, dh: 29, r: 5.5 },
  { x: 180, z: -258, dh: 30, r: 13 }, // Horné diery – zbojnícky úkryt
];

/** Index of the segment (node i → i+1) with a rock step, waterfall and ladder. */
export const GORGE_STEPS = [2, 4, 6] as const;
/** Which ladder is broken and must be mended with a rope. */
export const BROKEN_LADDER = 1;

// --- Simulation --------------------------------------------------------------
export const FIXED_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
export const GRAVITY = -26;

export const PLAYER_TUNING = {
  walkSpeed: 5.4,
  sprintSpeed: 9.2,
  jumpVelocity: 9.2,
  sprintJumpVelocity: 10.6,
  baseHp: 100,
  hpPerOpasok: 25,
  maxStamina: 100,
  staminaRegen: 24,
  staminaRegenDelay: 0.6,
  sprintCost: 17,
  attackCost: 13,
  jumpCost: 10,
  attackDuration: 0.5,
  attackHitAt: 0.3,
  attackRange: 2.5,
  attackArc: Math.PI * 0.65,
  baseDamage: 24,
  captainBonus: 6,
  shootCooldown: 1.4,
  shootDamage: 45,
  shootRange: 60,
  razDecay: 0.18,
  mudSlow: 0.5,
  mudSlowKrpce: 0.85,
  waterSlow: 0.55,
  /** seconds to pull the valaška from behind the belt / tuck it back */
  drawTime: 0.42,
  sheatheTime: 0.55,
} as const;

export const PANDUR_TUNING = {
  hp: 115,
  speed: 4.3,
  drowsySpeed: 2.2,
  damage: 10,
  /** chance to parry a frontal melee blow while ready (chasing) */
  blockChance: 0.28,
  /** frontal cone (radians from facing) in which blows can be parried */
  blockArc: 1.1,
  range: 1.9,
  windup: 0.55,
  drowsyWindup: 1.1,
  recover: 0.75,
  alertRadius: 13,
  sleepyAlertRadius: 3.2,
} as const;

export const COMPANION_TUNING = {
  hp: 90,
  speed: 5.6,
  runSpeed: 8.8,
  damage: 13,
  range: 2.1,
  cooldown: 1.15,
} as const;

/**
 * Villagers (and the wandering zbojníci) can be attacked: the first blow only earns a warning,
 * another one within `warnTime` starts a real fist fight. Beaten villagers are knocked out, not killed
 * (the story needs them) and hold a grudge for a while.
 */
export const BRAWL_TUNING = {
  hp: 140,
  damage: 9,
  speed: 4.6,
  range: 1.7,
  windup: 0.5,
  recover: 0.8,
  /** seconds the warning stands – hit again within it and they fight */
  warnTime: 25,
  /** damage taken from the warning blow (fraction) */
  warnDamage: 0.25,
  /** give up when the culprit runs this far */
  giveUpDistance: 30,
  knockoutTime: 45,
  /** seconds a beaten / provoked villager refuses to talk */
  grudgeTime: 120,
  /** dukáty that fall out of a knocked-out villager's pocket */
  knockoutLoot: [2, 8],
} as const;

/** Tougher folk: hp / damage overrides per villager. */
export const BRAWL_OVERRIDES: Partial<Record<string, { hp?: number; damage?: number; speed?: number }>> = {
  baca: { hp: 230, damage: 14 },
  kovac: { hp: 260, damage: 16, speed: 4.2 },
  krcmar: { hp: 180, damage: 11 },
  hostinsky: { hp: 180, damage: 11 },
  ponocny: { hp: 160, damage: 12 },
  ondras: { hp: 220, damage: 15 },
  uhorcik: { hp: 260, damage: 16 },
  ilcik: { hp: 240, damage: 15 },
  gajdosik: { hp: 200, damage: 12 },
  katarina: { hp: 90, damage: 6 },
  gazdina: { hp: 100, damage: 7 },
  hana: { hp: 90, damage: 6 },
};

/** Groups walking the valley: drábi (hostile) and other zbojnícke partie (friendly, fight the drábi). */
export interface PatrolDef {
  kind: 'drabi' | 'zbojnici';
  size: number;
  /** waypoint loop (x, z) */
  route: [number, number][];
}

export const PATROLS: PatrolDef[] = [
  // the castle guard walking round Likava
  { kind: 'drabi', size: 3, route: [[-124, -12], [-120, 22], [-140, 33], [-153, 16], [-150, -6]] },
  // castle → past the salaš → towards the village and back
  { kind: 'drabi', size: 3, route: [[-128, 42], [-104, 78], [-60, 82], [-36, 58], [-58, 28], [-100, 22]] },
  // forest east of the village
  { kind: 'drabi', size: 4, route: [[70, -10], [110, -5], [125, 30], [95, 46], [64, 30]] },
  // forest north of the village, under Rovná hora
  { kind: 'drabi', size: 2, route: [[10, -40], [42, -58], [72, -44], [50, -20]] },
  // another partia roaming between Rovná hora and Terchová
  { kind: 'zbojnici', size: 3, route: [[-40, -100], [0, -120], [40, -138], [62, -110], [20, -90], [-20, -78]] },
  { kind: 'zbojnici', size: 3, route: [[86, -100], [118, -112], [132, -92], [100, -82]] },
];

export const PATROL_TUNING = {
  walkSpeed: 1.7,
  /** drábi spot the zbojník at this distance (less at night, much less in disguise) */
  sightDay: 15,
  sightNight: 8,
  sightDisguised: 3.5,
  /** lose interest beyond this distance */
  loseDistance: 42,
  /** simulate / show only within this distance of the player */
  activeDistance: 140,
  /** a wiped-out group comes back after this many seconds (when nobody is watching) */
  respawn: 360,
  /** friendly zbojníci join a fight with drábi within this distance */
  helpDistance: 22,
} as const;

export const COACH_SPEED = 3.6;

// --- Economy -----------------------------------------------------------------
export const ECONOMY = {
  startDukaty: 15,
  roundCost: 10,
  pakaBet: 5,
  baseCapacity: 150,
  capacityPerOpasok: [0, 150, 450],
  opasokPrices: [0, 50, 140],
  klobukPrice: 40,
  krpcePrice: 30,
  storyLoot: 140,
  disguisePrice: 20,
  /** výberca's purse at the Mikuláš fair */
  collectorPurse: 180,
  /** what the widow Hana gets back for the robbed market folk */
  hanaShare: 60,
  innPrice: 3,
  hideoutTablePrice: 15,
} as const;

export interface ItemDef {
  name: string;
  desc: string;
  heal: number;
  raz: number;
  price: number;
  consumable: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  slanina: { name: 'Slanina', desc: '+25 zdravia', heal: 25, raz: 0, price: 5, consumable: true },
  parenica: { name: 'Parenica', desc: '+35 zdravia', heal: 35, raz: 0, price: 6, consumable: true },
  halusky: {
    name: 'Bryndzové halušky',
    desc: 'Plné zdravie celej družine, +20 ráž, sila halušiek',
    heal: 999,
    raz: 20,
    price: 0,
    consumable: true,
  },
  borovicka: { name: 'Borovička', desc: '+20 ráž, +5 zdravia', heal: 5, raz: 20, price: 4, consumable: true },
  zemiaky: { name: 'Zemiaky', desc: 'Na halušky', heal: 0, raz: 0, price: 0, consumable: false },
  bryndza: { name: 'Bryndza', desc: 'Na halušky', heal: 0, raz: 0, price: 5, consumable: false },
};

/** Hotbar order: keys 1..4 */
export const HOTBAR: ItemId[] = ['slanina', 'parenica', 'halusky', 'borovicka'];

// --- Key locations (x/z on the map) --------------------------------------------
export const LOC = {
  vatra: { x: -70, z: -80 },
  village: { x: 30, z: 20 },
  krcma: { x: 54, z: 10 },
  shop: { x: 10, z: 36 },
  poor: { x: 40, z: 52 },
  field: { x: 72, z: 44 },
  salas: { x: -88, z: 54 },
  kotlik: { x: -80, z: 46 },
  terchova: { x: 118, z: -72 },
  castle: { x: -140, z: 8 },
  /** námestie Liptovského Mikuláša */
  mikulas: { x: 330, z: 58 },
  /** vdova Hana – chalupa pod mestom pri hradskej */
  hana: { x: 268, z: 84 },
  /** Dolné diery – drevorubač Ondráš camps at the gorge's foot */
  diery: { x: 146, z: -158 },
  /** Horné diery – the hideout plateau under the overhang */
  ukryt: { x: 180, z: -258 },
  ambushX: 20,
} as const;

export const COLORS = {
  janosikShirt: 0xece3d0,
  janosikPants: 0xe0d3b4,
  leather: 0x5a3820,
  hatBlack: 0x161414,
  skin: 0xd9a988,
  hairDark: 0x2b1d14,
  pandurBlue: 0x2c3e66,
  gold: 0xc9a227,
  folkRed: 0xb3261e,
} as const;

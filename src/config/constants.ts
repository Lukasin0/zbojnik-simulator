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
} as const;

export const PANDUR_TUNING = {
  hp: 70,
  speed: 4.3,
  drowsySpeed: 2.2,
  damage: 9,
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

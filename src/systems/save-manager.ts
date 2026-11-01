import { ECONOMY, LOC } from '@/config/constants';
import type { CompanionId, ItemId, QuestStepId, SaveData } from '@/types/game-types';

const SAVE_KEY = 'zbojnik.save';
export const SAVE_VERSION = 3;

export function createNewSave(): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    questStep: 'c1_talk',
    questCounter: 0,
    player: { x: LOC.vatra.x + 6, z: LOC.vatra.z + 14, hp: 100, stamina: 100, raz: 10 },
    dukaty: ECONOMY.startDukaty,
    stash: 0,
    reputation: 0,
    inventory: { slanina: 1, parenica: 1, halusky: 0, borovicka: 0, zemiaky: 0, bryndza: 0 },
    equipment: { opasok: 0, klobuk: 0, krpce: 0 },
    companions: [],
    flags: {},
    stats: { coachesRobbed: 0, pandursBeaten: 0, givenToPoor: 0, playTime: 0 },
    // start at dawn so the valley mist is visible right away
    timeOfDay: 7.2,
  };
}

const QUEST_IDS: readonly QuestStepId[] = [
  'c1_talk',
  'c1_serm',
  'c1_strelba',
  'c1_zapas',
  'c1_skok',
  'c1_prisaha',
  'c2_verbuj',
  'c2_baca',
  'c3_strom',
  'c3_prepad',
  'c3_lup',
  'c3_rozdel',
  'c3_ukry',
  'c4_tip',
  'c4_prestroj',
  'c4_cesta',
  'c4_vreckuj',
  'c4_utek',
  'c4_rozdel',
  'free',
];
const COMPANION_IDS: readonly CompanionId[] = ['uhorcik', 'ilcik', 'gajdosik'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Versioned migration. v1 saves (early prototype) stored `money` instead of
 * `dukaty` and had no stash / equipment. v2 saves that already reached free play
 * continue with chapter 4 (the Mikuláš fair).
 */
function migrate(raw: Record<string, unknown>): SaveData {
  const base = createNewSave();
  const version = num(raw.version, 1);
  if (version < 2 && 'money' in raw) raw.dukaty = raw.money;
  if (version < 3 && raw.questStep === 'free') {
    raw.questStep = 'c4_tip';
    raw.questCounter = 0;
  }

  const player = isRecord(raw.player) ? raw.player : {};
  const inv = isRecord(raw.inventory) ? raw.inventory : {};
  const eq = isRecord(raw.equipment) ? raw.equipment : {};
  const stats = isRecord(raw.stats) ? raw.stats : {};
  const flags = isRecord(raw.flags) ? raw.flags : {};
  const step = QUEST_IDS.includes(raw.questStep as QuestStepId) ? (raw.questStep as QuestStepId) : base.questStep;

  const inventory = { ...base.inventory };
  (Object.keys(inventory) as ItemId[]).forEach((k) => (inventory[k] = Math.max(0, Math.floor(num(inv[k], 0)))));

  return {
    version: SAVE_VERSION,
    savedAt: num(raw.savedAt, Date.now()),
    questStep: step,
    questCounter: num(raw.questCounter, 0),
    player: {
      x: num(player.x, base.player.x),
      z: num(player.z, base.player.z),
      hp: num(player.hp, base.player.hp),
      stamina: num(player.stamina, base.player.stamina),
      raz: num(player.raz, base.player.raz),
    },
    dukaty: Math.max(0, num(raw.dukaty, base.dukaty)),
    stash: Math.max(0, num(raw.stash, 0)),
    reputation: num(raw.reputation, 0),
    inventory,
    equipment: {
      opasok: Math.min(2, Math.max(0, num(eq.opasok, 0))),
      klobuk: Math.min(1, Math.max(0, num(eq.klobuk, 0))),
      krpce: Math.min(1, Math.max(0, num(eq.krpce, 0))),
    },
    companions: Array.isArray(raw.companions)
      ? (raw.companions.filter((c) => COMPANION_IDS.includes(c as CompanionId)) as CompanionId[])
      : [],
    flags: Object.fromEntries(Object.entries(flags).filter(([, v]) => typeof v === 'boolean')) as Record<
      string,
      boolean
    >,
    stats: {
      coachesRobbed: num(stats.coachesRobbed, 0),
      pandursBeaten: num(stats.pandursBeaten, 0),
      givenToPoor: num(stats.givenToPoor, 0),
      playTime: num(stats.playTime, 0),
    },
    timeOfDay: Math.min(24, Math.max(0, num(raw.timeOfDay, 9))),
  };
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** LocalStorage persistence with versioning, debounced autosave and base64 import/export. */
export class SaveManager {
  private timer: number | null = null;

  hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? migrate(parsed) : null;
    } catch (err) {
      console.warn('Uloženú hru sa nepodarilo načítať', err);
      return null;
    }
  }

  save(data: SaveData): boolean {
    try {
      data.savedAt = Date.now();
      data.version = SAVE_VERSION;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.warn('Hru sa nepodarilo uložiť', err);
      return false;
    }
  }

  /** Debounced autosave – many quick changes produce one write. */
  scheduleSave(getData: () => SaveData, delayMs = 1200): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.save(getData());
    }, delayMs);
  }

  clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  exportBase64(data: SaveData): string {
    return toBase64(JSON.stringify(data));
  }

  importBase64(code: string): SaveData | null {
    try {
      const parsed: unknown = JSON.parse(fromBase64(code));
      return isRecord(parsed) ? migrate(parsed) : null;
    } catch {
      return null;
    }
  }

  /** Cloud save stub – wire to a backend (or Steam Cloud after the Unity port). */
  async uploadToCloud(_data: SaveData): Promise<boolean> {
    return false;
  }

  async downloadFromCloud(): Promise<SaveData | null> {
    return null;
  }
}

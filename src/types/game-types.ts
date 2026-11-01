export type ItemId = 'slanina' | 'parenica' | 'halusky' | 'borovicka' | 'zemiaky' | 'bryndza';

export type CompanionId = 'uhorcik' | 'ilcik' | 'gajdosik';

export type NpcId =
  | 'uhorcik'
  | 'ilcik'
  | 'gajdosik'
  | 'krcmar'
  | 'fero'
  | 'baca'
  | 'kovac'
  | 'katarina'
  | 'jan'
  | 'sedliak1'
  | 'sedliak2'
  | 'gazdina'
  | 'ponocny';

export type QuestStepId =
  | 'c1_talk'
  | 'c1_serm'
  | 'c1_strelba'
  | 'c1_zapas'
  | 'c1_skok'
  | 'c1_prisaha'
  | 'c2_verbuj'
  | 'c2_baca'
  | 'c3_strom'
  | 'c3_prepad'
  | 'c3_lup'
  | 'c3_rozdel'
  | 'c3_ukry'
  | 'free';

export type MinigameKind = 'fujara' | 'paka' | 'halusky';

export type Faction = 'zbojnik' | 'pandur' | 'prop';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Equipment {
  /** 0..2 – širší opasok = viac HP a väčší mešec */
  opasok: number;
  /** 0..1 – klobúk s pierkom = charizma */
  klobuk: number;
  /** 0..1 – lepšie krpce = rýchlosť v blate */
  krpce: number;
}

export interface PlayerSave {
  x: number;
  z: number;
  hp: number;
  stamina: number;
  raz: number;
}

export interface GameStats {
  coachesRobbed: number;
  pandursBeaten: number;
  givenToPoor: number;
  playTime: number;
}

export interface SaveData {
  version: number;
  savedAt: number;
  questStep: QuestStepId;
  questCounter: number;
  player: PlayerSave;
  dukaty: number;
  stash: number;
  reputation: number;
  inventory: Record<ItemId, number>;
  equipment: Equipment;
  companions: CompanionId[];
  flags: Record<string, boolean>;
  stats: GameStats;
  /** In-game hour 0..24 */
  timeOfDay: number;
}

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

export interface GraphicsSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  /** false until the player picks a preset – until then the detected one is used */
  userChosen: boolean;
  dynamicResolution: boolean;
  showFps: boolean;
}

export interface FujaraSong {
  id: string;
  title: string;
  bpm: number;
  lanePitches: number[];
  /** [beat, lane] */
  notes: [number, number][];
}

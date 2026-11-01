export type AttackAnim = 'slashR' | 'slashL' | 'overhead' | 'spin';

export interface AttackDef {
  id: string;
  name: string;
  anim: AttackAnim;
  /** seconds */
  duration: number;
  /** 0..1 – moment of the hit check */
  hitAt: number;
  /** damage multiplier on top of the player's base damage */
  damage: number;
  range: number;
  arc: number;
  stamina: number;
  knockback: number;
  /** forward step during the swing (m/s impulse) */
  lunge: number;
  shake: number;
  /** freeze-frame on hit (s) */
  hitStop: number;
}

/** Left mouse: three-hit combo. */
export const COMBO: AttackDef[] = [
  {
    id: 'slash1',
    name: 'Šikmý sek',
    anim: 'slashR',
    duration: 0.42,
    hitAt: 0.48,
    damage: 1,
    range: 2.5,
    arc: Math.PI * 0.75,
    stamina: 10,
    knockback: 3,
    lunge: 3,
    shake: 0.12,
    hitStop: 0.05,
  },
  {
    id: 'slash2',
    name: 'Sek späť',
    anim: 'slashL',
    duration: 0.42,
    hitAt: 0.45,
    damage: 1.15,
    range: 2.6,
    arc: Math.PI * 0.85,
    stamina: 10,
    knockback: 3.5,
    lunge: 3,
    shake: 0.14,
    hitStop: 0.05,
  },
  {
    id: 'slash3',
    name: 'Zbojnícky skok',
    anim: 'overhead',
    duration: 0.62,
    hitAt: 0.58,
    damage: 1.9,
    range: 2.9,
    arc: Math.PI * 0.6,
    stamina: 15,
    knockback: 7.5,
    lunge: 5,
    shake: 0.32,
    hitStop: 0.09,
  },
];

/** Middle mouse / Q: spinning heavy blow that throws everyone around. */
export const HEAVY: AttackDef = {
  id: 'vir',
  name: 'Valaškový vír',
  anim: 'spin',
  duration: 0.95,
  hitAt: 0.6,
  damage: 2.3,
  range: 3.3,
  arc: Math.PI * 2,
  stamina: 32,
  knockback: 10,
  lunge: 1.5,
  shake: 0.45,
  hitStop: 0.1,
};

/** Seconds after an attack in which the next click continues the combo. */
export const COMBO_WINDOW = 0.45;

/** Attack used by companions / pandúri – they alternate between these. */
export const NPC_ATTACKS: AttackAnim[] = ['slashR', 'overhead', 'slashL'];

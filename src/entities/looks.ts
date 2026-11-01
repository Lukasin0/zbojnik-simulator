import type { CharacterLook } from '@/components/character-model';
import { COLORS } from '@/config/constants';

/** Jánošík – straight from the concept art. */
export const JANOSIK: CharacterLook = {
  skin: COLORS.skin,
  hair: COLORS.hairDark,
  shirt: COLORS.janosikShirt,
  pants: COLORS.janosikPants,
  shoes: 0x3a2418,
  socks: [0x1d1a17, 0xeae2cf],
  wideSleeves: true,
  belt: COLORS.leather,
  beltLevel: 0,
  hat: 'zbojnik',
  hatColor: COLORS.hatBlack,
  braids: true,
  weapon: 'valaska',
  pistol: true,
};

export const UHORCIK: CharacterLook = {
  ...JANOSIK,
  skin: 0xcf9d7c,
  hair: 0x5a5048,
  vest: 0x6b4a2f,
  braids: false,
  mustache: true,
  beard: 0x5a5048,
  pistol: false,
};

export const ILCIK: CharacterLook = {
  ...JANOSIK,
  hair: 0x7a4a22,
  vest: 0x8f2a22,
  braids: false,
  mustache: true,
  pistol: false,
  girth: 1.1,
};

export const GAJDOSIK: CharacterLook = {
  ...JANOSIK,
  hair: 0x1a1410,
  vest: 0x2e4a6a,
  braids: true,
  feather: true,
  pistol: false,
  height: 0.95,
};

export const PANDUR: CharacterLook = {
  skin: 0xd5a383,
  hair: 0x3a2a1c,
  shirt: 0xd8d2c4,
  pants: 0x2c3e66,
  shoes: 0x1a1412,
  coat: COLORS.pandurBlue,
  coatLong: true,
  trim: COLORS.gold,
  hat: 'shako',
  hatColor: 0x161414,
  mustache: true,
  weapon: 'saber',
  belt: 0xe8e2d4,
};

export const ZEMAN: CharacterLook = {
  skin: 0xe8b8a0,
  hair: 0xf2efe8,
  shirt: 0xf2efe8,
  pants: 0xd8c9a0,
  shoes: 0x1a1412,
  coat: 0x3d6b3a,
  coatLong: true,
  trim: COLORS.gold,
  hat: 'wig',
  weapon: 'none',
  girth: 1.45,
};

export const KOCIS: CharacterLook = {
  skin: 0xd5a383,
  hair: 0x3a2a1c,
  shirt: 0xd8d2c4,
  pants: 0x4a3a2a,
  shoes: 0x1a1412,
  coat: 0x4a3a2a,
  hat: 'cap',
  hatColor: 0x2a2420,
  mustache: true,
  weapon: 'none',
};

export const KRCMAR: CharacterLook = {
  skin: 0xe0a888,
  hair: 0x2a2018,
  shirt: 0xe6dccb,
  pants: 0x4a3a2a,
  shoes: 0x2a1a12,
  apron: 0xf0ece0,
  vest: 0x2a2a2a,
  hat: 'none',
  mustache: true,
  weapon: 'none',
  girth: 1.5,
};

export const FERO: CharacterLook = {
  skin: 0xd09878,
  hair: 0x6a3a1a,
  shirt: 0xe6dccb,
  pants: 0xd8ccb0,
  shoes: 0x2a1a12,
  belt: COLORS.leather,
  beltLevel: 1,
  hat: 'cap',
  hatColor: 0x3a3028,
  mustache: true,
  weapon: 'none',
  girth: 1.35,
  height: 1.08,
};

export const BACA: CharacterLook = {
  skin: 0xc48e6c,
  hair: 0xb8b0a4,
  shirt: 0xe6dccb,
  pants: 0xe0d6c0,
  shoes: 0x3a2418,
  socks: [0x3a2a1c, 0xe0d6c0],
  belt: COLORS.leather,
  beltLevel: 2,
  cape: 0x7a7266,
  hat: 'bacov',
  hatColor: 0x2a2018,
  beard: 0xb8b0a4,
  mustache: true,
  weapon: 'staff',
};

export const KOVAC: CharacterLook = {
  skin: 0xc48e6c,
  hair: 0x1a1410,
  shirt: 0xcfc4b0,
  pants: 0x3a3028,
  shoes: 0x1a1412,
  apron: 0x5a3820,
  hat: 'none',
  beard: 0x1a1410,
  weapon: 'none',
  girth: 1.25,
};

export const KATARINA: CharacterLook = {
  skin: 0xd8a888,
  hair: 0x8a8278,
  shirt: 0xe6dccb,
  pants: 0x4a3a2a,
  shoes: 0x2a1a12,
  skirt: 0x5a3a4a,
  apron: 0x8a3a2a,
  hat: 'kerchief',
  hatColor: 0x6a2a2a,
  weapon: 'none',
  height: 0.92,
};

export const JAN: CharacterLook = {
  ...JANOSIK,
  hair: 0x3a2a1c,
  braids: false,
  weapon: 'none',
  pistol: false,
  hat: 'cap',
  hatColor: 0x3a3028,
  vest: 0x4a3a2a,
  socks: undefined,
  wideSleeves: false,
};

export const SEDLIAK: CharacterLook = {
  skin: 0xd09878,
  hair: 0x4a3020,
  shirt: 0xe0d6c4,
  pants: 0xd0c4a8,
  shoes: 0x2a1a12,
  belt: 0x4a3020,
  hat: 'zbojnik',
  hatColor: 0x3a3028,
  weapon: 'none',
};

/** Ponocný – the night watchman who calls out the hours. */
export const PONOCNY: CharacterLook = {
  skin: 0xcf9d7c,
  hair: 0x8a8278,
  shirt: 0xd8ccb0,
  pants: 0x4a3a2a,
  shoes: 0x2a1a12,
  coat: 0x5a4632,
  coatLong: true,
  belt: COLORS.leather,
  hat: 'zbojnik',
  hatColor: 0x1d1a17,
  mustache: true,
  beard: 0x8a8278,
  weapon: 'lantern',
  girth: 1.1,
};

export const GAZDINA: CharacterLook = {
  ...KATARINA,
  skirt: 0x2a4a6a,
  apron: 0xe8e2d4,
  hatColor: 0xb3261e,
  hair: 0x3a2018,
  height: 0.95,
};

// ---------------------------------------------------------------- Liptovský Mikuláš

/** Výberca daní Gašpar Mastný – well fed on other people's taxes. */
export const VYBERCA: CharacterLook = {
  skin: 0xe8b090,
  hair: 0x5a4030,
  shirt: 0xf2efe8,
  pants: 0x2a2420,
  shoes: 0x1a1412,
  coat: 0x6a1f1a,
  coatLong: true,
  trim: COLORS.gold,
  belt: 0x1a1412,
  hat: 'cap',
  hatColor: 0x1a1412,
  mustache: true,
  weapon: 'none',
  girth: 1.55,
};

export const KRAMAR: CharacterLook = {
  ...SEDLIAK,
  vest: 0x5a3a22,
  hat: 'cap',
  hatColor: 0x4a3a2a,
  mustache: true,
  girth: 1.15,
};

export const KRAMARKA: CharacterLook = {
  ...KATARINA,
  hair: 0x4a3020,
  skirt: 0x8a3a2a,
  apron: 0xe8dcc0,
  hatColor: 0x2e5a8a,
  height: 0.96,
};

export const MESTAN: CharacterLook = {
  skin: 0xdcae90,
  hair: 0x3a2a1c,
  shirt: 0xe6dccb,
  pants: 0x3a3a42,
  shoes: 0x1a1412,
  coat: 0x2e3e5a,
  belt: 0x1a1412,
  hat: 'zbojnik',
  hatColor: 0x2a2420,
  weapon: 'none',
};

export const HOSTINSKY: CharacterLook = {
  ...KRCMAR,
  vest: 0x6a2a2a,
  hair: 0x8a6a4a,
  girth: 1.35,
};

export const HANA: CharacterLook = {
  ...KATARINA,
  hair: 0x6a6258,
  skirt: 0x2a2626,
  apron: 0x4a4440,
  hatColor: 0x1a1818,
  height: 0.94,
};

/** Drevorubač Ondráš – lives in the woods above Terchová, axe always at hand. */
export const DREVORUBAC: CharacterLook = {
  skin: 0xc48e6c,
  hair: 0x8a5a32,
  shirt: 0xd8ccb0,
  pants: 0x4a3a2a,
  shoes: 0x3a2418,
  socks: [0x3a2a1c, 0xd8ccb0],
  vest: 0x3a4a2a,
  belt: COLORS.leather,
  beltLevel: 1,
  hat: 'bacov',
  hatColor: 0x3a3028,
  beard: 0x8a5a32,
  mustache: true,
  weapon: 'valaska',
  girth: 1.2,
  height: 1.05,
};

/** Handlársky kabát – what Jánošík wears to sneak into town. */
export const DISGUISE = {
  coat: 0x6a5640,
  cap: 0x3a3028,
} as const;

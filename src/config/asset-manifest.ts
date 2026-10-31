/**
 * Typed registry of every external asset the game loads.
 *
 * Geometry, textures and audio of the prototype are generated procedurally (low-poly
 * meshes + Web Audio synthesis), so the manifest is small. Real `.glb` models
 * (Blockbench / Meshy / Mixamo) and audio files go to `public/assets/**` and get an
 * entry here – the preloader picks them up automatically.
 */
export interface ImageAssetDef {
  readonly key: string;
  readonly url: string;
  readonly critical: boolean;
}

export interface DataAssetDef {
  readonly key: string;
  readonly url: string;
  readonly critical: boolean;
}

export interface FontAssetDef {
  readonly family: string;
  readonly weight: string;
}

export const ASSET_MANIFEST = {
  images: [{ key: 'janosik', url: 'assets/images/janosik.png', critical: false }],
  data: [{ key: 'fujara-songs', url: 'assets/data/fujara-songs.json', critical: false }],
  fonts: [
    { family: 'Alegreya SC', weight: '700' },
    { family: 'Alegreya', weight: '400' },
  ],
  /** Audio sprites / music files – empty while the synthesized soundtrack is used. */
  audio: { music: [] as string[], sfx: [] as string[] },
} as const satisfies {
  images: readonly ImageAssetDef[];
  data: readonly DataAssetDef[];
  fonts: readonly FontAssetDef[];
  audio: { music: string[]; sfx: string[] };
};

export type ImageKey = (typeof ASSET_MANIFEST.images)[number]['key'];
export type DataKey = (typeof ASSET_MANIFEST.data)[number]['key'];

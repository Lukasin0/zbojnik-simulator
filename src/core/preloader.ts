import { ASSET_MANIFEST } from '@/config/asset-manifest';
import type { DataKey, ImageKey } from '@/config/asset-manifest';
import type { FujaraSong } from '@/types/game-types';

export interface FujaraSongFile {
  songs: FujaraSong[];
}

/** Loaded assets, accessed by typed key. */
export class AssetStore {
  readonly images = new Map<ImageKey, HTMLImageElement>();
  readonly data = new Map<DataKey, unknown>();
  readonly failed: string[] = [];

  image(key: ImageKey): HTMLImageElement | undefined {
    return this.images.get(key);
  }

  fujaraSongs(): FujaraSong[] {
    const raw = this.data.get('fujara-songs') as FujaraSongFile | undefined;
    return raw && Array.isArray(raw.songs) ? raw.songs : [];
  }
}

const MIN_DISPLAY_MS = 900;
const RETRIES = 3;

function url(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < RETRIES; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => window.setTimeout(r, 250 * 2 ** i));
    }
  }
  throw lastErr;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Obrázok sa nenačítal: ${src}`));
    img.src = src;
  });
}

async function loadJson(src: string): Promise<unknown> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${res.status} ${src}`);
  return res.json() as Promise<unknown>;
}

/**
 * Loads every manifest asset with progress reporting, retry with backoff, a minimum
 * display time and graceful degradation for non-critical failures.
 */
export async function preloadAssets(onProgress: (p: number, label: string) => void): Promise<AssetStore> {
  const store = new AssetStore();
  const started = performance.now();
  const jobs: { label: string; critical: boolean; run: () => Promise<void> }[] = [];

  for (const img of ASSET_MANIFEST.images) {
    jobs.push({
      label: 'Maľujem portréty…',
      critical: img.critical,
      run: async () => {
        store.images.set(img.key, await withRetry(() => loadImage(url(img.url))));
      },
    });
  }
  for (const d of ASSET_MANIFEST.data) {
    jobs.push({
      label: 'Ladím fujaru…',
      critical: d.critical,
      run: async () => {
        store.data.set(d.key, await withRetry(() => loadJson(url(d.url))));
      },
    });
  }
  for (const f of ASSET_MANIFEST.fonts) {
    jobs.push({
      label: 'Brúsim písmo…',
      critical: false,
      run: async () => {
        if ('fonts' in document) await document.fonts.load(`${f.weight} 24px "${f.family}"`);
      },
    });
  }

  let done = 0;
  onProgress(0, 'Hmla sa váľa nad Liptovom…');
  await Promise.all(
    jobs.map(async (job) => {
      try {
        await job.run();
      } catch (err) {
        if (job.critical) throw err;
        store.failed.push(job.label);
        console.warn(err);
      }
      done++;
      onProgress(done / jobs.length, job.label);
    }),
  );

  const elapsed = performance.now() - started;
  if (elapsed < MIN_DISPLAY_MS) await new Promise((r) => window.setTimeout(r, MIN_DISPLAY_MS - elapsed));
  return store;
}

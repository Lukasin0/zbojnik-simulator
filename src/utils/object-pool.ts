export interface PoolStats {
  created: number;
  active: number;
  free: number;
  peak: number;
}

/**
 * Generic object pool. Used for particles, enemies' transient effects and any
 * short-lived object that would otherwise churn the garbage collector.
 */
export class ObjectPool<T> {
  private readonly free: T[] = [];
  private created = 0;
  private active = 0;
  private peak = 0;

  constructor(
    private readonly factory: () => T,
    private readonly reset: (item: T) => void,
    prewarm = 0,
    private readonly max = Number.POSITIVE_INFINITY,
  ) {
    for (let i = 0; i < prewarm; i++) {
      this.free.push(this.factory());
      this.created++;
    }
  }

  /** Returns null when the pool is exhausted and may not grow further. */
  acquire(): T | null {
    let item = this.free.pop();
    if (item === undefined) {
      if (this.created >= this.max) return null;
      item = this.factory();
      this.created++;
    }
    this.active++;
    if (this.active > this.peak) this.peak = this.active;
    return item;
  }

  release(item: T): void {
    this.reset(item);
    this.free.push(item);
    this.active--;
  }

  get stats(): PoolStats {
    return { created: this.created, active: this.active, free: this.free.length, peak: this.peak };
  }
}

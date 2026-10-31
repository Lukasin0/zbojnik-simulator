/** A cooldown ticking in game time (never wall-clock). */
export class Cooldown {
  private remaining = 0;

  constructor(public duration: number) {}

  update(dt: number): void {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
  }

  get ready(): boolean {
    return this.remaining <= 0;
  }

  /** 0 = just triggered, 1 = ready */
  get progress(): number {
    return this.duration <= 0 ? 1 : 1 - this.remaining / this.duration;
  }

  trigger(duration = this.duration): void {
    this.remaining = duration;
  }

  reset(): void {
    this.remaining = 0;
  }
}

interface Task {
  at: number;
  fn: () => void;
}

/** Runs callbacks after a delay measured in simulated game time. */
export class Scheduler {
  private time = 0;
  private tasks: Task[] = [];

  after(seconds: number, fn: () => void): void {
    this.tasks.push({ at: this.time + seconds, fn });
  }

  update(dt: number): void {
    this.time += dt;
    if (this.tasks.length === 0) return;
    const due = this.tasks.filter((t) => t.at <= this.time);
    if (due.length === 0) return;
    this.tasks = this.tasks.filter((t) => t.at > this.time);
    for (const t of due) t.fn();
  }

  clear(): void {
    this.tasks = [];
  }
}

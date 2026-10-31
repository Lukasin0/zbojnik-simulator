import { FIXED_DT, MAX_STEPS_PER_FRAME } from '@/config/constants';

/**
 * Fixed-timestep loop driven by requestAnimationFrame. Simulation runs at 60 Hz;
 * rendering receives an interpolation factor so motion stays smooth on any refresh rate.
 */
export class GameLoop {
  private running = false;
  private last = 0;
  private accumulator = 0;
  private rafId = 0;
  fps = 0;
  private fpsFrames = 0;
  private fpsTime = 0;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number, frameDt: number) => void,
    private readonly step = FIXED_DT,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const frameDt = Math.min((now - this.last) / 1000, 0.25);
    this.last = now;
    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= this.step && steps < MAX_STEPS_PER_FRAME) {
      this.update(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    // spiral-of-death guard: drop the backlog instead of trying to catch up forever
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    this.render(this.accumulator / this.step, frameDt);

    this.fpsFrames++;
    this.fpsTime += frameDt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };
}

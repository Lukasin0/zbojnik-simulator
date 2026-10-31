/** A screen / mode of the game (menu, gameplay, dialog, minigame, pause…). */
export interface GameState {
  readonly name: string;
  /** When true, states below this one stop updating (they still render). */
  readonly blocksUpdate: boolean;
  enter?(): void;
  exit?(): void;
  update?(dt: number): void;
  render?(alpha: number, frameDt: number): void;
}

/** Stack-based state manager with fade transitions. */
export class SceneManager {
  private readonly stack: GameState[] = [];
  private readonly fader: HTMLDivElement;
  private transitioning = false;

  constructor(uiRoot: HTMLElement) {
    this.fader = document.createElement('div');
    this.fader.className = 'fader';
    uiRoot.appendChild(this.fader);
  }

  get top(): GameState | undefined {
    return this.stack[this.stack.length - 1];
  }

  has(name: string): boolean {
    return this.stack.some((s) => s.name === name);
  }

  push(state: GameState): void {
    this.stack.push(state);
    state.enter?.();
  }

  pop(): GameState | undefined {
    const s = this.stack.pop();
    s?.exit?.();
    return s;
  }

  /** Pop states until `name` is on top (or the stack is empty). */
  popTo(name: string): void {
    while (this.stack.length > 0 && this.top?.name !== name) this.pop();
  }

  replaceAll(state: GameState): void {
    while (this.stack.length > 0) this.pop();
    this.push(state);
  }

  /** Fade to black, run `fn`, fade back in. */
  transition(fn: () => void, ms = 450): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.fader.classList.add('on');
    window.setTimeout(() => {
      fn();
      this.fader.classList.remove('on');
      window.setTimeout(() => (this.transitioning = false), ms);
    }, ms);
  }

  update(dt: number): void {
    // find the lowest state that should still update
    let start = 0;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].blocksUpdate) {
        start = i;
        break;
      }
    }
    const active = this.stack.slice(start);
    for (const s of active) s.update?.(dt);
  }

  render(alpha: number, frameDt: number): void {
    for (const s of [...this.stack]) s.render?.(alpha, frameDt);
  }
}

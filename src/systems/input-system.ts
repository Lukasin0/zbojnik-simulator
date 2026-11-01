export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'attack'
  | 'heavy'
  | 'emote'
  | 'shoot'
  | 'interact'
  | 'pause'
  | 'fujara'
  | 'item1'
  | 'item2'
  | 'item3'
  | 'item4'
  | 'map'
  | 'disguise'
  | 'confirm';

const KEY_BINDINGS: Record<Action, readonly string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  attack: ['KeyJ'],
  heavy: ['KeyQ'],
  emote: ['KeyB'],
  shoot: ['KeyF'],
  interact: ['KeyE'],
  pause: ['Escape', 'KeyP'],
  fujara: ['KeyG'],
  item1: ['Digit1'],
  item2: ['Digit2'],
  item3: ['Digit3'],
  item4: ['Digit4'],
  map: ['KeyM'],
  disguise: ['KeyH'],
  confirm: ['Enter', 'Space'],
};

const MOUSE_BINDINGS: Partial<Record<Action, readonly number[]>> = {
  attack: [0],
  heavy: [1],
  shoot: [2],
};

/** Standard gamepad mapping (Xbox layout). */
const PAD_BINDINGS: Partial<Record<Action, readonly number[]>> = {
  jump: [0],
  confirm: [0],
  interact: [1],
  attack: [2, 7],
  shoot: [6, 5],
  fujara: [3],
  sprint: [10],
  heavy: [4],
  emote: [11],
  pause: [9],
  map: [8],
  item1: [12],
  item2: [15],
  item3: [13],
  item4: [14],
};

const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F3', 'F4']);
const DEADZONE = 0.18;

/**
 * Tracks keyboard, mouse and gamepad state and maps them onto abstract actions.
 * "Just pressed" edges survive until `endTick()` so a fixed-timestep update never misses them.
 */
export class InputSystem {
  private readonly keysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();
  private readonly keysReleased = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly mousePressed = new Set<number>();
  private readonly mouseReleased = new Set<number>();
  private readonly padDown = new Set<number>();
  private readonly padPressed = new Set<number>();
  private readonly padReleased = new Set<number>();
  private readonly padAxes = [0, 0, 0, 0];
  private mouseDX = 0;
  private mouseDY = 0;
  private wheel = 0;
  private locked = false;
  private lastPadUse = 0;
  private lastKeyUse = 0;

  /** When true, the first click on the canvas grabs the pointer instead of attacking. */
  lockOnClick = false;

  constructor(private readonly canvas: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    this.lastKeyUse = performance.now();
    if (e.repeat) return;
    if (!this.keysDown.has(e.code)) this.keysPressed.add(e.code);
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.keysDown.delete(e.code)) this.keysReleased.add(e.code);
  };

  private onBlur = (): void => {
    this.keysDown.clear();
    this.mouseDown.clear();
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.lastKeyUse = performance.now();
    // middle click would start the browser's auto-scroll
    if (e.button === 1) e.preventDefault();
    if (this.lockOnClick && !this.locked) {
      this.requestPointerLock();
      return;
    }
    this.mouseDown.add(e.button);
    this.mousePressed.add(e.button);
  };

  private onMouseUp = (e: MouseEvent): void => {
    // only a press we registered counts as a release (not the click that grabbed the pointer)
    if (this.mouseDown.delete(e.button)) this.mouseReleased.add(e.button);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onWheel = (e: WheelEvent): void => {
    this.wheel += Math.sign(e.deltaY);
  };

  requestPointerLock(): void {
    if (this.locked) return;
    try {
      const result = this.canvas.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => undefined);
    } catch {
      /* some browsers throw when called too often – harmless */
    }
  }

  exitPointerLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  get pointerLocked(): boolean {
    return this.locked;
  }

  get usingGamepad(): boolean {
    return this.lastPadUse > this.lastKeyUse;
  }

  /** Read gamepad state; call once per rendered frame. */
  pollGamepad(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = pads.find((p): p is Gamepad => p !== null && p.connected);
    if (!pad) {
      this.padDown.clear();
      this.padAxes.fill(0);
      return;
    }
    pad.buttons.forEach((b, i) => {
      const pressed = b.pressed || b.value > 0.5;
      if (pressed && !this.padDown.has(i)) {
        this.padPressed.add(i);
        this.lastPadUse = performance.now();
      }
      if (pressed) this.padDown.add(i);
      else if (this.padDown.delete(i)) this.padReleased.add(i);
    });
    for (let i = 0; i < 4; i++) {
      const v = pad.axes[i] ?? 0;
      this.padAxes[i] = Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
      if (this.padAxes[i] !== 0) this.lastPadUse = performance.now();
    }
  }

  isDown(action: Action): boolean {
    if (KEY_BINDINGS[action].some((k) => this.keysDown.has(k))) return true;
    if (MOUSE_BINDINGS[action]?.some((b) => this.mouseDown.has(b))) return true;
    return PAD_BINDINGS[action]?.some((b) => this.padDown.has(b)) ?? false;
  }

  justPressed(action: Action): boolean {
    if (KEY_BINDINGS[action].some((k) => this.keysPressed.has(k))) return true;
    if (MOUSE_BINDINGS[action]?.some((b) => this.mousePressed.has(b))) return true;
    return PAD_BINDINGS[action]?.some((b) => this.padPressed.has(b)) ?? false;
  }

  justReleased(action: Action): boolean {
    if (KEY_BINDINGS[action].some((k) => this.keysReleased.has(k))) return true;
    if (MOUSE_BINDINGS[action]?.some((b) => this.mouseReleased.has(b))) return true;
    return PAD_BINDINGS[action]?.some((b) => this.padReleased.has(b)) ?? false;
  }

  /** Raw key edge for minigames (`KeyD`, `Space`…). */
  codePressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  codeDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  padButtonPressed(index: number): boolean {
    return this.padPressed.has(index);
  }

  /** x = right, y = forward, length <= 1 */
  moveAxis(): { x: number; y: number } {
    let x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0) + this.padAxes[0];
    let y = (this.isDown('forward') ? 1 : 0) - (this.isDown('back') ? 1 : 0) - this.padAxes[1];
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  lookAxis(): { x: number; y: number } {
    return { x: this.padAxes[2], y: this.padAxes[3] };
  }

  consumeMouse(): { dx: number; dy: number; wheel: number } {
    const out = { dx: this.mouseDX, dy: this.mouseDY, wheel: this.wheel };
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    return out;
  }

  /** Clear edge-triggered state after a simulation tick consumed it. */
  endTick(): void {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.mousePressed.clear();
    this.mouseReleased.clear();
    this.padPressed.clear();
    this.padReleased.clear();
  }
}

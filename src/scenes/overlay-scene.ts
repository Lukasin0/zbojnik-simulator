import type { GameState } from '@/core/scene-manager';
import type { InputSystem } from '@/systems/input-system';

/** Generic modal DOM screen (settings, controls, pause, info). Esc closes it when `closable`. */
export class OverlayScene implements GameState {
  readonly blocksUpdate = true;

  constructor(
    readonly name: string,
    private readonly uiRoot: HTMLElement,
    private readonly element: HTMLElement,
    private readonly input: InputSystem,
    private readonly onClose: (() => void) | null,
  ) {}

  enter(): void {
    this.uiRoot.appendChild(this.element);
  }

  exit(): void {
    this.element.remove();
  }

  update(): void {
    if (this.onClose && (this.input.codePressed('Escape') || this.input.padButtonPressed(1) || this.input.padButtonPressed(9))) {
      this.onClose();
    }
  }
}

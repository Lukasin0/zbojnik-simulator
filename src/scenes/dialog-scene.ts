import type { Game } from '@/core/game';
import type { GameState } from '@/core/scene-manager';
import type { DialogNode } from '@/ui/dialog';

/** Pauses gameplay while a conversation is on screen. */
export class DialogScene implements GameState {
  readonly name = 'dialog';
  readonly blocksUpdate = true;
  private closed = false;

  constructor(
    private readonly game: Game,
    private node: DialogNode,
  ) {}

  enter(): void {
    this.show();
  }

  exit(): void {
    this.game.dialogBox.hide();
  }

  private show(): void {
    this.game.dialogBox.show(this.node, (i) => this.pick(i));
  }

  private pick(index: number): void {
    if (this.closed || !this.game.dialogBox.isEnabled(index)) return;
    this.game.audio.play('ui');
    const option = this.node.options?.[index];
    // close first – the action may push a minigame or a follow-up dialog
    this.closed = true;
    this.game.scenes.pop();
    const next = option?.action?.();
    if (next) {
      this.game.openDialog(next);
    } else if (this.game.scenes.top?.name === 'play') {
      this.game.input.requestPointerLock();
    }
  }

  update(): void {
    const input = this.game.input;
    for (let i = 0; i < 9; i++) {
      if (input.codePressed(`Digit${i + 1}`)) {
        this.pick(i);
        return;
      }
    }
    if (input.codePressed('ArrowDown') || input.codePressed('KeyS') || input.padButtonPressed(13)) this.game.dialogBox.move(1);
    if (input.codePressed('ArrowUp') || input.codePressed('KeyW') || input.padButtonPressed(12)) this.game.dialogBox.move(-1);
    if (input.codePressed('Enter') || input.codePressed('Space') || input.codePressed('KeyE') || input.padButtonPressed(0)) {
      this.pick(this.game.dialogBox.selected);
      return;
    }
    if (input.codePressed('Escape') || input.padButtonPressed(1)) {
      this.closed = true;
      this.game.scenes.pop();
    }
  }
}

import type { InputSystem } from '@/systems/input-system';

/** What the player wants to do this tick, already expressed in world space. */
export interface PlayerIntent {
  moveX: number;
  moveZ: number;
  magnitude: number;
  sprint: boolean;
  jump: boolean;
  attack: boolean;
  /** Heavy spinning blow (middle mouse / Q). */
  heavy: boolean;
  /** Shoot button held – aiming over the shoulder. */
  aim: boolean;
  /** Shoot button released – fire. */
  shoot: boolean;
  aimYaw: number;
}

/** Converts raw input + camera orientation into a camera-relative movement intent. */
export class PlayerInputHandler {
  constructor(private readonly input: InputSystem) {}

  read(cameraYaw: number, enabled: boolean): PlayerIntent {
    if (!enabled) {
      return {
        moveX: 0,
        moveZ: 0,
        magnitude: 0,
        sprint: false,
        jump: false,
        attack: false,
        heavy: false,
        aim: false,
        shoot: false,
        aimYaw: cameraYaw,
      };
    }
    const axis = this.input.moveAxis();
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    // screen-right when looking along (fx, fz)
    const rx = -fz;
    const rz = fx;
    const moveX = fx * axis.y + rx * axis.x;
    const moveZ = fz * axis.y + rz * axis.x;
    const magnitude = Math.min(1, Math.hypot(moveX, moveZ));
    return {
      moveX,
      moveZ,
      magnitude,
      sprint: this.input.isDown('sprint'),
      jump: this.input.justPressed('jump'),
      attack: this.input.justPressed('attack'),
      heavy: this.input.justPressed('heavy'),
      aim: this.input.isDown('shoot'),
      shoot: this.input.justReleased('shoot'),
      aimYaw: cameraYaw,
    };
  }
}

import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Velocity } from "../components/Velocity";
import type { Transform } from "../components/Transform";
import type { Input } from "../core/Input";
import { PLAYER_SPEED } from "../config/constants";
import { getItemLevel } from "../core/UpgradeEffects";

export class InputSystem implements System {
  readonly name = "InputSystem";
  private world: World;
  private input: Input;

  constructor(world: World, input: Input) {
    this.world = world;
    this.input = input;
  }

  update(_dt: number): void {
    const players = this.world.query(["PlayerTag", "Velocity", "Transform"]);

    // Booster: +10% speed per level
    const boosterLevel = getItemLevel(this.world, "booster");
    const speed = PLAYER_SPEED * (1 + boosterLevel * 0.1);

    for (const entity of players) {
      const vel = this.world.getComponent<Velocity>(entity, "Velocity")!;

      let dx = 0;
      let dy = 0;

      if (this.input.isDown("KeyW") || this.input.isDown("ArrowUp")) dy -= 1;
      if (this.input.isDown("KeyS") || this.input.isDown("ArrowDown")) dy += 1;
      if (this.input.isDown("KeyA") || this.input.isDown("ArrowLeft")) dx -= 1;
      if (this.input.isDown("KeyD") || this.input.isDown("ArrowRight")) dx += 1;

      // Normalize diagonal
      if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv;
        dy *= inv;
      }

      vel.vx = dx * speed;
      vel.vy = dy * speed;

      // Update facing direction when moving
      if (dx !== 0 || dy !== 0) {
        const transform = this.world.getComponent<Transform>(entity, "Transform")!;
        transform.rotation = Math.atan2(dy, dx);
      }
    }
  }
}

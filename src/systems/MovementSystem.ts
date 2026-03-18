import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Velocity } from "../components/Velocity";

export class MovementSystem implements System {
  readonly name = "MovementSystem";
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  update(dt: number): void {
    const entities = this.world.query(["Transform", "Velocity"]);

    for (const entity of entities) {
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;
      const velocity = this.world.getComponent<Velocity>(entity, "Velocity")!;

      transform.x += velocity.vx * dt;
      transform.y += velocity.vy * dt;
    }
  }
}

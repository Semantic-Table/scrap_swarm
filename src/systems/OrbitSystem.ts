import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Orbit } from "../components/Orbit";

/** Updates position of orbiting entities based on their parent's position */
export class OrbitSystem implements System {
  readonly name = "OrbitSystem";
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  update(dt: number): void {
    const entities = this.world.query(["Orbit", "Transform"]);

    for (const entity of entities) {
      const orbit = this.world.getComponent<Orbit>(entity, "Orbit")!;
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;

      // Check parent still exists
      if (!this.world.isAlive(orbit.parent)) continue;

      const parentTransform = this.world.getComponent<Transform>(orbit.parent, "Transform");
      if (!parentTransform) continue;

      // Advance angle
      orbit.angle += orbit.speed * dt;

      // Position around parent
      transform.x = parentTransform.x + Math.cos(orbit.angle) * orbit.distance;
      transform.y = parentTransform.y + Math.sin(orbit.angle) * orbit.distance;
      transform.rotation = orbit.angle;
    }
  }
}

import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Collider } from "../components/Collider";
import type { Application } from "pixi.js";

/** Keeps the player clamped inside the screen */
export class BoundsSystem implements System {
  readonly name = "BoundsSystem";
  private world: World;
  private app: Application;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
  }

  update(_dt: number): void {
    const players = this.world.query(["PlayerTag", "Transform", "Collider"]);

    for (const entity of players) {
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;
      const collider = this.world.getComponent<Collider>(entity, "Collider")!;
      const r = collider.radius;

      transform.x = Math.max(r, Math.min(this.app.screen.width - r, transform.x));
      transform.y = Math.max(r, Math.min(this.app.screen.height - r, transform.y));
    }
  }
}

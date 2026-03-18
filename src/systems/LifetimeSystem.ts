import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Lifetime } from "../components/Lifetime";
import type { Sprite } from "../components/Sprite";
import type { Application } from "pixi.js";

/** Destroys entities whose Lifetime has expired */
export class LifetimeSystem implements System {
  readonly name = "LifetimeSystem";
  private world: World;
  private app: Application;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
  }

  update(dt: number): void {
    const entities = this.world.query(["Lifetime"]);

    for (const entity of entities) {
      const lifetime = this.world.getComponent<Lifetime>(entity, "Lifetime")!;
      lifetime.remaining -= dt;

      if (lifetime.remaining <= 0) {
        const sprite = this.world.getComponent<Sprite>(entity, "Sprite");
        if (sprite) {
          this.app.stage.removeChild(sprite.graphic);
          sprite.graphic.destroy();
        }
        this.world.destroyEntity(entity);
      }
    }
  }
}

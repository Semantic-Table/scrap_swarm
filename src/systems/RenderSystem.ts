import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Sprite } from "../components/Sprite";

export class RenderSystem implements System {
  readonly name = "RenderSystem";
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  update(_dt: number): void {
    const entities = this.world.query(["Transform", "Sprite"]);

    for (const entity of entities) {
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;
      const sprite = this.world.getComponent<Sprite>(entity, "Sprite")!;

      sprite.graphic.x = transform.x;
      sprite.graphic.y = transform.y;
      sprite.graphic.rotation = transform.rotation;
    }
  }
}

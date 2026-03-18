import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Sprite } from "../components/Sprite";
import type { WaveState } from "../components/Wave";
import type { Application } from "pixi.js";

const DESPAWN_MARGIN = 500;

/** Removes enemies that have wandered far off-screen */
export class CleanupSystem implements System {
  readonly name = "CleanupSystem";
  private world: World;
  private app: Application;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
  }

  update(_dt: number): void {
    const enemies = this.world.query(["EnemyTag", "Transform"]);
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    for (const entity of enemies) {
      const t = this.world.getComponent<Transform>(entity, "Transform")!;

      if (t.x < -DESPAWN_MARGIN || t.x > w + DESPAWN_MARGIN ||
          t.y < -DESPAWN_MARGIN || t.y > h + DESPAWN_MARGIN) {
        const sprite = this.world.getComponent<Sprite>(entity, "Sprite");
        if (sprite) {
          this.app.stage.removeChild(sprite.graphic);
          sprite.graphic.destroy();
        }

        const managers = this.world.query(["WaveState"]);
        if (managers.length > 0) {
          const wave = this.world.getComponent<WaveState>(managers[0], "WaveState")!;
          wave.enemiesAlive = Math.max(0, wave.enemiesAlive - 1);
        }

        this.world.destroyEntity(entity);
      }
    }
  }
}

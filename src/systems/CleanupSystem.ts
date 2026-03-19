import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Sprite } from "../components/Sprite";
import type { WaveState } from "../components/Wave";

const DESPAWN_DISTANCE = 1800;

/** Removes enemies that have wandered far from the player */
export class CleanupSystem implements System {
  readonly name = "CleanupSystem";
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  update(_dt: number): void {
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const enemies = this.world.query(["EnemyTag", "Transform"]);

    for (const entity of enemies) {
      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const dx = t.x - pT.x;
      const dy = t.y - pT.y;

      if (dx * dx + dy * dy > DESPAWN_DISTANCE * DESPAWN_DISTANCE) {
        const sprite = this.world.getComponent<Sprite>(entity, "Sprite");
        if (sprite) {
          sprite.graphic.removeFromParent();
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

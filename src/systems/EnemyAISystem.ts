import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Velocity } from "../components/Velocity";
import type { EnemyType } from "../components/EnemyType";
import { ENEMY_SPEED } from "../config/constants";

export class EnemyAISystem implements System {
  readonly name = "EnemyAISystem";
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  update(_dt: number): void {
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const playerTransform = this.world.getComponent<Transform>(players[0], "Transform")!;
    const enemies = this.world.query(["EnemyTag", "Transform", "Velocity"]);

    for (const entity of enemies) {
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;
      const velocity = this.world.getComponent<Velocity>(entity, "Velocity")!;

      // Per-entity speed from EnemyType, fallback to base
      const enemyType = this.world.getComponent<EnemyType>(entity, "EnemyType");
      const speed = enemyType ? enemyType.speed : ENEMY_SPEED;

      const dx = playerTransform.x - transform.x;
      const dy = playerTransform.y - transform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        velocity.vx = (dx / dist) * speed;
        velocity.vy = (dy / dist) * speed;
        transform.rotation = Math.atan2(dy, dx);
      }
    }
  }
}

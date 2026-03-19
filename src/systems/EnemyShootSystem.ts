import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { EnemyType } from "../components/EnemyType";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createVelocity } from "../components/Velocity";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createLifetime } from "../components/Lifetime";
import { createEnemyProjectileTag } from "../components/EnemyProjectile";
import {
  SHOOTER_STOP_DISTANCE,
  SHOOTER_FIRE_COOLDOWN,
  SHOOTER_PROJECTILE_SPEED,
  SHOOTER_PROJECTILE_SIZE,
  SHOOTER_PROJECTILE_COLOR,
  SHOOTER_PROJECTILE_LIFETIME,
} from "../config/constants";

export class EnemyShootSystem implements System {
  readonly name = "EnemyShootSystem";
  private world: World;
  private stage: Container;
  private cooldowns = new Map<number, number>();

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  update(dt: number): void {
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const enemies = this.world.query(["EnemyTag", "Transform", "EnemyType"]);

    // Clean up cooldowns for dead entities
    for (const id of this.cooldowns.keys()) {
      if (!this.world.isAlive(id)) this.cooldowns.delete(id);
    }

    for (const entity of enemies) {
      const enemyType = this.world.getComponent<EnemyType>(entity, "EnemyType")!;
      if (enemyType.name !== "shooter") continue;

      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const dx = pT.x - t.x;
      const dy = pT.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only fire when in range
      if (dist > SHOOTER_STOP_DISTANCE * 1.2) continue;

      let cd = this.cooldowns.get(entity) ?? 0;
      cd -= dt;
      if (cd > 0) {
        this.cooldowns.set(entity, cd);
        continue;
      }

      this.cooldowns.set(entity, SHOOTER_FIRE_COOLDOWN);
      this.fire(t.x, t.y, dx, dy, dist);
    }
  }

  private fire(fromX: number, fromY: number, dx: number, dy: number, dist: number): void {
    if (dist === 0) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    const entity = this.world.createEntity();

    const graphic = new Graphics()
      .circle(0, 0, SHOOTER_PROJECTILE_SIZE)
      .fill(SHOOTER_PROJECTILE_COLOR);
    this.stage.addChild(graphic);

    this.world.addComponent(entity, createTransform(fromX, fromY));
    this.world.addComponent(entity, createVelocity(dirX * SHOOTER_PROJECTILE_SPEED, dirY * SHOOTER_PROJECTILE_SPEED));
    this.world.addComponent(entity, createSprite(graphic));
    this.world.addComponent(entity, createCollider(SHOOTER_PROJECTILE_SIZE));
    this.world.addComponent(entity, createEnemyProjectileTag());
    this.world.addComponent(entity, createLifetime(SHOOTER_PROJECTILE_LIFETIME));
  }
}

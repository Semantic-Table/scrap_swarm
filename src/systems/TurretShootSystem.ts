import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { TurretTag } from "../components/Turret";
import type { Application } from "pixi.js";
import { Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createVelocity } from "../components/Velocity";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createProjectileTag } from "../components/Projectile";
import { createLifetime } from "../components/Lifetime";
import {
  TURRET_SHOOT_RANGE,
  PROJECTILE_SPEED,
  PROJECTILE_SIZE,
  PROJECTILE_LIFETIME,
  TURRET_COLOR,
} from "../config/constants";

export class TurretShootSystem implements System {
  readonly name = "TurretShootSystem";
  private world: World;
  private app: Application;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
  }

  update(dt: number): void {
    const turrets = this.world.query(["TurretTag", "Transform"]);

    for (const turret of turrets) {
      const tag = this.world.getComponent<TurretTag>(turret, "TurretTag")!;
      const transform = this.world.getComponent<Transform>(turret, "Transform")!;

      tag.shootTimer -= dt;
      if (tag.shootTimer > 0) continue;

      const target = this.findClosestEnemy(transform.x, transform.y);
      if (!target) continue;

      tag.shootTimer = tag.shootCooldown;
      this.spawnProjectile(transform.x, transform.y, target.x, target.y);
    }
  }

  private findClosestEnemy(x: number, y: number): { x: number; y: number } | null {
    const enemies = this.world.query(["EnemyTag", "Transform"]);

    let closest: { x: number; y: number } | null = null;
    let closestDistSq = TURRET_SHOOT_RANGE * TURRET_SHOOT_RANGE;

    for (const entity of enemies) {
      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const dx = t.x - x;
      const dy = t.y - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = { x: t.x, y: t.y };
      }
    }

    return closest;
  }

  private spawnProjectile(fromX: number, fromY: number, toX: number, toY: number): void {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    const entity = this.world.createEntity();

    const graphic = new Graphics()
      .circle(0, 0, PROJECTILE_SIZE)
      .fill(TURRET_COLOR);
    this.app.stage.addChild(graphic);

    this.world.addComponent(entity, createTransform(fromX, fromY, Math.atan2(dy, dx)));
    this.world.addComponent(entity, createVelocity(dirX * PROJECTILE_SPEED, dirY * PROJECTILE_SPEED));
    this.world.addComponent(entity, createSprite(graphic));
    this.world.addComponent(entity, createCollider(PROJECTILE_SIZE));
    this.world.addComponent(entity, createProjectileTag());
    this.world.addComponent(entity, createLifetime(PROJECTILE_LIFETIME));
  }
}

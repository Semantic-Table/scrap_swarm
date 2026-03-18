import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Application } from "pixi.js";
import { Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createVelocity } from "../components/Velocity";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createProjectileTag } from "../components/Projectile";
import { createLifetime } from "../components/Lifetime";
import {
  PROJECTILE_SPEED,
  PROJECTILE_SIZE,
  PROJECTILE_COLOR,
  PROJECTILE_LIFETIME,
  SHOOT_COOLDOWN,
  SHOOT_RANGE,
} from "../config/constants";

export class ShootSystem implements System {
  readonly name = "ShootSystem";
  private world: World;
  private app: Application;
  private cooldown = 0;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
  }

  update(dt: number): void {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const pTransform = this.world.getComponent<Transform>(players[0], "Transform")!;

    // Find closest enemy in range
    const target = this.findClosestEnemy(pTransform.x, pTransform.y);
    if (!target) return;

    this.cooldown = SHOOT_COOLDOWN;
    this.spawnProjectile(pTransform.x, pTransform.y, target.x, target.y);
  }

  private findClosestEnemy(px: number, py: number): { x: number; y: number } | null {
    const enemies = this.world.query(["EnemyTag", "Transform"]);

    let closest: { x: number; y: number } | null = null;
    let closestDistSq = SHOOT_RANGE * SHOOT_RANGE;

    for (const entity of enemies) {
      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const dx = t.x - px;
      const dy = t.y - py;
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
      .fill(PROJECTILE_COLOR);
    this.app.stage.addChild(graphic);

    this.world.addComponent(entity, createTransform(fromX, fromY, Math.atan2(dy, dx)));
    this.world.addComponent(entity, createVelocity(dirX * PROJECTILE_SPEED, dirY * PROJECTILE_SPEED));
    this.world.addComponent(entity, createSprite(graphic));
    this.world.addComponent(entity, createCollider(PROJECTILE_SIZE));
    this.world.addComponent(entity, createProjectileTag());
    this.world.addComponent(entity, createLifetime(PROJECTILE_LIFETIME));
  }
}

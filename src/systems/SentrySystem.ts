import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult } from "../core/UpgradeEffects";
import { createTransform } from "../components/Transform";
import { createVelocity } from "../components/Velocity";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createProjectileTag } from "../components/Projectile";
import { createLifetime } from "../components/Lifetime";
import {
  SENTRY_COOLDOWN, SENTRY_RANGE, SENTRY_DAMAGE, SENTRY_LIFETIME, SENTRY_COLOR, SENTRY_DEPLOY_COOLDOWN,
  PROJECTILE_SPEED, PROJECTILE_SIZE, PROJECTILE_LIFETIME,
} from "../config/constants";
import { hasEvolution } from "../core/EvolutionManager";
import { playSentryDeploy } from "../core/Audio";

interface ActiveSentry { g: Graphics; x: number; y: number; life: number; shootTimer: number; cooldown: number; range: number; damage: number }

export class SentrySystem implements System {
  readonly name = "SentrySystem";
  private world: World;
  private stage: Container;
  private deployTimer = 0;
  private sentries: ActiveSentry[] = [];

  constructor(world: World, stage: Container) { this.world = world; this.stage = stage; }

  update(dt: number): void {
    // Update sentries
    for (let i = this.sentries.length - 1; i >= 0; i--) {
      const s = this.sentries[i];
      const isFortress = hasEvolution(this.world, "fortress");
      // Fortress: 60s lifetime instead of permanent
      s.life -= isFortress ? dt * 0.25 : dt; // 4x slower decay = ~60s effective
      if (s.life <= 0) { s.g.removeFromParent(); s.g.destroy(); this.sentries.splice(i, 1); continue; }

      // Blink when about to expire
      if (s.life < 3) s.g.alpha = 0.5 + Math.sin(s.life * 10) * 0.5;

      // Shoot
      s.shootTimer -= dt;
      if (s.shootTimer > 0) continue;

      const target = this.findTarget(s.x, s.y, s.range);
      if (!target) continue;

      s.shootTimer = s.cooldown;
      this.fireProjectile(s.x, s.y, target.x, target.y, s.damage);
    }

    const level = getItemLevel(this.world, "sentry");
    if (level <= 0) return;
    this.deployTimer -= dt;
    if (this.deployTimer > 0) return;
    this.deployTimer = SENTRY_DEPLOY_COOLDOWN * getCooldownMult(this.world);

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;

    playSentryDeploy();
    const g = new Graphics();
    const sz = 10;
    g.rect(-sz, -sz, sz * 2, sz * 2).fill(0x222222);
    g.rect(-sz, -sz, sz * 2, sz * 2).stroke({ color: SENTRY_COLOR, width: 2 });
    g.circle(0, 0, 4).fill(SENTRY_COLOR);
    g.x = pT.x; g.y = pT.y;
    this.stage.addChild(g);

    this.sentries.push({
      g, x: pT.x, y: pT.y,
      life: SENTRY_LIFETIME + (level - 1) * 2,
      shootTimer: 0,
      cooldown: SENTRY_COOLDOWN * getCooldownMult(this.world),
      range: (SENTRY_RANGE + (level - 1) * 15) * getRangeMult(this.world),
      damage: SENTRY_DAMAGE + Math.floor((level - 1) / 3) + getBonusDamage(this.world),
    });
  }

  private findTarget(x: number, y: number, range: number): { x: number; y: number } | null {
    const enemies = this.world.query(["EnemyTag", "Transform"]);
    let closest: { x: number; y: number } | null = null;
    let closestDist = range * range;
    for (const e of enemies) {
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      const dx = t.x - x, dy = t.y - y;
      const d = dx * dx + dy * dy;
      if (d < closestDist) { closestDist = d; closest = { x: t.x, y: t.y }; }
    }
    return closest;
  }

  private fireProjectile(fromX: number, fromY: number, toX: number, toY: number, damage: number): void {
    const dx = toX - fromX, dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const entity = this.world.createEntity();
    const g = new Graphics().circle(0, 0, PROJECTILE_SIZE).fill(SENTRY_COLOR);
    this.stage.addChild(g);

    this.world.addComponent(entity, createTransform(fromX, fromY));
    this.world.addComponent(entity, createVelocity((dx / dist) * PROJECTILE_SPEED, (dy / dist) * PROJECTILE_SPEED));
    this.world.addComponent(entity, createSprite(g));
    this.world.addComponent(entity, createCollider(PROJECTILE_SIZE));
    this.world.addComponent(entity, createProjectileTag(damage));
    this.world.addComponent(entity, createLifetime(PROJECTILE_LIFETIME));
  }
}

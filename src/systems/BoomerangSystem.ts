import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Collider } from "../components/Collider";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playBoomerang } from "../core/Audio";
import { BOOMERANG_COOLDOWN, BOOMERANG_DAMAGE, BOOMERANG_RANGE, BOOMERANG_SPEED, BOOMERANG_COLOR } from "../config/constants";

interface ActiveBoomerang {
  g: Graphics;
  x: number; y: number;
  angle: number;
  dist: number;
  maxDist: number;
  returning: boolean;
  originX: number; originY: number;
  speed: number;
  damage: number;
  life: number;
  launchAngle: number;
  hitEntities: Set<number>;
}

export class BoomerangSystem implements System {
  readonly name = "BoomerangSystem";
  private world: World;
  private stage: Container;
  private timer = 0;
  private active: ActiveBoomerang[] = [];
  private buzzsawAngle = 0;

  constructor(world: World, stage: Container) { this.world = world; this.stage = stage; }

  update(dt: number): void {
    const players = this.world.query(["PlayerTag", "Transform"]);
    const playerT = players.length > 0 ? this.world.getComponent<Transform>(players[0], "Transform")! : null;

    // Update active boomerangs
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.life -= dt;
      b.angle += dt * 10;

      if (!b.returning) {
        b.dist += b.speed * dt;
        if (b.dist >= b.maxDist) b.returning = true;
      } else {
        b.dist -= b.speed * dt * 1.3;
        if (b.dist <= 0 || b.life <= 0) {
          b.g.removeFromParent(); b.g.destroy();
          this.active.splice(i, 1);
          continue;
        }
      }

      // Follow player origin, but use fixed launch angle for direction
      if (playerT) {
        b.originX = playerT.x; b.originY = playerT.y;
      }

      b.x = b.originX + Math.cos(b.launchAngle) * b.dist;
      b.y = b.originY + Math.sin(b.launchAngle) * b.dist;
      b.g.x = b.x; b.g.y = b.y;
      b.g.rotation = b.angle;

      // Hit enemies
      const enemies = this.world.query(["EnemyTag", "Transform", "Collider"]);
      for (const e of enemies) {
        if (!this.world.isAlive(e) || b.hitEntities.has(e)) continue;
        const t = this.world.getComponent<Transform>(e, "Transform")!;
        const c = this.world.getComponent<Collider>(e, "Collider")!;
        const dx = b.x - t.x, dy = b.y - t.y;
        if (dx * dx + dy * dy <= (c.radius + 12) * (c.radius + 12)) {
          b.hitEntities.add(e);
          damageEnemy(this.world, this.stage, e, b.damage, t.x, t.y);
        }
      }
      // Reset hit list on return trip
      if (b.returning && b.dist < b.maxDist * 0.9) b.hitEntities.clear();
    }

    const level = getItemLevel(this.world, "boomerang");
    if (level <= 0) return;

    // BUZZSAW evolution: permanent orbiting blade
    if (hasEvolution(this.world, "buzzsaw") && playerT) {
      this.buzzsawAngle += dt * 6;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0.12 * getCooldownMult(this.world);
        const range = (BOOMERANG_RANGE + (level - 1) * 15) * getRangeMult(this.world);
        const bx = playerT.x + Math.cos(this.buzzsawAngle) * range * 0.7;
        const by = playerT.y + Math.sin(this.buzzsawAngle) * range * 0.7;
        const damage = Math.max(1, Math.floor((BOOMERANG_DAMAGE + getBonusDamage(this.world)) * 0.5));
        const enemies = this.world.query(["EnemyTag", "Transform", "Collider"]);
        for (const e of enemies) {
          if (!this.world.isAlive(e)) continue;
          const et = this.world.getComponent<Transform>(e, "Transform")!;
          const ec = this.world.getComponent<Collider>(e, "Collider")!;
          const edx = bx - et.x, edy = by - et.y;
          if (edx * edx + edy * edy <= (ec.radius + 15) * (ec.radius + 15)) {
            damageEnemy(this.world, this.stage, e, damage, et.x, et.y);
          }
        }
      }
      return;
    }

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = BOOMERANG_COOLDOWN * getCooldownMult(this.world);

    if (!playerT) return;
    const pT = playerT;

    const g = new Graphics();
    g.rect(-10, -3, 20, 6).fill(BOOMERANG_COLOR);
    g.rect(-3, -10, 6, 20).fill(BOOMERANG_COLOR);
    this.stage.addChild(g);

    playBoomerang();
    this.active.push({
      g, x: pT.x, y: pT.y, angle: 0,
      dist: 0, maxDist: (BOOMERANG_RANGE + (level - 1) * 15) * getRangeMult(this.world),
      returning: false, originX: pT.x, originY: pT.y,
      speed: BOOMERANG_SPEED + level * 20,
      damage: BOOMERANG_DAMAGE + Math.floor((level - 1) / 2) + getBonusDamage(this.world),
      life: 4, launchAngle: pT.rotation, hitEntities: new Set(),
    });
  }
}

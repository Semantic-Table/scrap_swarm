import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Velocity } from "../components/Velocity";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playGravityHum } from "../core/Audio";
import { GRAVITY_COOLDOWN, GRAVITY_DAMAGE, GRAVITY_RADIUS, GRAVITY_PULL_DURATION, GRAVITY_COLOR } from "../config/constants";

interface Well { g: Graphics; x: number; y: number; life: number; maxLife: number; radius: number; damage: number; exploded: boolean; pulses: number }

export class GravityWellSystem implements System {
  readonly name = "GravityWellSystem";
  private world: World;
  private stage: Container;
  private timer = 0;
  private wells: Well[] = [];

  constructor(world: World, stage: Container) { this.world = world; this.stage = stage; }

  update(dt: number): void {
    for (let i = this.wells.length - 1; i >= 0; i--) {
      const w = this.wells[i];
      const isBlackHole = hasEvolution(this.world, "black_hole");

      // Black Hole: 3 damage pulses then explode (longer pull duration)
      if (isBlackHole) {
        w.life -= dt;
        if (w.life <= 0 && w.pulses < 3) {
          w.pulses++;
          w.life = 1.5; // 1.5s between pulses
          const enemies2 = this.world.query(["EnemyTag", "Transform"]);
          for (const e of enemies2) {
            if (!this.world.isAlive(e)) continue;
            const t = this.world.getComponent<Transform>(e, "Transform")!;
            const ddx = w.x - t.x, ddy = w.y - t.y;
            if (ddx * ddx + ddy * ddy <= w.radius * w.radius) {
              damageEnemy(this.world, this.stage, e, Math.floor(w.damage * 0.4), t.x, t.y);
            }
          }
        }
      } else {
        w.life -= dt;
      }

      if (w.life <= 0 && !w.exploded && (!isBlackHole || w.pulses >= 3)) {
        // Explode — damage all in radius
        w.exploded = true;
        const enemies = this.world.query(["EnemyTag", "Transform"]);
        for (const e of enemies) {
          if (!this.world.isAlive(e)) continue;
          const t = this.world.getComponent<Transform>(e, "Transform")!;
          const dx = w.x - t.x, dy = w.y - t.y;
          if (dx * dx + dy * dy <= w.radius * w.radius) {
            damageEnemy(this.world, this.stage, e, w.damage, t.x, t.y);
          }
        }
        w.g.removeFromParent(); w.g.destroy();
        this.wells.splice(i, 1);
        continue;
      }

      // Pull enemies toward well center
      const pullStrength = 150;
      const enemies = this.world.query(["EnemyTag", "Transform", "Velocity"]);
      for (const e of enemies) {
        if (!this.world.isAlive(e)) continue;
        const t = this.world.getComponent<Transform>(e, "Transform")!;
        const v = this.world.getComponent<Velocity>(e, "Velocity")!;
        const dx = w.x - t.x, dy = w.y - t.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= w.radius * w.radius && distSq > 1) {
          const dist = Math.sqrt(distSq);
          v.vx += (dx / dist) * pullStrength * dt;
          v.vy += (dy / dist) * pullStrength * dt;
        }
      }

      // Visual: pulsing ring
      const t = 1 - w.life / w.maxLife;
      w.g.clear();
      w.g.circle(w.x, w.y, w.radius * (0.5 + t * 0.5)).stroke({ color: GRAVITY_COLOR, width: 2, alpha: 0.6 });
      w.g.circle(w.x, w.y, w.radius * t * 0.3).fill({ color: GRAVITY_COLOR, alpha: 0.15 });
    }

    const level = getItemLevel(this.world, "gravity");
    if (level <= 0) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = GRAVITY_COOLDOWN * getCooldownMult(this.world);

    // Find closest enemy cluster center
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;

    // Target nearest enemy
    const enemies = this.world.query(["EnemyTag", "Transform"]);
    let closestX = pT.x + Math.cos(pT.rotation) * 100;
    let closestY = pT.y + Math.sin(pT.rotation) * 100;
    let closestDist = Infinity;
    for (const e of enemies) {
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      const dx = pT.x - t.x, dy = pT.y - t.y;
      const d = dx * dx + dy * dy;
      if (d < closestDist) { closestDist = d; closestX = t.x; closestY = t.y; }
    }

    const g = new Graphics();
    this.stage.addChild(g);

    playGravityHum();
    const isBlackHole = hasEvolution(this.world, "black_hole");
    this.wells.push({
      g, x: closestX, y: closestY,
      life: isBlackHole ? 1.5 : GRAVITY_PULL_DURATION,
      maxLife: isBlackHole ? 6.0 : GRAVITY_PULL_DURATION,
      radius: (GRAVITY_RADIUS + (level - 1) * 15) * getRangeMult(this.world) * (isBlackHole ? 1.5 : 1),
      damage: GRAVITY_DAMAGE + (level - 1) * 2 + getBonusDamage(this.world),
      exploded: false,
      pulses: 0,
    });
  }
}

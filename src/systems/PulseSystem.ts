import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult, getQuantityBonus } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import {
  PULSE_COOLDOWN,
  PULSE_RADIUS,
  PULSE_DAMAGE,
  PULSE_COLOR,
  PULSE_FLASH_DURATION,
} from "../config/constants";

export class PulseSystem implements System {
  readonly name = "PulseSystem";
  private world: World;
  private stage: Container;
  private timer = 0;

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  update(dt: number): void {
    const level = getItemLevel(this.world, "pulse");
    if (level <= 0) return;

    this.timer -= dt;
    if (this.timer > 0) return;

    this.timer = Math.max(0.8, PULSE_COOLDOWN - (level - 1) * 0.3) * getCooldownMult(this.world);

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const radius = (PULSE_RADIUS + (level - 1) * 20) * getRangeMult(this.world);
    const damage = PULSE_DAMAGE + Math.floor((level - 1) / 2) + getBonusDamage(this.world);

    this.pulse(pT.x, pT.y, radius, damage);

    // Extra waves from Quantité — staggered 50ms, same damage, cascading radii
    const extra = getQuantityBonus(this.world);
    for (let i = 1; i <= extra; i++) {
      const waveRadius = radius * (0.7 + i * 0.15);
      setTimeout(() => {
        const p2 = this.world.query(["PlayerTag", "Transform"]);
        if (p2.length === 0) return;
        const pt2 = this.world.getComponent<Transform>(p2[0], "Transform")!;
        this.pulse(pt2.x, pt2.y, waveRadius, damage);
      }, i * 50);
    }
  }

  private pulse(cx: number, cy: number, radius: number, damage: number): void {
    const enemies = this.world.query(["EnemyTag", "Transform"]);

    for (const entity of enemies) {
      if (!this.world.isAlive(entity)) continue;

      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const dx = t.x - cx;
      const dy = t.y - cy;

      if (dx * dx + dy * dy <= radius * radius) {
        damageEnemy(this.world, this.stage, entity, damage, t.x, t.y);
      }
    }

    this.drawPulse(cx, cy, radius);
  }

  private drawPulse(cx: number, cy: number, maxRadius: number): void {
    const g = new Graphics();
    this.stage.addChild(g);

    const duration = PULSE_FLASH_DURATION * 1000 * 1.5; // slightly longer for expansion
    const start = performance.now();

    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      if (t >= 1) {
        g.removeFromParent();
        g.destroy();
        return;
      }

      const r = maxRadius * t;
      const w = 6 * (1 - t) + 1;
      const alpha = 1 - t * 0.7;

      g.clear();
      g.circle(cx, cy, r).stroke({ color: PULSE_COLOR, width: w, alpha });
      g.circle(cx, cy, r * 0.9).fill({ color: PULSE_COLOR, alpha: 0.06 * (1 - t) });
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}

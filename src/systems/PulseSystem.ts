import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult, getQuantityBonus } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playPulse } from "../core/Audio";
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
  private pendingPulses: Array<{ delay: number; radius: number; damage: number }> = [];
  private activeRings: Array<{ g: Graphics; cx: number; cy: number; maxRadius: number; life: number; maxLife: number }> = [];

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  update(dt: number): void {
    // Tick active pulse rings (ticker-driven, no rAF)
    for (let i = this.activeRings.length - 1; i >= 0; i--) {
      const ring = this.activeRings[i];
      ring.life -= dt;
      if (ring.life <= 0) {
        ring.g.removeFromParent(); ring.g.destroy();
        this.activeRings.splice(i, 1);
      } else {
        const t = 1 - ring.life / ring.maxLife;
        const r = ring.maxRadius * t;
        const w = 6 * (1 - t) + 1;
        const alpha = 1 - t * 0.7;
        ring.g.clear();
        ring.g.circle(ring.cx, ring.cy, r).stroke({ color: PULSE_COLOR, width: w, alpha });
        ring.g.circle(ring.cx, ring.cy, r * 0.9).fill({ color: PULSE_COLOR, alpha: 0.06 * (1 - t) });
      }
    }

    // Process pending delayed pulses
    for (let i = this.pendingPulses.length - 1; i >= 0; i--) {
      this.pendingPulses[i].delay -= dt;
      if (this.pendingPulses[i].delay <= 0) {
        const p = this.pendingPulses.splice(i, 1)[0];
        const players = this.world.query(["PlayerTag", "Transform"]);
        if (players.length > 0) {
          const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
          this.pulse(pT.x, pT.y, p.radius, p.damage);
        }
      }
    }

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

    // --- NOVA evolution: massive explosion with knockback ---
    if (hasEvolution(this.world, "nova")) {
      const novaRadius = radius * 2;
      const novaDamage = damage * 3;
      playPulse();
      this.novaPulse(pT.x, pT.y, novaRadius, novaDamage);
      this.drawPulse(pT.x, pT.y, novaRadius);
      return;
    }

    // --- Normal pulse ---
    playPulse();
    this.pulse(pT.x, pT.y, radius, damage);

    // Queue extra waves from Quantité
    const extra = getQuantityBonus(this.world);
    for (let i = 1; i <= extra; i++) {
      this.pendingPulses.push({ delay: i * 0.05, radius: radius * (0.7 + i * 0.15), damage });
    }
  }

  /** Nova: damage + knockback enemies away from center */
  private novaPulse(cx: number, cy: number, radius: number, damage: number): void {
    const enemies = this.world.query(["EnemyTag", "Transform"]);

    for (const entity of enemies) {
      if (!this.world.isAlive(entity)) continue;

      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const dx = t.x - cx;
      const dy = t.y - cy;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radius * radius && distSq > 0) {
        damageEnemy(this.world, this.stage, entity, damage, t.x, t.y);

        // Knockback: push enemy away from explosion center
        if (this.world.isAlive(entity)) {
          const dist = Math.sqrt(distSq);
          const knockback = 120 * (1 - dist / radius);
          t.x += (dx / dist) * knockback;
          t.y += (dy / dist) * knockback;
        }
      }
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
    const life = PULSE_FLASH_DURATION * 1.5;
    this.activeRings.push({ g, cx, cy, maxRadius, life, maxLife: life });
  }
}

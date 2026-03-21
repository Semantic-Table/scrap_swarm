import type { System, Entity } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult, getQuantityBonus } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playTesla } from "../core/Audio";
import {
  TESLA_COOLDOWN,
  TESLA_RANGE,
  TESLA_CHAIN_RANGE,
  TESLA_BASE_BOUNCES,
  TESLA_DAMAGE,
  TESLA_COLOR,
  TESLA_FLASH_DURATION,
} from "../config/constants";

export class TeslaSystem implements System {
  readonly name = "TeslaSystem";
  private world: World;
  private stage: Container;
  private timer = 0;
  private stormSoundTimer = 0;
  private pendingChains: Array<{ delay: number; bounces: number; damage: number }> = [];
  private activeLightning: Array<{ g: Graphics; remaining: number }> = [];

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  update(dt: number): void {
    // Process lightning fade-out
    for (let i = this.activeLightning.length - 1; i >= 0; i--) {
      this.activeLightning[i].remaining -= dt;
      if (this.activeLightning[i].remaining <= 0) {
        const { g } = this.activeLightning.splice(i, 1)[0];
        g.removeFromParent();
        g.destroy();
      }
    }

    // Process pending delayed chains
    for (let i = this.pendingChains.length - 1; i >= 0; i--) {
      this.pendingChains[i].delay -= dt;
      if (this.pendingChains[i].delay <= 0) {
        const p = this.pendingChains.splice(i, 1)[0];
        const players = this.world.query(["PlayerTag", "Transform"]);
        if (players.length > 0) {
          const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
          this.fireChain(pT.x, pT.y, p.bounces, p.damage);
        }
      }
    }

    const level = getItemLevel(this.world, "tesla");
    if (level <= 0) return;

    this.timer -= dt;
    if (this.timer > 0) return;

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const damage = TESLA_DAMAGE + Math.floor((level - 1) / 2) + getBonusDamage(this.world);

    // --- STORM evolution: persistent field hitting all enemies in range ---
    if (hasEvolution(this.world, "storm")) {
      this.timer = 0.3 * getCooldownMult(this.world); // tick every 0.3s
      this.stormSoundTimer -= this.timer;
      // Play sound at most once per ~0.6s to avoid audio spam during Storm
      if (this.stormSoundTimer <= 0) {
        playTesla();
        this.stormSoundTimer = 0.6;
      }
      const stormRange = TESLA_RANGE * getRangeMult(this.world) * 1.3;
      this.stormField(pT.x, pT.y, stormRange, Math.max(1, Math.floor(damage * 0.5)));
      return;
    }

    // --- Normal tesla ---
    this.timer = TESLA_COOLDOWN * getCooldownMult(this.world);
    const bounces = TESLA_BASE_BOUNCES + (level - 1);

    playTesla();
    this.fireChain(pT.x, pT.y, bounces, damage);

    // Queue extra chains from Quantité
    const extra = getQuantityBonus(this.world);
    for (let i = 1; i <= extra; i++) {
      this.pendingChains.push({ delay: i * 0.05, bounces, damage });
    }
  }

  private stormField(cx: number, cy: number, range: number, damage: number): void {
    const enemies = this.world.query(["EnemyTag", "Transform"]);
    const hitPoints: { x: number; y: number }[] = [{ x: cx, y: cy }];

    for (const entity of enemies) {
      if (!this.world.isAlive(entity)) continue;
      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const dx = t.x - cx;
      const dy = t.y - cy;
      if (dx * dx + dy * dy <= range * range) {
        damageEnemy(this.world, this.stage, entity, damage, t.x, t.y);
        hitPoints.push({ x: t.x, y: t.y });
      }
    }

    // Visual: draw lightning to all hit enemies
    if (hitPoints.length > 1) {
      this.drawLightning(hitPoints);
    }
  }

  private fireChain(startX: number, startY: number, maxBounces: number, damage: number): void {
    const enemies = this.world.query(["EnemyTag", "Transform"]);
    const hit = new Set<Entity>();
    const chainPoints: { x: number; y: number }[] = [{ x: startX, y: startY }];

    let fromX = startX;
    let fromY = startY;
    const rangeMult = getRangeMult(this.world);
    let range = TESLA_RANGE * rangeMult;

    for (let i = 0; i < maxBounces; i++) {
      const target = this.findClosest(fromX, fromY, range, enemies, hit);
      if (!target) break;

      hit.add(target.entity);
      chainPoints.push({ x: target.x, y: target.y });

      damageEnemy(this.world, this.stage, target.entity, damage, target.x, target.y);

      fromX = target.x;
      fromY = target.y;
      range = TESLA_CHAIN_RANGE * rangeMult;
    }

    if (chainPoints.length > 1) {
      this.drawLightning(chainPoints);
    }
  }

  private findClosest(
    x: number,
    y: number,
    range: number,
    enemies: Entity[],
    exclude: Set<Entity>,
  ): { entity: Entity; x: number; y: number } | null {
    let closest: { entity: Entity; x: number; y: number } | null = null;
    let closestDistSq = range * range;

    for (const entity of enemies) {
      if (exclude.has(entity) || !this.world.isAlive(entity)) continue;

      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const dx = t.x - x;
      const dy = t.y - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = { entity, x: t.x, y: t.y };
      }
    }

    return closest;
  }

  private drawLightning(points: { x: number; y: number }[]): void {
    const g = new Graphics();

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];

      g.moveTo(from.x, from.y);

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const segments = 5;

      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        let px = from.x + dx * t;
        let py = from.y + dy * t;

        if (s < segments) {
          const jitter = 15;
          px += (Math.random() - 0.5) * jitter;
          py += (Math.random() - 0.5) * jitter;
        }

        g.lineTo(px, py);
      }
    }

    g.stroke({ color: TESLA_COLOR, width: 3, alpha: 0.9 });

    for (let i = 0; i < points.length - 1; i++) {
      g.moveTo(points[i].x, points[i].y);
      g.lineTo(points[i + 1].x, points[i + 1].y);
    }
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.6 });

    this.stage.addChild(g);
    this.activeLightning.push({ g, remaining: TESLA_FLASH_DURATION });
  }
}

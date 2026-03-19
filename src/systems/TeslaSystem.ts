import type { System, Entity } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult, getQuantityBonus } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
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

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  update(dt: number): void {
    const level = getItemLevel(this.world, "tesla");
    if (level <= 0) return;

    this.timer -= dt;
    if (this.timer > 0) return;

    this.timer = TESLA_COOLDOWN * getCooldownMult(this.world);

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const bounces = TESLA_BASE_BOUNCES + (level - 1);
    const damage = TESLA_DAMAGE + Math.floor((level - 1) / 2) + getBonusDamage(this.world);
    const extra = getQuantityBonus(this.world);

    // Base chain
    this.fireChain(pT.x, pT.y, bounces, damage);

    // Extra chains from Quantité — staggered 50ms apart
    for (let i = 1; i <= extra; i++) {
      setTimeout(() => {
        const players2 = this.world.query(["PlayerTag", "Transform"]);
        if (players2.length === 0) return;
        const pT2 = this.world.getComponent<Transform>(players2[0], "Transform")!;
        this.fireChain(pT2.x, pT2.y, bounces, damage);
      }, i * 50);
    }
  }

  private fireChain(startX: number, startY: number, maxBounces: number, damage: number): void {
    const enemies = this.world.query(["EnemyTag", "Transform"]);
    const hit = new Set<Entity>();
    const chainPoints: { x: number; y: number }[] = [{ x: startX, y: startY }];

    let fromX = startX;
    let fromY = startY;
    let range = TESLA_RANGE * getRangeMult(this.world);

    for (let i = 0; i < maxBounces; i++) {
      const target = this.findClosest(fromX, fromY, range, enemies, hit);
      if (!target) break;

      hit.add(target.entity);
      chainPoints.push({ x: target.x, y: target.y });

      damageEnemy(this.world, this.stage, target.entity, damage, target.x, target.y);

      fromX = target.x;
      fromY = target.y;
      range = TESLA_CHAIN_RANGE;
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

    setTimeout(() => {
      g.removeFromParent();
      g.destroy();
    }, TESLA_FLASH_DURATION * 1000);
  }
}

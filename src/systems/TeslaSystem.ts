import type { System, Entity } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Health } from "../components/Health";
import type { EnemyType } from "../components/EnemyType";
import type { Sprite } from "../components/Sprite";
import type { WaveState } from "../components/Wave";
import type { Application } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel } from "../core/UpgradeEffects";
import { createTransform } from "../components/Transform";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createScrapTag } from "../components/Scrap";
import {
  TESLA_COOLDOWN,
  TESLA_RANGE,
  TESLA_CHAIN_RANGE,
  TESLA_BASE_BOUNCES,
  TESLA_DAMAGE,
  TESLA_COLOR,
  TESLA_FLASH_DURATION,
  SCRAP_SIZE,
  SCRAP_COLOR,
} from "../config/constants";

export class TeslaSystem implements System {
  readonly name = "TeslaSystem";
  private world: World;
  private app: Application;
  private timer = 0;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
  }

  update(dt: number): void {
    const level = getItemLevel(this.world, "tesla");
    if (level <= 0) return;

    this.timer -= dt;
    if (this.timer > 0) return;

    this.timer = TESLA_COOLDOWN;

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const bounces = TESLA_BASE_BOUNCES + (level - 1);
    const damage = TESLA_DAMAGE + Math.floor((level - 1) / 2);

    this.fireChain(pT.x, pT.y, bounces, damage);
  }

  private fireChain(startX: number, startY: number, maxBounces: number, damage: number): void {
    const enemies = this.world.query(["EnemyTag", "Transform"]);
    const hit = new Set<Entity>();
    const chainPoints: { x: number; y: number }[] = [{ x: startX, y: startY }];

    let fromX = startX;
    let fromY = startY;
    let range = TESLA_RANGE;

    for (let i = 0; i < maxBounces; i++) {
      const target = this.findClosest(fromX, fromY, range, enemies, hit);
      if (!target) break;

      hit.add(target.entity);
      chainPoints.push({ x: target.x, y: target.y });

      // Apply damage
      this.damageEnemy(target.entity, damage, target.x, target.y);

      fromX = target.x;
      fromY = target.y;
      range = TESLA_CHAIN_RANGE;
    }

    // Draw lightning visual
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

  private damageEnemy(entity: Entity, damage: number, x: number, y: number): void {
    const health = this.world.getComponent<Health>(entity, "Health");
    if (!health) return;

    health.current -= damage;

    if (health.current <= 0) {
      // Drop scrap
      const enemyType = this.world.getComponent<EnemyType>(entity, "EnemyType");
      const scrapCount = enemyType ? enemyType.scrapDrop : 1;
      for (let i = 0; i < scrapCount; i++) {
        const offsetX = scrapCount > 1 ? (Math.random() - 0.5) * 20 : 0;
        const offsetY = scrapCount > 1 ? (Math.random() - 0.5) * 20 : 0;
        this.spawnScrap(x + offsetX, y + offsetY);
      }

      // Decrement wave alive counter
      const managers = this.world.query(["WaveState"]);
      if (managers.length > 0) {
        const wave = this.world.getComponent<WaveState>(managers[0], "WaveState")!;
        wave.enemiesAlive = Math.max(0, wave.enemiesAlive - 1);
      }

      // Destroy
      const sprite = this.world.getComponent<Sprite>(entity, "Sprite");
      if (sprite) {
        this.app.stage.removeChild(sprite.graphic);
        sprite.graphic.destroy();
      }
      this.world.destroyEntity(entity);
    } else {
      // Flash
      const sprite = this.world.getComponent<Sprite>(entity, "Sprite");
      if (sprite) {
        sprite.graphic.alpha = 0.5;
        setTimeout(() => {
          if (this.world.isAlive(entity)) sprite.graphic.alpha = 1;
        }, 80);
      }
    }
  }

  private spawnScrap(x: number, y: number): void {
    const entity = this.world.createEntity();
    const graphic = new Graphics()
      .rect(-SCRAP_SIZE, -SCRAP_SIZE, SCRAP_SIZE * 2, SCRAP_SIZE * 2)
      .fill(SCRAP_COLOR);
    graphic.rotation = Math.PI / 4;
    this.app.stage.addChild(graphic);

    this.world.addComponent(entity, createTransform(x, y));
    this.world.addComponent(entity, createSprite(graphic));
    this.world.addComponent(entity, createCollider(SCRAP_SIZE));
    this.world.addComponent(entity, createScrapTag());
  }

  private drawLightning(points: { x: number; y: number }[]): void {
    const g = new Graphics();

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];

      // Main bolt
      g.moveTo(from.x, from.y);

      // Add jagged segments for lightning effect
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const segments = 5;

      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        let px = from.x + dx * t;
        let py = from.y + dy * t;

        // Add random offset (except for last point)
        if (s < segments) {
          const jitter = 15;
          px += (Math.random() - 0.5) * jitter;
          py += (Math.random() - 0.5) * jitter;
        }

        g.lineTo(px, py);
      }
    }

    g.stroke({ color: TESLA_COLOR, width: 3, alpha: 0.9 });

    // Thinner bright core
    for (let i = 0; i < points.length - 1; i++) {
      g.moveTo(points[i].x, points[i].y);
      g.lineTo(points[i + 1].x, points[i + 1].y);
    }
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.6 });

    this.app.stage.addChild(g);

    // Remove after flash
    setTimeout(() => {
      this.app.stage.removeChild(g);
      g.destroy();
    }, TESLA_FLASH_DURATION * 1000);
  }
}

import type { World } from "../ecs/World";
import type { Entity } from "../ecs/types";
import type { Sprite } from "../components/Sprite";
import type { Health } from "../components/Health";
import type { EnemyType } from "../components/EnemyType";
import type { WaveState } from "../components/Wave";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createScrapTag } from "../components/Scrap";
import { createHealthPickupTag } from "../components/HealthPickup";
import {
  SCRAP_SIZE, SCRAP_COLOR, ENEMY_TYPES,
  HEALTH_DROP_CHANCE, HEALTH_PICKUP_SIZE, HEALTH_PICKUP_COLOR, HEALTH_PICKUP_HEAL,
} from "../config/constants";
import { triggerShake } from "./ScreenShake";
import { spawnDeathParticles, spawnKillFlash, registerKill } from "./Particles";
import { triggerHitStop } from "./HitStop";

/**
 * Damage an enemy. Returns true if the enemy died.
 */
export function damageEnemy(
  world: World,
  stage: Container,
  entity: Entity,
  damage: number,
  x: number,
  y: number,
): boolean {
  const health = world.getComponent<Health>(entity, "Health");
  if (!health) return false;

  health.current -= damage;

  if (health.current <= 0) {
    killEnemy(world, stage, entity, x, y);
    return true;
  }

  // Flash feedback
  const sprite = world.getComponent<Sprite>(entity, "Sprite");
  if (sprite) {
    sprite.graphic.alpha = 0.5;
    setTimeout(() => {
      if (world.isAlive(entity)) sprite.graphic.alpha = 1;
    }, 80);
  }
  return false;
}

/** Full kill sequence: scrap drop, particles, shake, sprite cleanup, entity destroy */
export function killEnemy(
  world: World,
  stage: Container,
  entity: Entity,
  x: number,
  y: number,
): void {
  const isDestructible = world.hasComponent(entity, "DestructibleTag");
  const enemyType = world.getComponent<EnemyType>(entity, "EnemyType");

  if (isDestructible) {
    // Destructible props always drop a health pickup
    spawnDeathParticles(stage, x, y, 0x7a6840, 4);
    spawnKillFlash(stage, x, y, 14);
    triggerShake(2, 0.06);
    spawnHealthPickup(world, stage, x, y);
  } else {
    const scrapCount = enemyType ? enemyType.scrapDrop : 1;

    // Death particles + kill flash
    const color = enemyType ? ENEMY_TYPES[enemyType.name].color : 0xc0392b;
    const size = enemyType ? ENEMY_TYPES[enemyType.name].size : 16;
    spawnDeathParticles(stage, x, y, color);
    spawnKillFlash(stage, x, y, size);

    // Screen shake — stronger for tanks
    if (enemyType?.name === "tank") {
      triggerShake(8, 0.15);
      triggerHitStop(0.08, 0.05);
    } else {
      triggerShake(3, 0.08);
    }

    // Multi-kill tracking
    registerKill();

    // Spawn scrap
    for (let i = 0; i < scrapCount; i++) {
      const offsetX = scrapCount > 1 ? (Math.random() - 0.5) * 20 : 0;
      const offsetY = scrapCount > 1 ? (Math.random() - 0.5) * 20 : 0;
      spawnScrap(world, stage, x + offsetX, y + offsetY);
    }

    // Health pickup: 4% chance but only when player HP below 50%
    const players = world.query(["PlayerTag", "Health"]);
    if (players.length > 0) {
      const pH = world.getComponent<Health>(players[0], "Health");
      if (pH && pH.current < pH.max * 0.5 && Math.random() < HEALTH_DROP_CHANCE) {
        spawnHealthPickup(world, stage, x, y);
      }
    }

    // Decrement wave alive counter + track kills by type
    const managers = world.query(["WaveState"]);
    if (managers.length > 0) {
      const wave = world.getComponent<WaveState>(managers[0], "WaveState")!;
      wave.enemiesAlive = Math.max(0, wave.enemiesAlive - 1);
      wave.totalKills++;
      if (enemyType) {
        wave.killsByType[enemyType.name] = (wave.killsByType[enemyType.name] ?? 0) + 1;
      }
    }
  }

  // Cleanup sprite + destroy entity
  const sprite = world.getComponent<Sprite>(entity, "Sprite");
  if (sprite) {
    sprite.graphic.removeFromParent();
    sprite.graphic.destroy();
  }
  world.destroyEntity(entity);
}

function spawnScrap(world: World, stage: Container, x: number, y: number): void {
  const entity = world.createEntity();
  const graphic = new Graphics()
    .rect(-SCRAP_SIZE, -SCRAP_SIZE, SCRAP_SIZE * 2, SCRAP_SIZE * 2)
    .fill(SCRAP_COLOR);
  graphic.rotation = Math.PI / 4;
  stage.addChild(graphic);

  world.addComponent(entity, createTransform(x, y));
  world.addComponent(entity, createSprite(graphic));
  world.addComponent(entity, createCollider(SCRAP_SIZE));
  world.addComponent(entity, createScrapTag());
}

function spawnHealthPickup(world: World, stage: Container, x: number, y: number): void {
  const entity = world.createEntity();
  const s = HEALTH_PICKUP_SIZE;

  const graphic = new Graphics();
  // Green cross
  graphic.rect(-s, -s * 0.3, s * 2, s * 0.6).fill(HEALTH_PICKUP_COLOR);
  graphic.rect(-s * 0.3, -s, s * 0.6, s * 2).fill(HEALTH_PICKUP_COLOR);
  // Bright center
  graphic.circle(0, 0, s * 0.25).fill(0xffffff);
  stage.addChild(graphic);

  world.addComponent(entity, createTransform(x, y));
  world.addComponent(entity, createSprite(graphic));
  world.addComponent(entity, createCollider(s));
  world.addComponent(entity, createHealthPickupTag(HEALTH_PICKUP_HEAL));
}

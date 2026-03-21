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
  SCRAP_SIZE, ENEMY_TYPES,
  HEALTH_DROP_CHANCE, HEALTH_PICKUP_SIZE, HEALTH_PICKUP_COLOR, HEALTH_PICKUP_HEAL,
} from "../config/constants";
import { triggerShake } from "./ScreenShake";
import { spawnDeathParticles, spawnKillFlash, registerKill, spawnShockwave, spawnDamageNumber } from "./Particles";
import { triggerHitStop } from "./HitStop";
import { playKill } from "./Audio";
import { getItemLevel } from "./UpgradeEffects";

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

  // Crit chance from Overclock passive (5% per level)
  const critLevel = getItemLevel(world, "crit");
  const isCrit = critLevel > 0 && Math.random() < critLevel * 0.05;
  const finalDamage = isCrit ? damage * 2 : damage;

  health.current -= finalDamage;

  // Floating damage number for big hits
  if (finalDamage >= 2) {
    const enemyType = world.getComponent<EnemyType>(entity, "EnemyType");
    const color = enemyType ? ENEMY_TYPES[enemyType.name].color : 0xffffff;
    spawnDamageNumber(stage, x, y - 10, finalDamage, color);
  }

  if (health.current <= 0) {
    killEnemy(world, stage, entity, x, y);
    return true;
  }

  // Flash + scale-pop feedback — driven by RenderSystem
  health.flashTimer = 0.08;
  health.hitScale = 1.3;
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

  const isCache = world.hasComponent(entity, "CacheTag");
  const isBoss = world.hasComponent(entity, "BossTag");

  // Clear queenActive flag when queen dies
  if (isBoss) {
    const bossTag = world.getComponent<{ type: string; bossType: string }>(entity, "BossTag");
    if (bossTag?.bossType === "queen") {
      const mgrs = world.query(["WaveState"]);
      if (mgrs.length > 0) {
        world.getComponent<WaveState>(mgrs[0], "WaveState")!.queenActive = false;
      }
    }
  }

  if (isCache) {
    // Cache burst — lots of scrap + magnet pulse
    spawnDeathParticles(stage, x, y, 0xb8860b, 12);
    spawnKillFlash(stage, x, y, 22);
    triggerShake(6, 0.15);
    registerKill();
    for (let i = 0; i < 15; i++) {
      const angle = (Math.PI * 2 / 15) * i;
      const ox = Math.cos(angle) * 30;
      const oy = Math.sin(angle) * 30;
      spawnScrap(world, stage, x + ox, y + oy);
    }
    const mgrs = world.query(["WaveState"]);
    if (mgrs.length > 0) {
      const wave = world.getComponent<WaveState>(mgrs[0], "WaveState")!;
      wave.magnetPulseTimer = 2.0;
      wave.totalKills++;
    }
  } else if (isDestructible) {
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
      spawnShockwave(stage, x, y, ENEMY_TYPES.tank.color);
      playKill(true);
    } else {
      triggerShake(3, 0.08);
      playKill(false);
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
  const s = SCRAP_SIZE * (0.7 + Math.random() * 0.6); // size variation
  const graphic = new Graphics();

  // Random scrap shape — irregular metal shard
  const variant = Math.floor(Math.random() * 3);
  const darkFill = 0x3a3a3a;
  const brightEdge = 0xd4a047;

  switch (variant) {
    case 0:
      // Hexagonal bolt
      graphic.poly([0, -s, s * 0.8, -s * 0.4, s * 0.8, s * 0.4, 0, s, -s * 0.8, s * 0.4, -s * 0.8, -s * 0.4]).fill(darkFill);
      graphic.poly([0, -s, s * 0.8, -s * 0.4, s * 0.8, s * 0.4, 0, s, -s * 0.8, s * 0.4, -s * 0.8, -s * 0.4]).stroke({ color: brightEdge, width: 1.5 });
      graphic.circle(0, 0, s * 0.25).fill(brightEdge);
      break;
    case 1:
      // Gear fragment
      graphic.rect(-s, -s * 0.35, s * 2, s * 0.7).fill(darkFill);
      graphic.rect(-s * 0.35, -s, s * 0.7, s * 2).fill(darkFill);
      graphic.rect(-s, -s * 0.35, s * 2, s * 0.7).stroke({ color: brightEdge, width: 1 });
      graphic.rect(-s * 0.35, -s, s * 0.7, s * 2).stroke({ color: brightEdge, width: 1 });
      graphic.circle(0, 0, s * 0.2).fill(0x555555);
      break;
    default:
      // Angular shard
      graphic.poly([-s * 0.3, -s, s * 0.6, -s * 0.6, s, s * 0.2, s * 0.2, s, -s, s * 0.4]).fill(darkFill);
      graphic.poly([-s * 0.3, -s, s * 0.6, -s * 0.6, s, s * 0.2, s * 0.2, s, -s, s * 0.4]).stroke({ color: brightEdge, width: 1 });
      break;
  }

  graphic.rotation = Math.random() * Math.PI * 2;
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

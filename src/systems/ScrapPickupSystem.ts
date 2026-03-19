import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { ScrapCollector } from "../components/ScrapCollector";
import type { Sprite } from "../components/Sprite";
import type { Health } from "../components/Health";
import type { HealthPickupTag } from "../components/HealthPickup";
import type { Container } from "pixi.js";
import { SCRAP_ATTRACT_SPEED, SCRAP_ATTRACT_RADIUS, PLAYER_SIZE } from "../config/constants";
import { getItemLevel } from "../core/UpgradeEffects";
import { spawnPickupBurst } from "../core/Particles";

/** Actual contact distance for pickup (player size + scrap size) */
const PICKUP_CONTACT = PLAYER_SIZE + 8;
const HEALTH_CONTACT = PLAYER_SIZE + 10;

export class ScrapPickupSystem implements System {
  readonly name = "ScrapPickupSystem";
  private world: World;
  private stage: Container;

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  update(dt: number): void {
    const players = this.world.query(["PlayerTag", "Transform", "ScrapCollector"]);
    if (players.length === 0) return;

    const pTransform = this.world.getComponent<Transform>(players[0], "Transform")!;
    const collector = this.world.getComponent<ScrapCollector>(players[0], "ScrapCollector")!;

    // Magnet: increases attract radius
    const magnetLevel = getItemLevel(this.world, "magnet");
    const attractRadius = SCRAP_ATTRACT_RADIUS + magnetLevel * 30;
    const attractSpeed = SCRAP_ATTRACT_SPEED * (1 + magnetLevel * 0.25);

    // Refiner: bonus scrap per pickup
    const refinerLevel = getItemLevel(this.world, "refiner");
    const bonusScrap = refinerLevel;

    // Health pickups — contact only, no attraction
    this.collectHealthPickups(pTransform, players[0]);

    const scraps = this.world.query(["ScrapTag", "Transform", "Collider"]);

    for (const scrap of scraps) {
      if (!this.world.isAlive(scrap)) continue;

      const sTransform = this.world.getComponent<Transform>(scrap, "Transform")!;

      const dx = pTransform.x - sTransform.x;
      const dy = pTransform.y - sTransform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Pickup: actual contact with player
      if (dist <= PICKUP_CONTACT) {
        collector.amount += 1 + bonusScrap;
        spawnPickupBurst(this.stage, sTransform.x, sTransform.y);
        this.removeEntity(scrap);
        continue;
      }

      // Attract: magnet pulls scrap toward player but doesn't collect
      if (dist <= attractRadius && dist > 0) {
        const dirX = dx / dist;
        const dirY = dy / dist;
        const pull = 1 - (dist / attractRadius);
        const speed = attractSpeed * (1 + pull * pull * 3);
        sTransform.x += dirX * speed * dt;
        sTransform.y += dirY * speed * dt;

        // Scale up scrap as it's pulled (anticipation)
        const sprite = this.world.getComponent<Sprite>(scrap, "Sprite");
        if (sprite) {
          const scale = 1 + pull * 0.5;
          sprite.graphic.scale.set(scale);
        }
      }
    }
  }

  private collectHealthPickups(pTransform: Transform, playerId: number): void {
    const pickups = this.world.query(["HealthPickupTag", "Transform"]);
    const health = this.world.getComponent<Health>(playerId, "Health");
    if (!health) return;

    for (const pickup of pickups) {
      if (!this.world.isAlive(pickup)) continue;

      const t = this.world.getComponent<Transform>(pickup, "Transform")!;
      const dx = pTransform.x - t.x;
      const dy = pTransform.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Contact only — walk over it to pick up
      if (dist <= HEALTH_CONTACT) {
        const tag = this.world.getComponent<HealthPickupTag>(pickup, "HealthPickupTag")!;
        health.current = Math.min(health.max, health.current + tag.healAmount);
        spawnPickupBurst(this.stage, t.x, t.y);
        this.removeEntity(pickup);
      }
    }
  }

  private removeEntity(entity: number): void {
    const sprite = this.world.getComponent<Sprite>(entity, "Sprite");
    if (sprite) {
      sprite.graphic.removeFromParent();
      sprite.graphic.destroy();
    }
    this.world.destroyEntity(entity);
  }
}

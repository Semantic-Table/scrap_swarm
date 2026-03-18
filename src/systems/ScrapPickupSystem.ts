import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { ScrapCollector } from "../components/ScrapCollector";
import type { Sprite } from "../components/Sprite";
import type { Application } from "pixi.js";
import { SCRAP_ATTRACT_SPEED, SCRAP_ATTRACT_RADIUS } from "../config/constants";
import { getItemLevel } from "../core/UpgradeEffects";

export class ScrapPickupSystem implements System {
  readonly name = "ScrapPickupSystem";
  private world: World;
  private app: Application;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
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
    const bonusScrap = refinerLevel; // +1 per level

    const scraps = this.world.query(["ScrapTag", "Transform", "Collider"]);

    for (const scrap of scraps) {
      if (!this.world.isAlive(scrap)) continue;

      const sTransform = this.world.getComponent<Transform>(scrap, "Transform")!;

      const dx = pTransform.x - sTransform.x;
      const dy = pTransform.y - sTransform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Pickup: close enough
      if (dist <= collector.pickupRadius) {
        collector.amount += 1 + bonusScrap;
        this.removeEntity(scrap);
        continue;
      }

      // Attract: move scrap toward player
      if (dist <= attractRadius && dist > 0) {
        const dirX = dx / dist;
        const dirY = dy / dist;
        sTransform.x += dirX * attractSpeed * dt;
        sTransform.y += dirY * attractSpeed * dt;
      }
    }
  }

  private removeEntity(entity: number): void {
    const sprite = this.world.getComponent<Sprite>(entity, "Sprite");
    if (sprite) {
      this.app.stage.removeChild(sprite.graphic);
      sprite.graphic.destroy();
    }
    this.world.destroyEntity(entity);
  }
}

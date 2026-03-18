import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Collider } from "../components/Collider";
import type { Sprite } from "../components/Sprite";
import type { Health } from "../components/Health";
import type { EnemyType } from "../components/EnemyType";
import type { WaveState } from "../components/Wave";
import type { Application } from "pixi.js";
import { Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createScrapTag } from "../components/Scrap";
import { SCRAP_SIZE, SCRAP_COLOR } from "../config/constants";

export class ProjectileHitSystem implements System {
  readonly name = "ProjectileHitSystem";
  private world: World;
  private app: Application;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
  }

  update(_dt: number): void {
    const projectiles = this.world.query(["ProjectileTag", "Transform", "Collider"]);
    const enemies = this.world.query(["EnemyTag", "Transform", "Collider"]);

    for (const proj of projectiles) {
      if (!this.world.isAlive(proj)) continue;
      const pT = this.world.getComponent<Transform>(proj, "Transform")!;
      const pC = this.world.getComponent<Collider>(proj, "Collider")!;

      for (const enemy of enemies) {
        if (!this.world.isAlive(enemy)) continue;

        const eT = this.world.getComponent<Transform>(enemy, "Transform")!;
        const eC = this.world.getComponent<Collider>(enemy, "Collider")!;

        const dx = pT.x - eT.x;
        const dy = pT.y - eT.y;
        const distSq = dx * dx + dy * dy;
        const minDist = pC.radius + eC.radius;

        if (distSq <= minDist * minDist) {
          // Destroy projectile
          this.removeEntity(proj);

          // Damage enemy
          const health = this.world.getComponent<Health>(enemy, "Health");
          if (health) {
            health.current -= 1;
            if (health.current <= 0) {
              this.killEnemy(enemy, eT.x, eT.y);
            } else {
              // Flash white feedback — briefly change alpha
              const sprite = this.world.getComponent<Sprite>(enemy, "Sprite");
              if (sprite) {
                sprite.graphic.alpha = 0.5;
                setTimeout(() => {
                  if (this.world.isAlive(enemy)) {
                    sprite.graphic.alpha = 1;
                  }
                }, 80);
              }
            }
          } else {
            // No health component — instant kill (legacy)
            this.killEnemy(enemy, eT.x, eT.y);
          }

          break;
        }
      }
    }
  }

  private killEnemy(entity: number, x: number, y: number): void {
    // Determine scrap drop amount
    const enemyType = this.world.getComponent<EnemyType>(entity, "EnemyType");
    const scrapCount = enemyType ? enemyType.scrapDrop : 1;

    // Spawn scrap(s) with slight spread
    for (let i = 0; i < scrapCount; i++) {
      const offsetX = scrapCount > 1 ? (Math.random() - 0.5) * 20 : 0;
      const offsetY = scrapCount > 1 ? (Math.random() - 0.5) * 20 : 0;
      this.spawnScrap(x + offsetX, y + offsetY);
    }

    this.decrementAlive();
    this.removeEntity(entity);
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

  private decrementAlive(): void {
    const managers = this.world.query(["WaveState"]);
    if (managers.length > 0) {
      const wave = this.world.getComponent<WaveState>(managers[0], "WaveState")!;
      wave.enemiesAlive = Math.max(0, wave.enemiesAlive - 1);
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

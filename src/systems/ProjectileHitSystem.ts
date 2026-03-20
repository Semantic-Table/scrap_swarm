import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Collider } from "../components/Collider";
import type { Sprite } from "../components/Sprite";
import type { Health } from "../components/Health";
import type { ProjectileTag } from "../components/Projectile";
import type { Container } from "pixi.js";
import { damageEnemy } from "../core/Combat";
import { getBonusDamage } from "../core/UpgradeEffects";

export class ProjectileHitSystem implements System {
  readonly name = "ProjectileHitSystem";
  private world: World;
  private stage: Container;

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
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
          // Read damage BEFORE destroying the projectile
          const projTag = this.world.getComponent<ProjectileTag>(proj, "ProjectileTag");
          const baseDmg = projTag ? projTag.damage : 1;

          // Destroy projectile
          const pSprite = this.world.getComponent<Sprite>(proj, "Sprite");
          if (pSprite) {
            pSprite.graphic.removeFromParent();
            pSprite.graphic.destroy();
          }
          this.world.destroyEntity(proj);

          // Damage enemy
          const health = this.world.getComponent<Health>(enemy, "Health");
          if (health) {
            damageEnemy(this.world, this.stage, enemy, baseDmg + getBonusDamage(this.world), eT.x, eT.y);
          }

          break;
        }
      }
    }
  }
}

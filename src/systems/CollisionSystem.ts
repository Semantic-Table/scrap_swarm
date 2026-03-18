import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Collider } from "../components/Collider";
import type { Shield } from "../components/Shield";
import type { Sprite } from "../components/Sprite";
import type { WaveState } from "../components/Wave";
import type { Application } from "pixi.js";

export type OnPlayerHitCallback = () => void;

export class CollisionSystem implements System {
  readonly name = "CollisionSystem";
  private world: World;
  private app: Application;
  private onPlayerHit: OnPlayerHitCallback;

  constructor(world: World, app: Application, onPlayerHit: OnPlayerHitCallback) {
    this.world = world;
    this.app = app;
    this.onPlayerHit = onPlayerHit;
  }

  update(_dt: number): void {
    const players = this.world.query(["PlayerTag", "Transform", "Collider"]);
    if (players.length === 0) return;

    const playerId = players[0];
    const pTransform = this.world.getComponent<Transform>(playerId, "Transform")!;
    const pCollider = this.world.getComponent<Collider>(playerId, "Collider")!;

    const enemies = this.world.query(["EnemyTag", "Transform", "Collider"]);

    for (const enemy of enemies) {
      if (!this.world.isAlive(enemy)) continue;

      const eTransform = this.world.getComponent<Transform>(enemy, "Transform")!;
      const eCollider = this.world.getComponent<Collider>(enemy, "Collider")!;

      const dx = pTransform.x - eTransform.x;
      const dy = pTransform.y - eTransform.y;
      const distSq = dx * dx + dy * dy;
      const minDist = pCollider.radius + eCollider.radius;

      if (distSq <= minDist * minDist) {
        // Try shield first
        const shield = this.world.getComponent<Shield>(playerId, "Shield");
        if (shield && shield.charges > 0) {
          shield.charges--;
          shield.rechargeTimer = shield.rechargeCooldown;

          // Destroy the enemy that hit us
          const sprite = this.world.getComponent<Sprite>(enemy, "Sprite");
          if (sprite) {
            this.app.stage.removeChild(sprite.graphic);
            sprite.graphic.destroy();
          }
          this.world.destroyEntity(enemy);

          // Decrement wave counter
          const managers = this.world.query(["WaveState"]);
          if (managers.length > 0) {
            const wave = this.world.getComponent<WaveState>(managers[0], "WaveState")!;
            wave.enemiesAlive = Math.max(0, wave.enemiesAlive - 1);
          }

          // Flash player to indicate shield absorbed
          const playerSprite = this.world.getComponent<Sprite>(playerId, "Sprite");
          if (playerSprite) {
            playerSprite.graphic.alpha = 0.3;
            setTimeout(() => {
              if (this.world.isAlive(playerId)) {
                playerSprite.graphic.alpha = 1;
              }
            }, 200);
          }
          continue;
        }

        this.onPlayerHit();
        return;
      }
    }
  }
}

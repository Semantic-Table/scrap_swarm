import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Collider } from "../components/Collider";
import type { Shield } from "../components/Shield";
import type { Health } from "../components/Health";
import type { Sprite } from "../components/Sprite";
import type { Container } from "pixi.js";
import { triggerShake } from "../core/ScreenShake";
import { killEnemy, damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { PLAYER_INVINCIBILITY, SWORD_RANGE, SWORD_DAMAGE } from "../config/constants";
import { getBonusDamage } from "../core/UpgradeEffects";

export type OnPlayerHitCallback = () => void;

export class CollisionSystem implements System {
  readonly name = "CollisionSystem";
  private world: World;
  private stage: Container;
  private onPlayerDeath: OnPlayerHitCallback;
  private invincibilityTimer = 0;
  private dead = false;

  constructor(world: World, stage: Container, onPlayerDeath: OnPlayerHitCallback) {
    this.world = world;
    this.stage = stage;
    this.onPlayerDeath = onPlayerDeath;
  }

  update(dt: number): void {
    if (this.invincibilityTimer > 0) {
      this.invincibilityTimer -= dt;
    }

    const players = this.world.query(["PlayerTag", "Transform", "Collider"]);
    if (players.length === 0) return;

    const playerId = players[0];
    const pTransform = this.world.getComponent<Transform>(playerId, "Transform")!;
    const pCollider = this.world.getComponent<Collider>(playerId, "Collider")!;

    // Blink during invincibility
    const playerSprite = this.world.getComponent<Sprite>(playerId, "Sprite");
    if (playerSprite) {
      if (this.invincibilityTimer > 0) {
        playerSprite.graphic.alpha = Math.sin(this.invincibilityTimer * 20) > 0 ? 1 : 0.3;
      } else {
        playerSprite.graphic.alpha = 1;
      }
    }

    // Skip damage checks during invincibility
    if (this.invincibilityTimer > 0) return;

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
        // Try shield first — enemy dies and drops scrap
        const shield = this.world.getComponent<Shield>(playerId, "Shield");
        if (shield && shield.charges > 0) {
          shield.charges--;
          shield.rechargeTimer = shield.rechargeCooldown;

          killEnemy(this.world, this.stage, enemy, eTransform.x, eTransform.y);
          triggerShake(6, 0.15);
          this.invincibilityTimer = PLAYER_INVINCIBILITY * 0.5;

          // COUNTER STRIKE evolution: 360° slash on shield absorb
          if (hasEvolution(this.world, "counter_strike")) {
            this.counterSlash(pTransform.x, pTransform.y);
          }
          continue;
        }

        // Take HP damage — enemy dies and drops scrap
        killEnemy(this.world, this.stage, enemy, eTransform.x, eTransform.y);
        if (this.takeDamage(playerId, 1)) return;
        continue;
      }
    }

    // Enemy projectiles vs player
    const eProjectiles = this.world.query(["EnemyProjectileTag", "Transform", "Collider"]);
    for (const proj of eProjectiles) {
      if (!this.world.isAlive(proj)) continue;

      const projT = this.world.getComponent<Transform>(proj, "Transform")!;
      const projC = this.world.getComponent<Collider>(proj, "Collider")!;

      const dx = pTransform.x - projT.x;
      const dy = pTransform.y - projT.y;
      const distSq = dx * dx + dy * dy;
      const minDist = pCollider.radius + projC.radius;

      if (distSq <= minDist * minDist) {
        // Destroy projectile
        const sprite = this.world.getComponent<Sprite>(proj, "Sprite");
        if (sprite) {
          sprite.graphic.removeFromParent();
          sprite.graphic.destroy();
        }
        this.world.destroyEntity(proj);

        // Try shield
        const shield = this.world.getComponent<Shield>(playerId, "Shield");
        if (shield && shield.charges > 0) {
          shield.charges--;
          shield.rechargeTimer = shield.rechargeCooldown;
          triggerShake(4, 0.1);
          this.invincibilityTimer = PLAYER_INVINCIBILITY * 0.3;
          continue;
        }

        if (this.takeDamage(playerId, 1)) return;
      }
    }
  }

  /** Counter Strike: 360° damage around player on shield absorb */
  private counterSlash(cx: number, cy: number): void {
    const range = SWORD_RANGE * 1.5;
    const damage = (SWORD_DAMAGE + getBonusDamage(this.world)) * 2;
    const nearbyEnemies = this.world.query(["EnemyTag", "Transform"]);

    for (const e of nearbyEnemies) {
      if (!this.world.isAlive(e)) continue;
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      const dx = t.x - cx;
      const dy = t.y - cy;
      if (dx * dx + dy * dy <= range * range) {
        damageEnemy(this.world, this.stage, e, damage, t.x, t.y);
      }
    }
    triggerShake(10, 0.2);
  }

  /** Returns true if player died */
  private takeDamage(playerId: number, amount: number): boolean {
    const health = this.world.getComponent<Health>(playerId, "Health");
    if (health) {
      health.current -= amount;
      if (health.current <= 0) {
        if (this.dead) return true;
        this.dead = true;
        triggerShake(12, 0.3);
        this.onPlayerDeath();
        return true;
      }
    }

    triggerShake(8, 0.2);
    this.invincibilityTimer = PLAYER_INVINCIBILITY;
    return false;
  }
}

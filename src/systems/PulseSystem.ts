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
  PULSE_COOLDOWN,
  PULSE_RADIUS,
  PULSE_DAMAGE,
  PULSE_COLOR,
  PULSE_FLASH_DURATION,
  SCRAP_SIZE,
  SCRAP_COLOR,
} from "../config/constants";

export class PulseSystem implements System {
  readonly name = "PulseSystem";
  private world: World;
  private app: Application;
  private timer = 0;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
  }

  update(dt: number): void {
    const level = getItemLevel(this.world, "pulse");
    if (level <= 0) return;

    this.timer -= dt;
    if (this.timer > 0) return;

    this.timer = Math.max(0.8, PULSE_COOLDOWN - (level - 1) * 0.3);

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const radius = PULSE_RADIUS + (level - 1) * 20;
    const damage = PULSE_DAMAGE + Math.floor((level - 1) / 2);

    this.pulse(pT.x, pT.y, radius, damage);
  }

  private pulse(cx: number, cy: number, radius: number, damage: number): void {
    const enemies = this.world.query(["EnemyTag", "Transform"]);

    for (const entity of enemies) {
      if (!this.world.isAlive(entity)) continue;

      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const dx = t.x - cx;
      const dy = t.y - cy;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radius * radius) {
        this.damageEnemy(entity, damage, t.x, t.y);
      }
    }

    // Visual: expanding ring
    this.drawPulse(cx, cy, radius);
  }

  private damageEnemy(entity: Entity, damage: number, x: number, y: number): void {
    const health = this.world.getComponent<Health>(entity, "Health");
    if (!health) return;

    health.current -= damage;

    if (health.current <= 0) {
      const enemyType = this.world.getComponent<EnemyType>(entity, "EnemyType");
      const scrapCount = enemyType ? enemyType.scrapDrop : 1;
      for (let i = 0; i < scrapCount; i++) {
        const offsetX = scrapCount > 1 ? (Math.random() - 0.5) * 20 : 0;
        const offsetY = scrapCount > 1 ? (Math.random() - 0.5) * 20 : 0;
        this.spawnScrap(x + offsetX, y + offsetY);
      }

      const managers = this.world.query(["WaveState"]);
      if (managers.length > 0) {
        const wave = this.world.getComponent<WaveState>(managers[0], "WaveState")!;
        wave.enemiesAlive = Math.max(0, wave.enemiesAlive - 1);
      }

      const sprite = this.world.getComponent<Sprite>(entity, "Sprite");
      if (sprite) {
        this.app.stage.removeChild(sprite.graphic);
        sprite.graphic.destroy();
      }
      this.world.destroyEntity(entity);
    } else {
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

  private drawPulse(cx: number, cy: number, radius: number): void {
    const g = new Graphics();
    g.circle(cx, cy, radius).stroke({ color: PULSE_COLOR, width: 3, alpha: 0.7 });
    g.circle(cx, cy, radius * 0.6).stroke({ color: PULSE_COLOR, width: 1, alpha: 0.3 });
    this.app.stage.addChild(g);

    // Fade out
    const duration = PULSE_FLASH_DURATION * 1000;
    const start = performance.now();

    const fade = () => {
      const elapsed = performance.now() - start;
      const t = elapsed / duration;
      if (t >= 1) {
        this.app.stage.removeChild(g);
        g.destroy();
        return;
      }
      g.alpha = 1 - t;
      requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }
}

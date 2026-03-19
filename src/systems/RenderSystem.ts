import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Sprite } from "../components/Sprite";
import type { Health } from "../components/Health";
import type { Shield } from "../components/Shield";
import { Graphics } from "pixi.js";
import { PLAYER_SIZE } from "../config/constants";

const SHIELD_COLOR = 0x5dade2;
const SHIELD_BASE_RADIUS = PLAYER_SIZE + 14;
const SHIELD_LAYER_GAP = 6;

export class RenderSystem implements System {
  readonly name = "RenderSystem";
  private world: World;
  private elapsed = 0;
  private healthBar: Graphics | null = null;
  private shieldGraphic: Graphics | null = null;

  constructor(world: World) {
    this.world = world;
  }

  update(dt: number): void {
    this.elapsed += dt;

    const entities = this.world.query(["Transform", "Sprite"]);

    for (const entity of entities) {
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;
      const sprite = this.world.getComponent<Sprite>(entity, "Sprite")!;

      sprite.graphic.x = transform.x;
      sprite.graphic.y = transform.y;
      sprite.graphic.rotation = transform.rotation;
    }

    // Enemy swarm wobble — ±2px organic jitter
    const enemies = this.world.query(["EnemyTag", "Sprite", "Transform"]);
    for (const entity of enemies) {
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;
      const sprite = this.world.getComponent<Sprite>(entity, "Sprite")!;
      const phase = entity * 1.618;
      sprite.graphic.x = transform.x + Math.sin(this.elapsed * 7 + phase) * 1.5;
      sprite.graphic.y = transform.y + Math.cos(this.elapsed * 5.3 + phase) * 1.5;
    }

    // Scrap idle spin
    const scraps = this.world.query(["ScrapTag", "Sprite"]);
    for (const entity of scraps) {
      const sprite = this.world.getComponent<Sprite>(entity, "Sprite")!;
      sprite.graphic.rotation += dt * 2.5;
    }

    this.drawPlayerHealthBar();
    this.drawShieldLayers();
  }

  private drawPlayerHealthBar(): void {
    const players = this.world.query(["PlayerTag", "Transform", "Health", "Sprite"]);
    if (players.length === 0) return;

    const playerId = players[0];
    const transform = this.world.getComponent<Transform>(playerId, "Transform")!;
    const health = this.world.getComponent<Health>(playerId, "Health")!;
    const sprite = this.world.getComponent<Sprite>(playerId, "Sprite")!;

    if (health.current >= health.max) {
      if (this.healthBar) this.healthBar.visible = false;
      return;
    }

    if (!this.healthBar) {
      this.healthBar = new Graphics();
      if (sprite.graphic.parent) {
        sprite.graphic.parent.addChild(this.healthBar);
      }
    }
    this.healthBar.visible = true;

    const barW = PLAYER_SIZE * 2.2;
    const barH = 4;
    const barY = transform.y + PLAYER_SIZE + 8;
    const barX = transform.x - barW / 2;
    const ratio = Math.max(0, health.current / health.max);

    let color = 0x2ecc71;
    if (ratio < 0.6) color = 0xf1c40f;
    if (ratio < 0.3) color = 0xe74c3c;

    this.healthBar.clear();
    this.healthBar.roundRect(barX, barY, barW, barH, 2).fill({ color: 0x111111, alpha: 0.8 });
    if (ratio > 0) {
      this.healthBar.roundRect(barX, barY, barW * ratio, barH, 2).fill(color);
    }
  }

  private drawShieldLayers(): void {
    const players = this.world.query(["PlayerTag", "Transform", "Sprite"]);
    if (players.length === 0) return;

    const playerId = players[0];
    const shield = this.world.getComponent<Shield>(playerId, "Shield");
    const transform = this.world.getComponent<Transform>(playerId, "Transform")!;
    const sprite = this.world.getComponent<Sprite>(playerId, "Sprite")!;

    if (!shield || shield.maxCharges <= 0) {
      if (this.shieldGraphic) this.shieldGraphic.visible = false;
      return;
    }

    if (!this.shieldGraphic) {
      this.shieldGraphic = new Graphics();
      if (sprite.graphic.parent) {
        sprite.graphic.parent.addChild(this.shieldGraphic);
      }
    }
    this.shieldGraphic.visible = true;
    this.shieldGraphic.clear();

    const cx = transform.x;
    const cy = transform.y;

    for (let i = 0; i < shield.maxCharges; i++) {
      const radius = SHIELD_BASE_RADIUS + i * SHIELD_LAYER_GAP;
      const active = i < shield.charges;

      if (active) {
        // Active: visible pulsing ring
        const pulse = 1 + Math.sin(this.elapsed * 4 + i * 1.2) * 0.08;
        const r = radius * pulse;
        this.shieldGraphic
          .circle(cx, cy, r)
          .stroke({ color: SHIELD_COLOR, width: 2, alpha: 0.5 + Math.sin(this.elapsed * 3 + i) * 0.15 });
        // Inner glow
        this.shieldGraphic
          .circle(cx, cy, r)
          .stroke({ color: 0x8fd4f8, width: 1, alpha: 0.2 });
      } else {
        // Inactive: faint dashed-looking ring (draw arcs with gaps)
        const segments = 8;
        for (let s = 0; s < segments; s++) {
          const startAngle = (Math.PI * 2 / segments) * s + this.elapsed * 0.3;
          const endAngle = startAngle + (Math.PI * 2 / segments) * 0.5;
          // moveTo the arc start to avoid line from origin
          this.shieldGraphic
            .moveTo(cx + Math.cos(startAngle) * radius, cy + Math.sin(startAngle) * radius)
            .arc(cx, cy, radius, startAngle, endAngle)
            .stroke({ color: SHIELD_COLOR, width: 1, alpha: 0.12 });
        }
      }
    }
  }
}

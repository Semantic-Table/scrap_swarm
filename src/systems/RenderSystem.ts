import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Sprite } from "../components/Sprite";
import type { Health } from "../components/Health";
import type { Shield } from "../components/Shield";
import type { Velocity } from "../components/Velocity";
import type { EnemyType } from "../components/EnemyType";
import { Graphics } from "pixi.js";
import { PLAYER_SIZE, ENEMY_TYPES } from "../config/constants";

const SHIELD_COLOR = 0x5dade2;
const SHIELD_BASE_RADIUS = PLAYER_SIZE + 14;
const SHIELD_LAYER_GAP = 6;

export class RenderSystem implements System {
  readonly name = "RenderSystem";
  private world: World;
  private elapsed = 0;
  private healthBar: Graphics | null = null;
  private shieldGraphic: Graphics | null = null;
  private playerCoreGlow: Graphics | null = null;
  private dangerVignette: Graphics | null = null;
  private enemyHpBar: Graphics | null = null;
  private speedLines: Graphics | null = null;

  constructor(world: World) {
    this.world = world;
  }

  update(dt: number): void {
    this.elapsed += dt;

    const entities = this.world.query(["Transform", "Sprite"]);

    for (const entity of entities) {
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;
      const sprite = this.world.getComponent<Sprite>(entity, "Sprite")!;

      // Enemy wobble: ±2px organic jitter
      if (this.world.hasComponent(entity, "EnemyTag")) {
        const phase = entity * 1.618;
        sprite.graphic.x = transform.x + Math.sin(this.elapsed * 7 + phase) * 1.5;
        sprite.graphic.y = transform.y + Math.cos(this.elapsed * 5.3 + phase) * 1.5;
      } else {
        sprite.graphic.x = transform.x;
        sprite.graphic.y = transform.y;
      }

      sprite.graphic.rotation = transform.rotation;

      // Scrap idle spin
      if (this.world.hasComponent(entity, "ScrapTag")) {
        sprite.graphic.rotation += dt * 2.5;
      }
    }

    // Process hit-flash + scale-pop on enemies
    const healthEntities = this.world.query(["Health", "Sprite"]);
    for (const entity of healthEntities) {
      const health = this.world.getComponent<Health>(entity, "Health")!;
      const sprite = this.world.getComponent<Sprite>(entity, "Sprite")!;

      // Flash alpha
      if (health.flashTimer > 0) {
        health.flashTimer -= dt;
        sprite.graphic.alpha = health.flashTimer > 0 ? 0.5 : 1;
      }

      // Spawn-in scale pop (0 → 1 with overshoot)
      if (health.spawnScale < 1.0) {
        health.spawnScale = Math.min(1.0, health.spawnScale + dt * 5.5);
        const s = health.spawnScale < 0.8
          ? health.spawnScale / 0.8
          : 1.0 + Math.sin((health.spawnScale - 0.8) / 0.2 * Math.PI) * 0.15;
        sprite.graphic.scale.set(health.hitScale > 1.0 ? health.hitScale : s);
      } else if (health.hitScale > 1.0) {
        // Scale-pop spring-back on hit
        health.hitScale = Math.max(1.0, health.hitScale - dt * 14);
        sprite.graphic.scale.set(health.hitScale);
      }
    }

    this.drawPlayerHealthBar();
    this.drawShieldLayers();
    this.drawPlayerCoreGlow();
    this.drawDangerVignette();
    this.drawEnemyHpBars();
    this.drawSpeedLines();
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

  /** Player core dot changes color by HP: gold → amber → red + flicker */
  private drawPlayerCoreGlow(): void {
    const players = this.world.query(["PlayerTag", "Transform", "Health", "Sprite"]);
    if (players.length === 0) return;

    const transform = this.world.getComponent<Transform>(players[0], "Transform")!;
    const health = this.world.getComponent<Health>(players[0], "Health")!;
    const sprite = this.world.getComponent<Sprite>(players[0], "Sprite")!;

    if (!this.playerCoreGlow) {
      this.playerCoreGlow = new Graphics();
      if (sprite.graphic.parent) sprite.graphic.parent.addChild(this.playerCoreGlow);
    }

    const ratio = health.current / health.max;
    const flicker = ratio < 0.25 ? Math.sin(this.elapsed * 28) * 0.35 : 0;
    const t = 1 - ratio;

    const r = Math.round(0xf5 + (0xcc - 0xf5) * t);
    const g = Math.round(0xc8 * (1 - t * 0.85));
    const b = Math.round(0x42 * (1 - t));
    const coreColor = (r << 16) | (g << 8) | b;
    const coreRadius = PLAYER_SIZE * 0.35 * (1 + flicker * 0.15);

    this.playerCoreGlow.clear();
    this.playerCoreGlow.circle(transform.x, transform.y, coreRadius + 4)
      .fill({ color: coreColor, alpha: 0.25 + flicker * 0.1 });
    this.playerCoreGlow.circle(transform.x, transform.y, coreRadius)
      .fill({ color: coreColor, alpha: 1 });
  }

  /** Red pulsing vignette at screen edges when HP is low */
  private drawDangerVignette(): void {
    const players = this.world.query(["PlayerTag", "Health"]);
    if (players.length === 0) return;

    const health = this.world.getComponent<Health>(players[0], "Health")!;
    const ratio = health.current / health.max;

    if (ratio >= 0.4) {
      if (this.dangerVignette) this.dangerVignette.visible = false;
      return;
    }

    if (!this.dangerVignette) {
      this.dangerVignette = new Graphics();
      this.dangerVignette.zIndex = 900;
      // Add to app.stage (fixed layer, above gameContainer)
      const sprite = this.world.getComponent<Sprite>(players[0], "Sprite");
      const root = sprite?.graphic.parent?.parent;
      if (root) root.addChild(this.dangerVignette);
    }
    this.dangerVignette.visible = true;

    const danger = 1 - ratio / 0.4;
    const pulse = 0.5 + Math.sin(this.elapsed * (3 + danger * 10)) * 0.5;
    const alpha = pulse * danger * 0.4;
    const color = ratio < 0.2 ? 0x8b0000 : 0xc0392b;

    this.dangerVignette.clear();
    // Four edge bleed rects
    this.dangerVignette.rect(0, 0, 9999, 80).fill({ color, alpha: alpha * 0.8 });
    this.dangerVignette.rect(0, 9999 - 80, 9999, 80).fill({ color, alpha: alpha * 0.8 });
    this.dangerVignette.rect(0, 0, 100, 9999).fill({ color, alpha: alpha * 0.5 });
    this.dangerVignette.rect(9999 - 100, 0, 100, 9999).fill({ color, alpha: alpha * 0.5 });
  }

  /** Draw trailing speed lines behind the player when moving fast */
  private drawSpeedLines(): void {
    const players = this.world.query(["PlayerTag", "Velocity", "Transform"]);
    if (players.length === 0) {
      if (this.speedLines) this.speedLines.visible = false;
      return;
    }

    const playerId = players[0];
    const vel = this.world.getComponent<Velocity>(playerId, "Velocity")!;
    const transform = this.world.getComponent<Transform>(playerId, "Transform")!;
    const sprite = this.world.getComponent<Sprite>(playerId, "Sprite");

    const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);

    if (speed < 100) {
      if (this.speedLines) this.speedLines.visible = false;
      return;
    }

    if (!this.speedLines) {
      this.speedLines = new Graphics();
      this.speedLines.zIndex = -1;
      if (sprite?.graphic.parent) {
        sprite.graphic.parent.addChild(this.speedLines);
      }
    }
    this.speedLines.visible = true;
    this.speedLines.clear();

    // Direction opposite to movement
    const moveAngle = Math.atan2(vel.vy, vel.vx);
    const backAngle = moveAngle + Math.PI;

    // Speed factor 0..1 (100 = min, 400 = full effect)
    const factor = Math.min(1, (speed - 100) / 300);
    const lineCount = 4 + Math.floor(factor * 2); // 4-6 lines
    const lineLength = 10 + factor * 25; // 10-35 px
    const alpha = 0.15 + factor * 0.35;  // 0.15-0.5

    const fanSpread = 0.6; // radians total fan width

    for (let i = 0; i < lineCount; i++) {
      // Fan lines slightly around the back direction
      const t = lineCount > 1 ? (i / (lineCount - 1)) - 0.5 : 0;
      const angle = backAngle + t * fanSpread;

      // Start from player edge
      const startDist = PLAYER_SIZE + 4 + Math.random() * 4;
      const sx = transform.x + Math.cos(angle) * startDist;
      const sy = transform.y + Math.sin(angle) * startDist;
      const ex = sx + Math.cos(angle) * lineLength;
      const ey = sy + Math.sin(angle) * lineLength;

      this.speedLines
        .moveTo(sx, sy)
        .lineTo(ex, ey)
        .stroke({ color: 0xd4a047, width: 1.5, alpha });
    }
  }

  /** Draw small HP bars above damaged enemies using a single reusable Graphics */
  private drawEnemyHpBars(): void {
    const enemies = this.world.query(["EnemyTag", "Health", "Transform", "Sprite"]);

    if (!this.enemyHpBar) {
      this.enemyHpBar = new Graphics();
      this.enemyHpBar.zIndex = 800;
    }

    // Ensure it's parented to the game container
    if (!this.enemyHpBar.parent) {
      // Find game container from any enemy sprite
      if (enemies.length > 0) {
        const sprite = this.world.getComponent<Sprite>(enemies[0], "Sprite");
        if (sprite?.graphic.parent) {
          sprite.graphic.parent.addChild(this.enemyHpBar);
        }
      }
    }

    this.enemyHpBar.clear();

    for (const entity of enemies) {
      const health = this.world.getComponent<Health>(entity, "Health")!;
      // Only show bar when damaged and multi-HP enemy
      if (health.current >= health.max || health.max <= 1) continue;

      const transform = this.world.getComponent<Transform>(entity, "Transform")!;
      const enemyType = this.world.getComponent<EnemyType>(entity, "EnemyType");
      const size = enemyType ? ENEMY_TYPES[enemyType.name].size : 16;

      const barW = size * 2;
      const barH = 2;
      const barX = transform.x - barW / 2;
      const barY = transform.y - size - 6;
      const ratio = Math.max(0, health.current / health.max);

      this.enemyHpBar.rect(barX, barY, barW, barH).fill({ color: 0x111111, alpha: 0.7 });
      if (ratio > 0) {
        this.enemyHpBar.rect(barX, barY, barW * ratio, barH).fill(0xe74c3c);
      }
    }
  }
}

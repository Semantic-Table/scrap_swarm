import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { WaveState } from "../components/Wave";
import type { Transform } from "../components/Transform";
import type { Application } from "pixi.js";
import { Container, Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createVelocity } from "../components/Velocity";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createHealth } from "../components/Health";
import { createEnemyTag } from "../components/Tags";
import { createEnemyType } from "../components/EnemyType";
import { createDestructibleTag } from "../components/Destructible";
import {
  SPAWN_MARGIN,
  ENEMY_TYPES,
  ENEMY_UNLOCK_WAVE,
  ENEMY_PACK_SIZE,
  PACK_SPREAD,
  FLOW_HP_SCALE_INTERVAL,
  PROP_SPAWN_INTERVAL,
  PROP_SIZE,
  PROP_COLOR,
  PROP_HP,
  type EnemyTypeName,
} from "../config/constants";

export class SpawnSystem implements System {
  readonly name = "SpawnSystem";
  private world: World;
  private app: Application;
  private stage: Container;
  private propTimer = 0;

  constructor(world: World, app: Application, stage: Container) {
    this.world = world;
    this.app = app;
    this.stage = stage;
  }

  update(dt: number): void {
    const managers = this.world.query(["WaveState"]);
    if (managers.length === 0) return;

    const state = this.world.getComponent<WaveState>(managers[0], "WaveState")!;

    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return;

    state.spawnTimer += state.spawnInterval;

    const typeName = this.pickEnemyType(state.elapsed);
    const { x, y } = this.getSpawnPosition();
    const packSize = ENEMY_PACK_SIZE[typeName];

    for (let i = 0; i < packSize; i++) {
      const offsetX = packSize > 1 ? (Math.random() - 0.5) * PACK_SPREAD : 0;
      const offsetY = packSize > 1 ? (Math.random() - 0.5) * PACK_SPREAD : 0;
      this.spawnEnemy(typeName, x + offsetX, y + offsetY, state);
    }

    // Spawn destructible props periodically
    this.propTimer -= dt + state.spawnInterval; // count real time elapsed
    if (this.propTimer <= 0) {
      this.propTimer = PROP_SPAWN_INTERVAL;
      this.spawnProp();
    }
  }

  /** Unlock enemy types based on elapsed time instead of wave number */
  private pickEnemyType(elapsed: number): EnemyTypeName {
    // Convert elapsed time to a "virtual wave" for unlock thresholds
    // ~30s per virtual wave
    const virtualWave = Math.floor(elapsed / 30) + 1;

    const available: EnemyTypeName[] = [];
    for (const [name, unlockWave] of Object.entries(ENEMY_UNLOCK_WAVE)) {
      if (virtualWave >= unlockWave) {
        available.push(name as EnemyTypeName);
      }
    }

    return available[Math.floor(Math.random() * available.length)];
  }

  private spawnEnemy(typeName: EnemyTypeName, x: number, y: number, state: WaveState): void {
    const config = ENEMY_TYPES[typeName];
    const entity = this.world.createEntity();

    const graphic = this.createEnemyGraphic(typeName, config.size, config.color);
    // Size variation: ±15% for swarm feel
    const scaleVariance = 0.85 + Math.random() * 0.30;
    graphic.scale.set(scaleVariance);
    this.stage.addChild(graphic);

    // Speed from flow state, capped at 2.2x base
    const speedRatio = Math.min(state.enemySpeed / 120, 2.2);
    const speed = config.speed * speedRatio;

    // HP scales every FLOW_HP_SCALE_INTERVAL seconds
    const hpBonus = Math.floor(state.elapsed / FLOW_HP_SCALE_INTERVAL);
    const hp = config.hp + hpBonus;

    this.world.addComponent(entity, createTransform(x, y));
    this.world.addComponent(entity, createVelocity());
    this.world.addComponent(entity, createSprite(graphic));
    this.world.addComponent(entity, createCollider(config.size));
    this.world.addComponent(entity, createHealth(hp));
    this.world.addComponent(entity, createEnemyTag());
    this.world.addComponent(entity, createEnemyType(typeName, speed, config.scrapDrop));

    state.enemiesAlive++;
  }

  private createEnemyGraphic(typeName: EnemyTypeName, size: number, color: number): Graphics {
    const g = new Graphics();
    // Darken the fill color: shift toward near-black while keeping hue
    const darkColor = this.darken(color, 0.25);

    switch (typeName) {
      case "basic":
        g.rect(-size, -size, size * 2, size * 2).fill(darkColor);
        g.rect(-size, -size, size * 2, size * 2).stroke({ color, width: 2 });
        g.rect(-size * 0.3, -size * 0.3, size * 0.6, size * 0.6).fill(color);
        break;
      case "runner":
        g.poly([0, -size, size * 0.6, 0, 0, size, -size * 0.6, 0]).fill(darkColor);
        g.poly([0, -size, size * 0.6, 0, 0, size, -size * 0.6, 0]).stroke({ color, width: 1.5 });
        g.circle(0, 0, size * 0.2).fill(color);
        break;
      case "tank":
        g.poly(this.hexPoints(size)).fill(darkColor);
        g.poly(this.hexPoints(size)).stroke({ color, width: 2.5 });
        g.poly(this.hexPoints(size * 0.5)).fill(this.darken(color, 0.5));
        break;
      case "swarm":
        g.circle(0, 0, size).fill(darkColor);
        g.circle(0, 0, size).stroke({ color, width: 1.5 });
        g.circle(0, 0, size * 0.4).fill(color);
        break;
      case "shooter":
        g.rect(-size, -size * 0.3, size * 2, size * 0.6).fill(darkColor);
        g.rect(-size * 0.3, -size, size * 0.6, size * 2).fill(darkColor);
        g.rect(-size, -size * 0.3, size * 2, size * 0.6).stroke({ color, width: 1.5 });
        g.rect(-size * 0.3, -size, size * 0.6, size * 2).stroke({ color, width: 1.5 });
        g.circle(0, 0, size * 0.25).fill(color);
        break;
    }

    return g;
  }

  private darken(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * factor);
    const g = Math.floor(((color >> 8) & 0xff) * factor);
    const b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  private hexPoints(size: number): number[] {
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(Math.cos(angle) * size, Math.sin(angle) * size);
    }
    return points;
  }

  private spawnProp(): void {
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const halfW = this.app.screen.width / 2;
    const halfH = this.app.screen.height / 2;

    // Spawn just outside the viewport edge
    const side = Math.floor(Math.random() * 4);
    const margin = 80;
    let x: number;
    let y: number;
    switch (side) {
      case 0: // top
        x = pT.x + (Math.random() - 0.5) * halfW * 2;
        y = pT.y - halfH - margin;
        break;
      case 1: // right
        x = pT.x + halfW + margin;
        y = pT.y + (Math.random() - 0.5) * halfH * 2;
        break;
      case 2: // bottom
        x = pT.x + (Math.random() - 0.5) * halfW * 2;
        y = pT.y + halfH + margin;
        break;
      default: // left
        x = pT.x - halfW - margin;
        y = pT.y + (Math.random() - 0.5) * halfH * 2;
        break;
    }

    const entity = this.world.createEntity();
    const s = PROP_SIZE;
    const dark = this.darken(PROP_COLOR, 0.3);

    const g = new Graphics();
    // Metal crate
    g.rect(-s, -s, s * 2, s * 2).fill(dark);
    g.rect(-s, -s, s * 2, s * 2).stroke({ color: PROP_COLOR, width: 2 });
    // Cross detail
    g.moveTo(-s * 0.6, 0).lineTo(s * 0.6, 0).stroke({ color: PROP_COLOR, width: 1, alpha: 0.5 });
    g.moveTo(0, -s * 0.6).lineTo(0, s * 0.6).stroke({ color: PROP_COLOR, width: 1, alpha: 0.5 });
    this.stage.addChild(g);

    this.world.addComponent(entity, createTransform(x, y));
    this.world.addComponent(entity, createSprite(g));
    this.world.addComponent(entity, createCollider(s));
    this.world.addComponent(entity, createHealth(PROP_HP));
    this.world.addComponent(entity, createEnemyTag()); // targetable by all weapons
    this.world.addComponent(entity, createDestructibleTag());
  }

  /** Spawn at viewport edges relative to player position */
  private getSpawnPosition(): { x: number; y: number } {
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return { x: 0, y: 0 };

    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const halfW = this.app.screen.width / 2;
    const halfH = this.app.screen.height / 2;
    const side = Math.floor(Math.random() * 4);

    switch (side) {
      case 0: // top
        return { x: pT.x + (Math.random() - 0.5) * halfW * 2, y: pT.y - halfH - SPAWN_MARGIN };
      case 1: // right
        return { x: pT.x + halfW + SPAWN_MARGIN, y: pT.y + (Math.random() - 0.5) * halfH * 2 };
      case 2: // bottom
        return { x: pT.x + (Math.random() - 0.5) * halfW * 2, y: pT.y + halfH + SPAWN_MARGIN };
      default: // left
        return { x: pT.x - halfW - SPAWN_MARGIN, y: pT.y + (Math.random() - 0.5) * halfH * 2 };
    }
  }
}

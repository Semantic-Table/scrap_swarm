import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { WaveState } from "../components/Wave";
import type { Application } from "pixi.js";
import { Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createVelocity } from "../components/Velocity";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createHealth } from "../components/Health";
import { createEnemyTag } from "../components/Tags";
import { createEnemyType } from "../components/EnemyType";
import {
  SPAWN_MARGIN,
  ENEMY_TYPES,
  ENEMY_UNLOCK_WAVE,
  FLOW_HP_SCALE_INTERVAL,
  type EnemyTypeName,
} from "../config/constants";

const SWARM_GROUP_SIZE = 4;
const SWARM_SPREAD = 30;

export class SpawnSystem implements System {
  readonly name = "SpawnSystem";
  private world: World;
  private app: Application;

  constructor(world: World, app: Application) {
    this.world = world;
    this.app = app;
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

    if (typeName === "swarm") {
      for (let i = 0; i < SWARM_GROUP_SIZE; i++) {
        const offsetX = (Math.random() - 0.5) * SWARM_SPREAD;
        const offsetY = (Math.random() - 0.5) * SWARM_SPREAD;
        this.spawnEnemy(typeName, x + offsetX, y + offsetY, state);
      }
    } else {
      this.spawnEnemy(typeName, x, y, state);
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
    this.app.stage.addChild(graphic);

    // Speed from flow state
    const speedRatio = state.enemySpeed / 120; // ratio vs base speed
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

    switch (typeName) {
      case "basic":
        g.rect(-size, -size, size * 2, size * 2).fill(color);
        break;
      case "runner":
        g.poly([0, -size, size * 0.6, 0, 0, size, -size * 0.6, 0]).fill(color);
        break;
      case "tank":
        g.poly(this.hexPoints(size)).fill(color);
        break;
      case "swarm":
        g.circle(0, 0, size).fill(color);
        break;
    }

    return g;
  }

  private hexPoints(size: number): number[] {
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(Math.cos(angle) * size, Math.sin(angle) * size);
    }
    return points;
  }

  private getSpawnPosition(): { x: number; y: number } {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const side = Math.floor(Math.random() * 4);

    switch (side) {
      case 0:
        return { x: Math.random() * w, y: -SPAWN_MARGIN };
      case 1:
        return { x: w + SPAWN_MARGIN, y: Math.random() * h };
      case 2:
        return { x: Math.random() * w, y: h + SPAWN_MARGIN };
      default:
        return { x: -SPAWN_MARGIN, y: Math.random() * h };
    }
  }
}

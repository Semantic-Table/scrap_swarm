import type { System, Entity } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Velocity } from "../components/Velocity";
import type { Collider } from "../components/Collider";
import type { EnemyType } from "../components/EnemyType";
import { ENEMY_SPEED, SHOOTER_STOP_DISTANCE } from "../config/constants";

// Soft avoidance: steer away from neighbours before contact
const AVOIDANCE_RADIUS_MULT = 3.5;
const AVOIDANCE_WEIGHT = 0.45; // how much avoidance influences final direction (0=none, 1=full)

// Hard separation: directly push overlapping enemies apart
const HARD_PUSH_STRENGTH = 150;

const GRID_CELL = 64;

export class EnemyAISystem implements System {
  readonly name = "EnemyAISystem";
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  update(dt: number): void {
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const playerTransform = this.world.getComponent<Transform>(players[0], "Transform")!;
    const enemies = this.world.query(["EnemyTag", "Transform", "Velocity", "Collider"]);

    // Build spatial grid once
    const grid = this.buildGrid(enemies);

    for (const entity of enemies) {
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;
      const velocity = this.world.getComponent<Velocity>(entity, "Velocity")!;
      const collider = this.world.getComponent<Collider>(entity, "Collider")!;
      const enemyType = this.world.getComponent<EnemyType>(entity, "EnemyType");
      const speed = enemyType ? enemyType.speed : ENEMY_SPEED;

      // --- Chase direction ---
      const dx = playerTransform.x - transform.x;
      const dy = playerTransform.y - transform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let chaseX = 0;
      let chaseY = 0;
      const isShooter = enemyType && enemyType.name === "shooter";

      if (dist > 0 && !(isShooter && dist < SHOOTER_STOP_DISTANCE)) {
        chaseX = dx / dist;
        chaseY = dy / dist;
      }

      if (dist > 0) {
        transform.rotation = Math.atan2(dy, dx);
      }

      // --- Avoidance direction ---
      const avoid = this.getAvoidance(entity, transform, collider, grid);

      // --- Combine: blend chase and avoidance into final direction ---
      let finalX = chaseX + avoid.x * AVOIDANCE_WEIGHT;
      let finalY = chaseY + avoid.y * AVOIDANCE_WEIGHT;
      const finalLen = Math.sqrt(finalX * finalX + finalY * finalY);

      if (finalLen > 0) {
        finalX /= finalLen;
        finalY /= finalLen;
      }

      velocity.vx = finalX * speed;
      velocity.vy = finalY * speed;

      // --- Hard push: directly move overlapping enemies apart ---
      this.hardPush(entity, transform, collider, grid, dt);
    }
  }

  private getAvoidance(
    entity: Entity,
    tA: Transform,
    cA: Collider,
    grid: Map<number, Entity[]>,
  ): { x: number; y: number } {
    let ax = 0;
    let ay = 0;

    const cx = Math.floor(tA.x / GRID_CELL);
    const cy = Math.floor(tA.y / GRID_CELL);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const key = (cx + ox) * 73856093 ^ (cy + oy) * 19349663;
        const cell = grid.get(key);
        if (!cell) continue;

        for (const other of cell) {
          if (other === entity) continue;

          const tB = this.world.getComponent<Transform>(other, "Transform")!;
          const cB = this.world.getComponent<Collider>(other, "Collider")!;

          const dx = tA.x - tB.x;
          const dy = tA.y - tB.y;
          const distSq = dx * dx + dy * dy;
          const avoidDist = (cA.radius + cB.radius) * AVOIDANCE_RADIUS_MULT;

          if (distSq < avoidDist * avoidDist && distSq > 0.1) {
            const dist = Math.sqrt(distSq);
            const factor = 1 - dist / avoidDist;
            // Quadratic falloff: much stronger when close
            ax += (dx / dist) * factor * factor;
            ay += (dy / dist) * factor * factor;
          }
        }
      }
    }

    // Normalize
    const len = Math.sqrt(ax * ax + ay * ay);
    if (len > 0) {
      return { x: ax / len, y: ay / len };
    }
    return { x: 0, y: 0 };
  }

  private hardPush(
    entity: Entity,
    tA: Transform,
    cA: Collider,
    grid: Map<number, Entity[]>,
    dt: number,
  ): void {
    const cx = Math.floor(tA.x / GRID_CELL);
    const cy = Math.floor(tA.y / GRID_CELL);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const key = (cx + ox) * 73856093 ^ (cy + oy) * 19349663;
        const cell = grid.get(key);
        if (!cell) continue;

        for (const other of cell) {
          if (other <= entity) continue;

          const tB = this.world.getComponent<Transform>(other, "Transform")!;
          const cB = this.world.getComponent<Collider>(other, "Collider")!;

          const dx = tA.x - tB.x;
          const dy = tA.y - tB.y;
          const distSq = dx * dx + dy * dy;
          const minDist = cA.radius + cB.radius;

          if (distSq < minDist * minDist && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // Direct position push — half each way
            const push = overlap * 0.5 + HARD_PUSH_STRENGTH * dt * (overlap / minDist);
            tA.x += nx * push * 0.5;
            tA.y += ny * push * 0.5;
            tB.x -= nx * push * 0.5;
            tB.y -= ny * push * 0.5;
          }
        }
      }
    }
  }

  private buildGrid(enemies: Entity[]): Map<number, Entity[]> {
    const grid = new Map<number, Entity[]>();

    for (const entity of enemies) {
      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const cx = Math.floor(t.x / GRID_CELL);
      const cy = Math.floor(t.y / GRID_CELL);
      const key = cx * 73856093 ^ cy * 19349663;
      let cell = grid.get(key);
      if (!cell) {
        cell = [];
        grid.set(key, cell);
      }
      cell.push(entity);
    }

    return grid;
  }
}

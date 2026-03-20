import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Orbit } from "../components/Orbit";
import { hasEvolution } from "../core/EvolutionManager";
import { TURRET_SHOOT_RANGE } from "../config/constants";

const DRONE_SPEED = 500;

/** Updates position of orbiting entities based on their parent's position */
export class OrbitSystem implements System {
  readonly name = "OrbitSystem";
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  private claimedTargets = new Set<number>();

  update(dt: number): void {
    const isDroneSwarm = hasEvolution(this.world, "drone_swarm");
    const entities = this.world.query(["Orbit", "Transform"]);
    if (isDroneSwarm) this.claimedTargets.clear();

    for (const entity of entities) {
      const orbit = this.world.getComponent<Orbit>(entity, "Orbit")!;
      const transform = this.world.getComponent<Transform>(entity, "Transform")!;

      if (!this.world.isAlive(orbit.parent)) continue;
      const parentTransform = this.world.getComponent<Transform>(orbit.parent, "Transform");
      if (!parentTransform) continue;

      if (isDroneSwarm) {
        // DRONE SWARM: chase nearest unclaimed enemy, or roam when idle
        const target = this.findNearestEnemy(transform.x, transform.y, this.claimedTargets);
        if (target) {
          this.claimedTargets.add(target.entity);
          const dx = target.x - transform.x;
          const dy = target.y - transform.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            transform.x += (dx / dist) * DRONE_SPEED * dt;
            transform.y += (dy / dist) * DRONE_SPEED * dt;
            transform.rotation = Math.atan2(dy, dx);
          }
        } else {
          // Idle: orbit around player at wider radius, each drone offset by its angle
          orbit.angle += orbit.speed * 1.5 * dt;
          const idleRadius = orbit.distance * 1.8;
          const targetX = parentTransform.x + Math.cos(orbit.angle) * idleRadius;
          const targetY = parentTransform.y + Math.sin(orbit.angle) * idleRadius;
          const dx = targetX - transform.x;
          const dy = targetY - transform.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 2) {
            const speed = Math.min(DRONE_SPEED, dist * 4); // smooth approach
            transform.x += (dx / dist) * speed * dt;
            transform.y += (dy / dist) * speed * dt;
          }
          transform.rotation = orbit.angle;
        }

        // Leash: don't stray too far from player
        const lx = transform.x - parentTransform.x;
        const ly = transform.y - parentTransform.y;
        const leashDist = Math.sqrt(lx * lx + ly * ly);
        const maxLeash = TURRET_SHOOT_RANGE * 2.5;
        if (leashDist > maxLeash) {
          transform.x = parentTransform.x + (lx / leashDist) * maxLeash;
          transform.y = parentTransform.y + (ly / leashDist) * maxLeash;
        }
      } else {
        // Normal orbit
        orbit.angle += orbit.speed * dt;
        transform.x = parentTransform.x + Math.cos(orbit.angle) * orbit.distance;
        transform.y = parentTransform.y + Math.sin(orbit.angle) * orbit.distance;
        transform.rotation = orbit.angle;
      }
    }
  }

  private findNearestEnemy(x: number, y: number, claimed: Set<number>): { entity: number; x: number; y: number } | null {
    const enemies = this.world.query(["EnemyTag", "Transform"]);
    let closest: { entity: number; x: number; y: number } | null = null;
    const detectRange = TURRET_SHOOT_RANGE * 2.5;
    let closestDist = detectRange * detectRange;

    // Prefer unclaimed targets
    for (const e of enemies) {
      if (claimed.has(e)) continue;
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      const dx = t.x - x;
      const dy = t.y - y;
      const d = dx * dx + dy * dy;
      if (d < closestDist) {
        closestDist = d;
        closest = { entity: e, x: t.x, y: t.y };
      }
    }

    // Fallback: any enemy if all claimed
    if (!closest) {
      closestDist = detectRange * detectRange;
      for (const e of enemies) {
        const t = this.world.getComponent<Transform>(e, "Transform")!;
        const dx = t.x - x;
        const dy = t.y - y;
        const d = dx * dx + dy * dy;
        if (d < closestDist) {
          closestDist = d;
          closest = { entity: e, x: t.x, y: t.y };
        }
      }
    }

    return closest;
  }
}

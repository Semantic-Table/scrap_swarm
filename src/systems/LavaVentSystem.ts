import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Health } from "../components/Health";
import type { WaveState } from "../components/Wave";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { VENT_SPAWN_INTERVAL, VENT_RADIUS, VENT_DAMAGE, VENT_COLOR } from "../config/constants";
import { killEnemy } from "../core/Combat";

/** Vent lifecycle phases */
const PHASE_DORMANT = 0;
const PHASE_WARNING = 1;
const PHASE_ACTIVE = 2;
type VentPhase = typeof PHASE_DORMANT | typeof PHASE_WARNING | typeof PHASE_ACTIVE;

/** Phase durations in seconds */
const DORMANT_DURATION = 4;
const WARNING_DURATION = 2;
const ACTIVE_DURATION = 1;
const ACTIVE_TICK_INTERVAL = 0.2;

interface Vent {
  x: number;
  y: number;
  phase: VentPhase;
  phaseTimer: number;    // seconds remaining in current phase
  tickTimer: number;     // damage tick timer during ACTIVE
  graphic: Graphics;
  life: number;          // total cycles before removal (one full cycle then gone)
}

/** Environmental hazard: lava vents that cycle dormant → warning → active */
export class LavaVentSystem implements System {
  readonly name = "LavaVentSystem";
  private world: World;
  private stage: Container;
  private vents: Vent[] = [];
  private spawnTimer = 0;

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  update(dt: number): void {
    const managers = this.world.query(["WaveState"]);
    if (managers.length === 0) return;
    const wave = this.world.getComponent<WaveState>(managers[0], "WaveState")!;

    // Only spawn in Act 2+ (>150s)
    if (wave.elapsed < 150) return;

    const isAct3 = wave.elapsed >= 420;
    const maxVents = isAct3 ? 3 : 2;

    // Spawn timer
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = VENT_SPAWN_INTERVAL;

      // Determine how many to spawn this wave (1-2 in Act 2, up to fill cap in Act 3)
      const toSpawn = Math.min(isAct3 ? 2 : 1, maxVents - this.vents.length);

      const players = this.world.query(["PlayerTag", "Transform"]);
      if (players.length > 0 && toSpawn > 0) {
        const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
        for (let i = 0; i < toSpawn; i++) {
          this.spawnVent(pT.x, pT.y);
        }
      }
    }

    // Update existing vents
    for (let i = this.vents.length - 1; i >= 0; i--) {
      const vent = this.vents[i];
      vent.phaseTimer -= dt;

      if (vent.phaseTimer <= 0) {
        // Transition to next phase
        if (vent.phase === PHASE_DORMANT) {
          vent.phase = PHASE_WARNING;
          vent.phaseTimer = WARNING_DURATION;
        } else if (vent.phase === PHASE_WARNING) {
          vent.phase = PHASE_ACTIVE;
          vent.phaseTimer = ACTIVE_DURATION;
          vent.tickTimer = 0;
        } else {
          // ACTIVE phase ended — remove vent
          vent.graphic.removeFromParent();
          vent.graphic.destroy();
          this.vents.splice(i, 1);
          continue;
        }
      }

      // During ACTIVE phase, tick damage
      if (vent.phase === PHASE_ACTIVE) {
        vent.tickTimer -= dt;
        if (vent.tickTimer <= 0) {
          vent.tickTimer += ACTIVE_TICK_INTERVAL;
          this.damageEntitiesInRadius(vent.x, vent.y);
        }
      }

      // Update visual
      this.drawVent(vent, dt);
    }
  }

  private spawnVent(playerX: number, playerY: number): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 200;
    const x = playerX + Math.cos(angle) * dist;
    const y = playerY + Math.sin(angle) * dist;

    const graphic = new Graphics();
    this.stage.addChild(graphic);

    const vent: Vent = {
      x,
      y,
      phase: PHASE_DORMANT,
      phaseTimer: DORMANT_DURATION,
      tickTimer: 0,
      graphic,
      life: 1,
    };

    this.vents.push(vent);
  }

  private drawVent(vent: Vent, _dt: number): void {
    vent.graphic.clear();

    if (vent.phase === PHASE_DORMANT) {
      // Dim orange circle on ground
      vent.graphic
        .circle(vent.x, vent.y, VENT_RADIUS)
        .fill({ color: VENT_COLOR, alpha: 0.12 });
      vent.graphic
        .circle(vent.x, vent.y, VENT_RADIUS)
        .stroke({ color: VENT_COLOR, width: 1, alpha: 0.2 });
    } else if (vent.phase === PHASE_WARNING) {
      // Pulsing brighter — use phase timer to create pulse
      const t = 1 - vent.phaseTimer / WARNING_DURATION;
      const pulse = 0.25 + Math.sin(t * Math.PI * 6) * 0.15 + t * 0.2;
      vent.graphic
        .circle(vent.x, vent.y, VENT_RADIUS)
        .fill({ color: VENT_COLOR, alpha: pulse });
      vent.graphic
        .circle(vent.x, vent.y, VENT_RADIUS)
        .stroke({ color: 0xff6600, width: 2, alpha: pulse + 0.2 });
      // Inner glow
      vent.graphic
        .circle(vent.x, vent.y, VENT_RADIUS * 0.5)
        .fill({ color: 0xff8800, alpha: pulse * 0.5 });
    } else {
      // ACTIVE: bright orange+red, fully visible
      vent.graphic
        .circle(vent.x, vent.y, VENT_RADIUS)
        .fill({ color: 0xff2200, alpha: 0.5 });
      vent.graphic
        .circle(vent.x, vent.y, VENT_RADIUS)
        .stroke({ color: VENT_COLOR, width: 3, alpha: 0.9 });
      vent.graphic
        .circle(vent.x, vent.y, VENT_RADIUS * 0.6)
        .fill({ color: 0xff6600, alpha: 0.6 });
      vent.graphic
        .circle(vent.x, vent.y, VENT_RADIUS * 0.25)
        .fill({ color: 0xffaa00, alpha: 0.8 });
    }
  }

  /** Damage all entities (enemies + player) inside the vent radius */
  private damageEntitiesInRadius(vx: number, vy: number): void {
    const r2 = VENT_RADIUS * VENT_RADIUS;

    // Damage player
    const players = this.world.query(["PlayerTag", "Transform", "Health"]);
    for (const p of players) {
      const pT = this.world.getComponent<Transform>(p, "Transform")!;
      const dx = pT.x - vx;
      const dy = pT.y - vy;
      if (dx * dx + dy * dy < r2) {
        const health = this.world.getComponent<Health>(p, "Health")!;
        health.current -= VENT_DAMAGE;
        health.flashTimer = 0.08;
        health.hitScale = 1.15;
      }
    }

    // Damage enemies
    const enemies = this.world.query(["EnemyTag", "Transform", "Health"]);
    for (const e of enemies) {
      const eT = this.world.getComponent<Transform>(e, "Transform")!;
      const dx = eT.x - vx;
      const dy = eT.y - vy;
      if (dx * dx + dy * dy < r2) {
        const health = this.world.getComponent<Health>(e, "Health")!;
        health.current -= VENT_DAMAGE;
        health.flashTimer = 0.08;
        if (health.current <= 0) {
          killEnemy(this.world, this.stage, e, eT.x, eT.y);
        }
      }
    }
  }
}

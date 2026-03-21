import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { WaveState } from "../components/Wave";
import {
  ENEMY_SPEED,
  FLOW_MIN_INTERVAL,
  FLOW_SPEED_SCALE,
  HORDE_INTERVAL,
  HORDE_DURATION,
  HORDE_CALM_AFTER,
} from "../config/constants";
import { setMusicIntensity } from "../core/Audio";

/**
 * 3-act difficulty curve over 10 minutes + periodic horde events.
 *
 * Act 1 (0:00–2:30): Learning phase — slow ramp, basics + runners only.
 * Act 2 (2:30–7:00): Grind — all enemy types, steady escalation.
 * Act 3 (7:00–10:00): Crisis — near-max spawn rate, final HP bump.
 *
 * Horde events fire every HORDE_INTERVAL seconds:
 * - HORDE_DURATION seconds of 4x spawn rate
 * - Followed by HORDE_CALM_AFTER seconds of reduced spawns
 */
export class WaveSystem implements System {
  readonly name = "WaveSystem";
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  update(dt: number): void {
    const managers = this.world.query(["WaveState"]);
    if (managers.length === 0) return;

    const state = this.world.getComponent<WaveState>(managers[0], "WaveState")!;
    state.elapsed += dt;

    // Power crate timers (ticked here so they work regardless of bosses)
    if (state.overclockTimer > 0) state.overclockTimer -= dt;
    if (state.magnetPulseTimer > 0) state.magnetPulseTimer -= dt;

    const elapsed = state.elapsed;
    const minutes = elapsed / 60;

    // --- 3-act spawn interval + music intensity ---
    let baseInterval: number;
    if (elapsed < 150) {
      // Act 1 (0–2:30): 1.2s → 0.7s
      const t = elapsed / 150;
      baseInterval = 1.2 - t * 0.5;
      setMusicIntensity(1);
    } else if (elapsed < 420) {
      // Act 2 (2:30–7:00): 0.7s → 0.35s
      const t = (elapsed - 150) / 270;
      baseInterval = 0.7 - t * 0.35;
      setMusicIntensity(2);
    } else {
      // Act 3 (7:00–10:00): 0.35s → 0.2s
      const t = Math.min(1, (elapsed - 420) / 180);
      baseInterval = 0.35 - t * 0.15;
      setMusicIntensity(3);
    }

    baseInterval = Math.max(FLOW_MIN_INTERVAL, baseInterval);

    // --- Horde events ---
    state.hordeTimer -= dt;

    if (state.hordeActive > 0) {
      // During horde: faster spawns
      state.hordeActive -= dt;
      state.spawnInterval = baseInterval * 0.25;
      if (state.hordeActive <= 0) {
        // Horde ended → calm period
        state.hordeCooldown = HORDE_CALM_AFTER;
      }
    } else if (state.hordeCooldown > 0) {
      // Post-horde calm: slower spawns
      state.hordeCooldown -= dt;
      state.spawnInterval = baseInterval * 2.5;
    } else {
      // Normal spawning
      state.spawnInterval = baseInterval;
    }

    // Trigger next horde
    if (state.hordeTimer <= 0 && elapsed > 60) {
      state.hordeTimer = HORDE_INTERVAL;
      state.hordeActive = HORDE_DURATION;
    }

    // --- Enemy speed: scales with time, all acts ---
    state.enemySpeed = ENEMY_SPEED * (1 + minutes * FLOW_SPEED_SCALE);
  }
}

import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { WaveState } from "../components/Wave";
import {
  ENEMY_SPEED,
  FLOW_INITIAL_INTERVAL,
  FLOW_MIN_INTERVAL,
  FLOW_SPEED_SCALE,
  FLOW_INTERVAL_SCALE,
} from "../config/constants";

/** Continuous flow system — ramps up difficulty over time */
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

    const minutes = state.elapsed / 60;

    // Spawn interval decreases over time
    state.spawnInterval = Math.max(
      FLOW_MIN_INTERVAL,
      FLOW_INITIAL_INTERVAL * Math.pow(1 - FLOW_INTERVAL_SCALE, minutes),
    );

    // Enemy speed increases over time
    state.enemySpeed = ENEMY_SPEED * (1 + minutes * FLOW_SPEED_SCALE);
  }
}

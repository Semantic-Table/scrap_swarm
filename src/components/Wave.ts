import type { Component } from "../ecs/types";

/** Singleton — controls the continuous enemy flow */
export interface WaveState extends Component {
  readonly type: "WaveState";
  elapsed: number;        // total time survived (seconds)
  spawnTimer: number;
  spawnInterval: number;  // current interval between spawns
  enemySpeed: number;     // current base enemy speed
  enemiesAlive: number;   // tracking for cleanup
}

export function createWaveState(): WaveState {
  return {
    type: "WaveState",
    elapsed: 0,
    spawnTimer: 0,
    spawnInterval: 1.5,
    enemySpeed: 120,
    enemiesAlive: 0,
  };
}

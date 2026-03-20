import type { Component } from "../ecs/types";

/** Singleton — controls the continuous enemy flow */
export interface WaveState extends Component {
  readonly type: "WaveState";
  elapsed: number;        // total time survived (seconds)
  spawnTimer: number;
  spawnInterval: number;  // current interval between spawns
  enemySpeed: number;     // current base enemy speed
  enemiesAlive: number;   // tracking for cleanup
  hordeTimer: number;     // countdown to next horde event
  hordeActive: number;    // > 0 while horde is spawning (seconds remaining)
  hordeCooldown: number;  // > 0 during post-horde calm (seconds remaining)
  totalKills: number;     // total enemies killed (for end screen stats)
  killsByType: Record<string, number>; // kills per enemy type name
}

export function createWaveState(): WaveState {
  return {
    type: "WaveState",
    elapsed: 0,
    spawnTimer: 0,
    spawnInterval: 1.2,
    enemySpeed: 120,
    enemiesAlive: 0,
    hordeTimer: 150,
    hordeActive: 0,
    hordeCooldown: 0,
    totalKills: 0,
    killsByType: {},
  };
}

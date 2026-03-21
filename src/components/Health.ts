import type { Component } from "../ecs/types";

export interface Health extends Component {
  readonly type: "Health";
  current: number;
  max: number;
  flashTimer: number; // > 0 means currently flashing (seconds remaining)
  hitScale: number;   // 1.0 normal, set to 1.3 on hit, springs back
  spawnScale: number; // 0 → 1 on spawn (spring-in animation)
}

export function createHealth(max: number): Health {
  return { type: "Health", current: max, max, flashTimer: 0, hitScale: 1.0, spawnScale: 0 };
}

import type { Component } from "../ecs/types";

export interface Velocity extends Component {
  readonly type: "Velocity";
  vx: number;
  vy: number;
}

export function createVelocity(vx = 0, vy = 0): Velocity {
  return { type: "Velocity", vx, vy };
}

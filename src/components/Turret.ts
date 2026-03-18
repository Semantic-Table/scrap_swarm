import type { Component } from "../ecs/types";

export interface TurretTag extends Component {
  readonly type: "TurretTag";
  shootCooldown: number;
  shootTimer: number;
}

export function createTurretTag(shootCooldown: number): TurretTag {
  return { type: "TurretTag", shootCooldown, shootTimer: 0 };
}

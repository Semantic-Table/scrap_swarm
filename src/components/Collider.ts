import type { Component } from "../ecs/types";

export interface Collider extends Component {
  readonly type: "Collider";
  radius: number;
}

export function createCollider(radius: number): Collider {
  return { type: "Collider", radius };
}

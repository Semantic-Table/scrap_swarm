import type { Component } from "../ecs/types";

export interface Health extends Component {
  readonly type: "Health";
  current: number;
  max: number;
}

export function createHealth(max: number): Health {
  return { type: "Health", current: max, max };
}

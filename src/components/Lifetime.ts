import type { Component } from "../ecs/types";

/** Auto-destroy entity after `remaining` seconds */
export interface Lifetime extends Component {
  readonly type: "Lifetime";
  remaining: number;
}

export function createLifetime(seconds: number): Lifetime {
  return { type: "Lifetime", remaining: seconds };
}

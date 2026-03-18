import type { Component } from "../ecs/types";
import type { Entity } from "../ecs/types";

/** Makes an entity orbit around a parent entity */
export interface Orbit extends Component {
  readonly type: "Orbit";
  parent: Entity;
  angle: number;     // current angle in radians
  distance: number;  // distance from parent center
  speed: number;     // radians per second
}

export function createOrbit(parent: Entity, angle: number, distance: number, speed: number): Orbit {
  return { type: "Orbit", parent, angle, distance, speed };
}

import type { Component } from "../ecs/types";

export interface HealthPickupTag extends Component {
  readonly type: "HealthPickupTag";
  healAmount: number;
}

export function createHealthPickupTag(healAmount = 2): HealthPickupTag {
  return { type: "HealthPickupTag", healAmount };
}

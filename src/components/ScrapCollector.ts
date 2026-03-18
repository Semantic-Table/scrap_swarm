import type { Component } from "../ecs/types";

/** Attached to the player — tracks collected scrap */
export interface ScrapCollector extends Component {
  readonly type: "ScrapCollector";
  amount: number;
  pickupRadius: number;
}

export function createScrapCollector(pickupRadius: number): ScrapCollector {
  return { type: "ScrapCollector", amount: 0, pickupRadius };
}

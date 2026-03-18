import type { Component } from "../ecs/types";

export interface PlayerLevel extends Component {
  readonly type: "PlayerLevel";
  level: number;
  totalScrapCollected: number;
}

export function createPlayerLevel(): PlayerLevel {
  return { type: "PlayerLevel", level: 0, totalScrapCollected: 0 };
}

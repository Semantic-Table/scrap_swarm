import type { Component } from "../ecs/types";

export interface PlayerTag extends Component {
  readonly type: "PlayerTag";
}

export interface EnemyTag extends Component {
  readonly type: "EnemyTag";
}

export function createPlayerTag(): PlayerTag {
  return { type: "PlayerTag" };
}

export function createEnemyTag(): EnemyTag {
  return { type: "EnemyTag" };
}

import type { Component } from "../ecs/types";

export interface EnemyProjectileTag extends Component {
  readonly type: "EnemyProjectileTag";
}

export function createEnemyProjectileTag(): EnemyProjectileTag {
  return { type: "EnemyProjectileTag" };
}

import type { Component } from "../ecs/types";

export interface ProjectileTag extends Component {
  readonly type: "ProjectileTag";
  damage: number;
}

export function createProjectileTag(damage = 1): ProjectileTag {
  return { type: "ProjectileTag", damage };
}

import type { Component } from "../ecs/types";

export interface ProjectileTag extends Component {
  readonly type: "ProjectileTag";
}

export function createProjectileTag(): ProjectileTag {
  return { type: "ProjectileTag" };
}

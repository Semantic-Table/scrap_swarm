import type { Component } from "../ecs/types";

export interface DestructibleTag extends Component {
  readonly type: "DestructibleTag";
}

export function createDestructibleTag(): DestructibleTag {
  return { type: "DestructibleTag" };
}

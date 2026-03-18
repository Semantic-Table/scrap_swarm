import type { Component } from "../ecs/types";

export interface Transform extends Component {
  readonly type: "Transform";
  x: number;
  y: number;
  rotation: number;
}

export function createTransform(x = 0, y = 0, rotation = 0): Transform {
  return { type: "Transform", x, y, rotation };
}

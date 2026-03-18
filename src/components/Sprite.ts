import type { Component } from "../ecs/types";
import type { Graphics } from "pixi.js";

export interface Sprite extends Component {
  readonly type: "Sprite";
  graphic: Graphics;
}

export function createSprite(graphic: Graphics): Sprite {
  return { type: "Sprite", graphic };
}

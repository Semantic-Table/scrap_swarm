import type { Component } from "../ecs/types";
import type { Container } from "pixi.js";

export interface Sprite extends Component {
  readonly type: "Sprite";
  graphic: Container;
}

export function createSprite(graphic: Container): Sprite {
  return { type: "Sprite", graphic };
}

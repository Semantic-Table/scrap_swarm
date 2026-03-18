import type { Component } from "../ecs/types";

export interface ScrapTag extends Component {
  readonly type: "ScrapTag";
}

export function createScrapTag(): ScrapTag {
  return { type: "ScrapTag" };
}

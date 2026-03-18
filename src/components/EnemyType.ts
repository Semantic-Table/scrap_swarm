import type { Component } from "../ecs/types";
import type { EnemyTypeName } from "../config/constants";

export interface EnemyType extends Component {
  readonly type: "EnemyType";
  name: EnemyTypeName;
  speed: number;
  scrapDrop: number;
}

export function createEnemyType(name: EnemyTypeName, speed: number, scrapDrop: number): EnemyType {
  return { type: "EnemyType", name, speed, scrapDrop };
}

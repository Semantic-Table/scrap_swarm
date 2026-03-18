/** An entity is just a unique numeric ID */
export type Entity = number;

/** Base interface for all components — just a type tag */
export interface Component {
  readonly type: string;
}

/** A system processes entities that have specific components */
export interface System {
  readonly name: string;
  update(dt: number): void;
}

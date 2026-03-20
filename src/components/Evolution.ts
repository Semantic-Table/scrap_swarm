import type { Component } from "../ecs/types";

/** Tracks which evolutions the player has unlocked */
export interface EvolutionState extends Component {
  readonly type: "EvolutionState";
  active: string[]; // evolution IDs
}

export function createEvolutionState(): EvolutionState {
  return { type: "EvolutionState", active: [] };
}

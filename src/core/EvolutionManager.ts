import type { World } from "../ecs/World";
import type { Inventory } from "../components/Inventory";
import type { EvolutionState } from "../components/Evolution";
import { EVOLUTIONS, type EvolutionDef } from "../config/evolutions";

/**
 * Check if any new evolutions can be unlocked.
 * Returns the newly unlocked evolution, or null.
 */
export function checkEvolutions(world: World): EvolutionDef | null {
  const players = world.query(["PlayerTag", "Inventory", "EvolutionState"]);
  if (players.length === 0) return null;

  const inventory = world.getComponent<Inventory>(players[0], "Inventory")!;
  const evoState = world.getComponent<EvolutionState>(players[0], "EvolutionState")!;

  for (const evo of EVOLUTIONS) {
    if (evoState.active.includes(evo.id)) continue;

    const weapon = inventory.slots.find((s) => s.itemId === evo.weaponId);
    const passive = inventory.slots.find((s) => s.itemId === evo.passiveId);

    if (weapon && weapon.level >= 5 && passive && passive.level >= 5) {
      evoState.active.push(evo.id);
      return evo;
    }
  }

  return null;
}

/** Check if a specific evolution is active */
export function hasEvolution(world: World, evolutionId: string): boolean {
  const players = world.query(["PlayerTag", "EvolutionState"]);
  if (players.length === 0) return false;
  const evoState = world.getComponent<EvolutionState>(players[0], "EvolutionState")!;
  return evoState.active.includes(evolutionId);
}

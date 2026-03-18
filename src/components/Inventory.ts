import type { Component } from "../ecs/types";

export interface InventorySlot {
  itemId: string;
  level: number;
}

/** Attached to the player — tracks equipped items */
export interface Inventory extends Component {
  readonly type: "Inventory";
  slots: InventorySlot[];
}

export function createInventory(): Inventory {
  return { type: "Inventory", slots: [] };
}

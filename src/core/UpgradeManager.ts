import type { InventorySlot } from "../components/Inventory";
import {
  ITEMS,
  MAX_ITEM_SLOTS,
  RARITY_WEIGHTS,
  type Rarity,
  type ItemDefinition,
} from "../config/upgrades";

export interface UpgradeChoice {
  itemId: string;
  item: ItemDefinition;
  isNew: boolean;       // true = acquiring new item, false = upgrading existing
  rarity: Rarity;
  description: string;  // what this choice does
  currentLevel: number; // 0 for new items
}

/** First level-up offers curated choices to teach the system */
const FIRST_LEVELUP_ITEMS = ["turret", "tesla", "magnet"];

/** Generate 3 upgrade choices based on current inventory */
export function generateChoices(inventory: InventorySlot[], playerLevel: number): UpgradeChoice[] {
  // First level-up: forced curated choices (onboarding)
  if (playerLevel === 1) {
    return FIRST_LEVELUP_ITEMS.map((id) => {
      const item = ITEMS[id];
      return {
        itemId: id,
        item,
        isNew: true,
        rarity: "normal" as Rarity,
        description: item.description,
        currentLevel: 0,
      };
    });
  }

  const choices: UpgradeChoice[] = [];
  const pool = buildPool(inventory);

  // Pick 3 unique choices from the pool
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const picked = pool.splice(idx, 1)[0];
    choices.push(picked);
  }

  return choices;
}

function buildPool(inventory: InventorySlot[]): UpgradeChoice[] {
  const pool: UpgradeChoice[] = [];
  const ownedMap = new Map(inventory.map((s) => [s.itemId, s]));

  // New items (if slots available)
  if (inventory.length < MAX_ITEM_SLOTS) {
    for (const item of Object.values(ITEMS)) {
      if (!ownedMap.has(item.id)) {
        const rarity = rollRarity();
        pool.push({
          itemId: item.id,
          item,
          isNew: true,
          rarity,
          description: item.description,
          currentLevel: 0,
        });
      }
    }
  }

  // Upgrades for owned items
  for (const slot of inventory) {
    const item = ITEMS[slot.itemId];
    if (!item || slot.level >= item.maxLevel) continue;

    const rarity = rollRarity();
    pool.push({
      itemId: slot.itemId,
      item,
      isNew: false,
      rarity,
      description: item.upgradeDescriptions[rarity],
      currentLevel: slot.level,
    });
  }

  return pool;
}

function rollRarity(): Rarity {
  const total = RARITY_WEIGHTS.normal + RARITY_WEIGHTS.rare + RARITY_WEIGHTS.epic;
  const roll = Math.random() * total;

  if (roll < RARITY_WEIGHTS.normal) return "normal";
  if (roll < RARITY_WEIGHTS.normal + RARITY_WEIGHTS.rare) return "rare";
  return "epic";
}

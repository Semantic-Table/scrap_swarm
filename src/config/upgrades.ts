// --- Rarity ---

export type Rarity = "normal" | "rare" | "epic";

export const RARITY_COLORS: Record<Rarity, number> = {
  normal: 0x8c8c8c,
  rare: 0x3498db,
  epic: 0xf1c40f,
};

export const RARITY_LABELS: Record<Rarity, string> = {
  normal: "Normal",
  rare: "Rare",
  epic: "Epic",
};

/** Weights for rarity rolls — higher = more likely */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  normal: 60,
  rare: 30,
  epic: 10,
};

// --- Items ---

export type ItemCategory = "weapon" | "utility";

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  maxLevel: number;
  /** Description of what the upgrade does at each rarity */
  upgradeDescriptions: Record<Rarity, string>;
}

export const ITEMS: Record<string, ItemDefinition> = {
  sword: {
    id: "sword",
    name: "Sword",
    description: "Melee slash in front of the player",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Fire rate +10%",
      rare: "Damage +1, Range +15%",
      epic: "Damage +2, Arc +30°, Fire rate +20%",
    },
  },
  turret: {
    id: "turret",
    name: "Turret",
    description: "Orbital turret that fires at the nearest enemy",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Fire rate +10%",
      rare: "Fire rate +20%, Range +20%",
      epic: "+1 turret, Fire rate +10%",
    },
  },
  tesla: {
    id: "tesla",
    name: "Tesla",
    description: "Chain lightning that bounces between nearby enemies",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "+1 bounce",
      rare: "+1 bounce, Damage +1",
      epic: "+2 bounces, Damage +2",
    },
  },
  pulse: {
    id: "pulse",
    name: "Shockwave",
    description: "Emits a damage wave around the player",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Radius +15%",
      rare: "Radius +25%, Damage +1",
      epic: "Radius +40%, Damage +2, Cooldown -20%",
    },
  },
  magnet: {
    id: "magnet",
    name: "Magnet",
    description: "Increases scrap attraction radius",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Radius +20%",
      rare: "Radius +40%, Speed +25%",
      epic: "Radius +60%, Speed +50%",
    },
  },
  refiner: {
    id: "refiner",
    name: "Refiner",
    description: "Each scrap pickup is worth more",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "+1 scrap per pickup",
      rare: "+2 scrap per pickup",
      epic: "+3 scrap per pickup",
    },
  },
  shield: {
    id: "shield",
    name: "Shield",
    description: "Absorbs 1 hit, recharges after a delay",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Recharge -15%",
      rare: "Recharge -25%, +1 charge",
      epic: "+2 charges, Recharge -30%",
    },
  },
  booster: {
    id: "booster",
    name: "Booster",
    description: "Increases movement speed",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Speed +10%",
      rare: "Speed +20%",
      epic: "Speed +35%",
    },
  },
  might: {
    id: "might",
    name: "Might",
    description: "Increases damage of all weapons",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Damage +1",
      rare: "Damage +2",
      epic: "Damage +3",
    },
  },
  swiftness: {
    id: "swiftness",
    name: "Swiftness",
    description: "Reduces cooldown of all weapons",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Cooldown -10%",
      rare: "Cooldown -15%",
      epic: "Cooldown -25%",
    },
  },
  reach: {
    id: "reach",
    name: "Reach",
    description: "Increases range of all weapons",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Range +15%",
      rare: "Range +25%",
      epic: "Range +40%",
    },
  },
  boomerang: {
    id: "boomerang",
    name: "Boomerang",
    description: "Orbiting blade that hits enemies going and coming back",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Damage +1",
      rare: "Damage +1, Range +20%",
      epic: "Damage +2, Speed +30%",
    },
  },
  mine: {
    id: "mine",
    name: "Mine",
    description: "Drops explosive mines behind the player",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Damage +1",
      rare: "Damage +2, Blast radius +15%",
      epic: "Damage +3, Drop rate +25%",
    },
  },
  laser: {
    id: "laser",
    name: "Laser",
    description: "Piercing beam that cuts through all enemies in a line",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Damage +1",
      rare: "Damage +1, Range +20%",
      epic: "Damage +2, Cooldown -20%",
    },
  },
  aura: {
    id: "aura",
    name: "Toxic Aura",
    description: "Poison cloud that damages nearby enemies over time",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Radius +10%",
      rare: "Damage +1, Radius +15%",
      epic: "Damage +2, Radius +25%",
    },
  },
  ricochet: {
    id: "ricochet",
    name: "Ricochet Bolt",
    description: "Bolt that bounces off viewport edges, gaining damage",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "+1 bounce",
      rare: "+1 bounce, Damage +1",
      epic: "+2 bounces, Damage +2",
    },
  },
  gravity: {
    id: "gravity",
    name: "Gravity Well",
    description: "Creates a vortex that pulls enemies in then explodes",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Damage +2",
      rare: "Radius +20%, Damage +2",
      epic: "Radius +40%, Damage +4",
    },
  },
  chainsaw: {
    id: "chainsaw",
    name: "Chain Saw",
    description: "Continuous melee damage in front of the player",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Damage +1",
      rare: "Damage +1, Range +15%",
      epic: "Damage +2, Arc +20%",
    },
  },
  sentry: {
    id: "sentry",
    name: "Sentry",
    description: "Deploys a stationary turret at your position",
    category: "weapon",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Fire rate +10%",
      rare: "Range +20%, Fire rate +15%",
      epic: "Duration +50%, Damage +1",
    },
  },
  luck: {
    id: "luck",
    name: "Lucky Cog",
    description: "Increases Cog drops and rare item chance",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "+10% Cog bonus",
      rare: "+20% Cog bonus",
      epic: "+30% Cog bonus, +rare chance",
    },
  },
  armor: {
    id: "armor",
    name: "Plating",
    description: "Reduces damage taken by 1 (min 1)",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "Damage reduction +1",
      rare: "Damage reduction +1, +5% HP",
      epic: "Damage reduction +2",
    },
  },
  regen: {
    id: "regen",
    name: "Auto-Repair",
    description: "Slowly regenerates HP over time",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "+0.1 HP/s",
      rare: "+0.2 HP/s",
      epic: "+0.3 HP/s",
    },
  },
  crit: {
    id: "crit",
    name: "Overclock",
    description: "Chance to deal double damage on hit",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "+5% crit chance",
      rare: "+10% crit chance",
      epic: "+15% crit chance",
    },
  },
  multi: {
    id: "multi",
    name: "Quantity",
    description: "More projectiles, bounces, charges and turrets",
    category: "utility",
    maxLevel: 10,
    upgradeDescriptions: {
      normal: "+1 to all weapons",
      rare: "+1, +1 turret/charge",
      epic: "+2 to all weapons",
    },
  },
};

// --- Level thresholds ---

/** Scrap needed to reach level N */
export function scrapForLevel(level: number): number {
  const base = 5 + (level - 1) * 4;
  const lateBonus = Math.max(0, level - 5);
  return Math.floor(base + lateBonus * lateBonus * 1.5);
}

// --- Inventory limits ---

export const MAX_ITEM_SLOTS = 6;

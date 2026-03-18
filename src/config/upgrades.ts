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
  turret: {
    id: "turret",
    name: "Tourelle",
    description: "Tourelle orbitale qui tire sur l'ennemi le plus proche",
    category: "weapon",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Cadence +10%",
      rare: "Cadence +20%, Portée +15%",
      epic: "+1 tourelle",
    },
  },
  tesla: {
    id: "tesla",
    name: "Tesla",
    description: "Éclair en chaîne qui saute entre ennemis proches",
    category: "weapon",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Dégâts +1",
      rare: "+1 rebond",
      epic: "+2 rebonds, Dégâts +1",
    },
  },
  pulse: {
    id: "pulse",
    name: "Onde de choc",
    description: "Émet une onde de dégâts autour du joueur",
    category: "weapon",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Rayon +15%, Cooldown -10%",
      rare: "Rayon +25%, Dégâts +1",
      epic: "Rayon +40%, Cooldown -25%, Dégâts +1",
    },
  },
  magnet: {
    id: "magnet",
    name: "Aimant",
    description: "Augmente le rayon d'attraction de la ferraille",
    category: "utility",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Rayon +20%",
      rare: "Rayon +40%",
      epic: "Rayon +60%, Vitesse attraction +50%",
    },
  },
  refiner: {
    id: "refiner",
    name: "Rafineur",
    description: "Chaque ferraille ramassée vaut plus",
    category: "utility",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "+1 scrap par pickup",
      rare: "+2 scrap par pickup",
      epic: "+3 scrap par pickup",
    },
  },
  shield: {
    id: "shield",
    name: "Bouclier",
    description: "Absorbe 1 hit, se recharge après un délai",
    category: "utility",
    maxLevel: 3,
    upgradeDescriptions: {
      normal: "Recharge -15%",
      rare: "Recharge -30%",
      epic: "+1 charge",
    },
  },
  booster: {
    id: "booster",
    name: "Booster",
    description: "Augmente la vitesse de déplacement",
    category: "utility",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Vitesse +10%",
      rare: "Vitesse +20%",
      epic: "Vitesse +35%",
    },
  },
};

// --- Level thresholds ---

/** Scrap needed to reach level N */
export function scrapForLevel(level: number): number {
  // Early levels are cheap (5, 9, 13, 17, 21), curve kicks in after level 5
  const base = 5 + (level - 1) * 4;
  const lateBonus = Math.max(0, level - 5);
  return Math.floor(base + lateBonus * lateBonus * 1.5);
}

// --- Inventory limits ---

export const MAX_ITEM_SLOTS = 6;

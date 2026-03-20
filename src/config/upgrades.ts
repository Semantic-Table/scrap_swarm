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
    name: "Épée",
    description: "Coup d'épée devant le joueur",
    category: "weapon",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Cadence +10%",
      rare: "Dégâts +1, Portée +15%",
      epic: "Dégâts +2, Arc +30°, Cadence +20%",
    },
  },
  turret: {
    id: "turret",
    name: "Tourelle",
    description: "Tourelle orbitale qui tire sur l'ennemi le plus proche",
    category: "weapon",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Cadence +10%",
      rare: "Cadence +20%, Portée +20%",
      epic: "+1 tourelle, Cadence +10%",
    },
  },
  tesla: {
    id: "tesla",
    name: "Tesla",
    description: "Éclair en chaîne qui saute entre ennemis proches",
    category: "weapon",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "+1 rebond",
      rare: "+1 rebond, Dégâts +1",
      epic: "+2 rebonds, Dégâts +2",
    },
  },
  pulse: {
    id: "pulse",
    name: "Onde de choc",
    description: "Émet une onde de dégâts autour du joueur",
    category: "weapon",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Rayon +15%",
      rare: "Rayon +25%, Dégâts +1",
      epic: "Rayon +40%, Dégâts +2, Cooldown -20%",
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
      rare: "Rayon +40%, Vitesse +25%",
      epic: "Rayon +60%, Vitesse +50%",
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
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Recharge -15%",
      rare: "Recharge -25%, +1 charge",
      epic: "+2 charges, Recharge -30%",
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
  might: {
    id: "might",
    name: "Puissance",
    description: "Augmente les dégâts de toutes les armes",
    category: "utility",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Dégâts +1",
      rare: "Dégâts +2",
      epic: "Dégâts +3",
    },
  },
  swiftness: {
    id: "swiftness",
    name: "Célérité",
    description: "Réduit le cooldown de toutes les armes",
    category: "utility",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Cooldown -10%",
      rare: "Cooldown -15%",
      epic: "Cooldown -25%",
    },
  },
  reach: {
    id: "reach",
    name: "Portée",
    description: "Augmente la portée de toutes les armes",
    category: "utility",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "Portée +15%",
      rare: "Portée +25%",
      epic: "Portée +40%",
    },
  },
  multi: {
    id: "multi",
    name: "Quantité",
    description: "Plus de projectiles, rebonds, charges et tourelles",
    category: "utility",
    maxLevel: 5,
    upgradeDescriptions: {
      normal: "+1 sur toutes les armes",
      rare: "+1, +1 tourelle/charge",
      epic: "+2 sur toutes les armes",
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

// DEBUG: scrap multiplier — set to 100 for fast leveling, 1 for normal
export const DEBUG_SCRAP_MULT = 100;

// --- Inventory limits ---

export const MAX_ITEM_SLOTS = 6;

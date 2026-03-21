/** Permanent upgrades purchasable between runs with Cogs */

export interface GarageUpgradeDef {
  id: string;
  name: string;
  description: string;
  category: "core" | "loadout" | "advanced";
  maxLevel: number;
  costs: number[]; // cost for each level (length = maxLevel)
}

export const GARAGE_UPGRADES: GarageUpgradeDef[] = [
  // --- Core Systems ---
  {
    id: "hull",
    name: "Reinforced Hull",
    description: "+1 max HP at run start",
    category: "core",
    maxLevel: 3,
    costs: [30, 50, 80],
  },
  {
    id: "joints",
    name: "Overclocked Joints",
    description: "+5% move speed (permanent)",
    category: "core",
    maxLevel: 4,
    costs: [20, 30, 40, 60],
  },
  {
    id: "magnet_mk1",
    name: "Scrap Magnet Mk.I",
    description: "+25% scrap attract radius",
    category: "core",
    maxLevel: 2,
    costs: [25, 45],
  },
  {
    id: "combat_proto",
    name: "Combat Protocols",
    description: "+1 flat damage to all weapons",
    category: "core",
    maxLevel: 3,
    costs: [40, 60, 90],
  },
  {
    id: "refinery_chip",
    name: "Refinery Chip",
    description: "+1 scrap value per pickup",
    category: "core",
    maxLevel: 2,
    costs: [35, 60],
  },
  // --- Starting Loadout ---
  {
    id: "start_turret",
    name: "Turret Protocol",
    description: "Start each run with Turret Lv.1",
    category: "loadout",
    maxLevel: 1,
    costs: [50],
  },
  {
    id: "start_tesla",
    name: "Tesla Protocol",
    description: "Start each run with Tesla Lv.1",
    category: "loadout",
    maxLevel: 1,
    costs: [50],
  },
  {
    id: "start_pulse",
    name: "Pulse Protocol",
    description: "Start each run with Pulse Lv.1",
    category: "loadout",
    maxLevel: 1,
    costs: [50],
  },
  // --- Advanced Modules ---
  {
    id: "shield_gen",
    name: "Shield Generator",
    description: "Start with 1 free shield charge",
    category: "advanced",
    maxLevel: 1,
    costs: [70],
  },
  {
    id: "scavenger_eye",
    name: "Scavenger's Eye",
    description: "4 upgrade cards instead of 3",
    category: "advanced",
    maxLevel: 1,
    costs: [80],
  },
  {
    id: "veteran_core",
    name: "Veteran Core",
    description: "Start each run at Level 2",
    category: "advanced",
    maxLevel: 1,
    costs: [100],
  },
  {
    id: "overclock_cd",
    name: "Overclock Cooldowns",
    description: "-5% weapon cooldowns (permanent)",
    category: "advanced",
    maxLevel: 3,
    costs: [30, 50, 75],
  },
  {
    id: "hardened_shell",
    name: "Hardened Shell",
    description: "+0.5s invincibility after hit",
    category: "advanced",
    maxLevel: 2,
    costs: [35, 55],
  },
];

/** Calculate Cogs earned from a run (luckLevel adds +10% per level) */
export function calculateCogs(elapsed: number, totalKills: number, playerLevel: number, victory: boolean, luckLevel = 0): number {
  const timeBonus = Math.floor(elapsed / 10);
  const killBonus = Math.floor(totalKills / 25);
  const levelBonus = playerLevel * 2;
  const victoryBonus = victory ? 50 : 0;
  const base = timeBonus + killBonus + levelBonus + victoryBonus;
  const luckMult = 1 + luckLevel * 0.1;
  return Math.floor(base * luckMult);
}

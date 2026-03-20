/** Weapon evolution definitions — triggered when weapon + passive both reach level 5 */

export interface EvolutionDef {
  id: string;
  name: string;
  description: string;
  weaponId: string;     // required weapon item at level 5
  passiveId: string;    // required passive item at level 5
  color: number;
}

export const EVOLUTIONS: EvolutionDef[] = [
  {
    id: "whirlwind",
    name: "Whirlwind",
    description: "Sword becomes a permanent 360° spin. Damage scales with speed.",
    weaponId: "sword",
    passiveId: "booster",
    color: 0xf5c842,
  },
  {
    id: "storm",
    name: "Storm",
    description: "Tesla becomes a persistent lightning field hitting all enemies in range.",
    weaponId: "tesla",
    passiveId: "reach",
    color: 0x00e5ff,
  },
  {
    id: "drone_swarm",
    name: "Drone Swarm",
    description: "Turrets become autonomous drones that chase and shoot enemies.",
    weaponId: "turret",
    passiveId: "multi",
    color: 0x5dade2,
  },
  {
    id: "nova",
    name: "Nova",
    description: "Pulse becomes a massive explosion that knocks back enemies.",
    weaponId: "pulse",
    passiveId: "might",
    color: 0xff6b35,
  },
  {
    id: "counter_strike",
    name: "Counter Strike",
    description: "Shield absorbs trigger a powerful 360° counter-slash.",
    weaponId: "shield",
    passiveId: "sword",
    color: 0x3498db,
  },
];

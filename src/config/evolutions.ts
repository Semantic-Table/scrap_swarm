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
  // --- Original 5 ---
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
  // --- New 8 — one per new weapon ---
  {
    id: "buzzsaw",
    name: "Buzzsaw",
    description: "Boomerang becomes a permanent orbiting blade that circles the player.",
    weaponId: "boomerang",
    passiveId: "swiftness",
    color: 0xd4a047,
  },
  {
    id: "nuke_field",
    name: "Nuke Field",
    description: "Mines become nuclear — massive blast radius, chain reaction on kill.",
    weaponId: "mine",
    passiveId: "crit",
    color: 0xff4444,
  },
  {
    id: "death_ray",
    name: "Death Ray",
    description: "Laser becomes a continuous beam that follows the player's aim.",
    weaponId: "laser",
    passiveId: "might",
    color: 0xff0000,
  },
  {
    id: "plague",
    name: "Plague",
    description: "Aura infects enemies — they spread poison to others on death.",
    weaponId: "aura",
    passiveId: "regen",
    color: 0x1abc9c,
  },
  {
    id: "railgun",
    name: "Railgun",
    description: "Ricochet becomes a piercing rail that goes through all enemies and walls.",
    weaponId: "ricochet",
    passiveId: "armor",
    color: 0xcccccc,
  },
  {
    id: "black_hole",
    name: "Black Hole",
    description: "Gravity Well becomes permanent — always active, crushing enemies non-stop.",
    weaponId: "gravity",
    passiveId: "magnet",
    color: 0x6c3483,
  },
  {
    id: "massacre",
    name: "Massacre",
    description: "Chain Saw becomes 360° — spins around the player like a ring of death.",
    weaponId: "chainsaw",
    passiveId: "booster",
    color: 0xff6600,
  },
  {
    id: "fortress",
    name: "Fortress",
    description: "Sentries become permanent and gain shield — unkillable defense network.",
    weaponId: "sentry",
    passiveId: "luck",
    color: 0xaaaaaa,
  },
];

/**
 * Read permanent garage bonuses from localStorage.
 * Called at run start to apply bonuses to player creation and systems.
 */

import { loadProgress } from "./Progress";

function getLevel(id: string): number {
  const data = loadProgress();
  return data.garageUpgrades[id] ?? 0;
}

/** Extra max HP from Reinforced Hull */
export function getGarageHpBonus(): number {
  return getLevel("hull");
}

/** Speed multiplier from Overclocked Joints (+5% per level) */
export function getGarageSpeedMult(): number {
  return 1 + getLevel("joints") * 0.05;
}

/** Attract radius multiplier from Scrap Magnet Mk.I (+25% per level) */
export function getGarageAttractMult(): number {
  return 1 + getLevel("magnet_mk1") * 0.25;
}

/** Flat damage bonus from Combat Protocols */
export function getGarageDamageBonus(): number {
  return getLevel("combat_proto");
}

/** Flat scrap value bonus from Refinery Chip */
export function getGarageScrapBonus(): number {
  return getLevel("refinery_chip");
}

/** Starting weapon IDs from Protocols */
export function getGarageStartingWeapons(): string[] {
  const weapons: string[] = [];
  if (getLevel("start_turret") > 0) weapons.push("turret");
  if (getLevel("start_tesla") > 0) weapons.push("tesla");
  if (getLevel("start_pulse") > 0) weapons.push("pulse");
  return weapons;
}

/** Whether player starts with a free shield charge */
export function getGarageShieldGen(): boolean {
  return getLevel("shield_gen") > 0;
}

/** Whether upgrade screen shows 4 cards instead of 3 */
export function getGarageExtraChoice(): boolean {
  return getLevel("scavenger_eye") > 0;
}

/** Whether the run starts at level 2 */
export function getGarageVeteranCore(): boolean {
  return getLevel("veteran_core") > 0;
}

/** Cooldown reduction multiplier from Overclock (-5% per level) */
export function getGarageCooldownMult(): number {
  return 1 - getLevel("overclock_cd") * 0.05;
}

/** Extra invincibility seconds from Hardened Shell (+0.5s per level) */
export function getGarageInvincibilityBonus(): number {
  return getLevel("hardened_shell") * 0.5;
}

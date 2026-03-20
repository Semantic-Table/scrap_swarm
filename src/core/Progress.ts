import { ENEMY_TYPES } from "../config/constants";
import { ITEMS } from "../config/upgrades";

// --- Data shape ---

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  check: (data: ProgressData) => boolean;
}

export interface ProgressData {
  kills: Record<string, number>;       // enemy type name → total kills
  itemsDiscovered: string[];           // item IDs seen at least once
  evolutionsDiscovered: string[];      // evolution IDs unlocked at least once
  achievements: string[];              // achievement IDs unlocked
  bestTime: number;                    // longest survival in seconds
  bestKills: number;                   // most kills in a single run
  totalRuns: number;
}

// --- Achievements ---

export const ACHIEVEMENTS: AchievementDef[] = [
  // Kill milestones per type
  ...Object.keys(ENEMY_TYPES).flatMap((type) => [
    { id: `kill_${type}_50`, name: `${type} Hunter`, description: `Kill 50 ${type} enemies`, check: (d: ProgressData) => (d.kills[type] ?? 0) >= 50 },
    { id: `kill_${type}_200`, name: `${type} Slayer`, description: `Kill 200 ${type} enemies`, check: (d: ProgressData) => (d.kills[type] ?? 0) >= 200 },
  ]),
  // Total kill milestones
  { id: "total_500", name: "Scrapyard", description: "Kill 500 enemies total", check: (d) => totalKills(d) >= 500 },
  { id: "total_2000", name: "Junkyard King", description: "Kill 2000 enemies total", check: (d) => totalKills(d) >= 2000 },
  { id: "total_5000", name: "Metal Storm", description: "Kill 5000 enemies total", check: (d) => totalKills(d) >= 5000 },
  // Survival
  { id: "survive_3", name: "Survivor", description: "Survive 3 minutes", check: (d) => d.bestTime >= 180 },
  { id: "survive_5", name: "Enduring", description: "Survive 5 minutes", check: (d) => d.bestTime >= 300 },
  { id: "survive_8", name: "Iron Will", description: "Survive 8 minutes", check: (d) => d.bestTime >= 480 },
  { id: "victory", name: "Victor", description: "Survive the full 10 minutes", check: (d) => d.bestTime >= 600 },
  // Collection
  { id: "collect_5", name: "Collector", description: "Discover 5 different items", check: (d) => d.itemsDiscovered.length >= 5 },
  { id: "collect_all", name: "Encyclopedist", description: "Discover all items", check: (d) => d.itemsDiscovered.length >= Object.keys(ITEMS).length },
  // Runs
  { id: "runs_10", name: "Persistent", description: "Play 10 runs", check: (d) => d.totalRuns >= 10 },
  { id: "runs_50", name: "Addicted", description: "Play 50 runs", check: (d) => d.totalRuns >= 50 },
];

function totalKills(d: ProgressData): number {
  let sum = 0;
  for (const v of Object.values(d.kills)) sum += v;
  return sum;
}

// --- Persistence ---

const STORAGE_KEY = "scrapswarm_progress";

function defaultData(): ProgressData {
  return {
    kills: {},
    itemsDiscovered: [],
    evolutionsDiscovered: [],
    achievements: [],
    bestTime: 0,
    bestKills: 0,
    totalRuns: 0,
  };
}

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultData(), ...parsed };
    }
  } catch { /* ignore */ }
  return defaultData();
}

export function saveProgress(data: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

// --- Helpers ---

/** Record kills from a run. Returns newly unlocked achievement IDs. */
export function recordRun(
  elapsed: number,
  runKills: Record<string, number>,
  discoveredItems: string[],
  discoveredEvolutions: string[] = [],
): string[] {
  const data = loadProgress();

  // Merge kills
  for (const [type, count] of Object.entries(runKills)) {
    data.kills[type] = (data.kills[type] ?? 0) + count;
  }

  // Merge discovered items
  for (const id of discoveredItems) {
    if (!data.itemsDiscovered.includes(id)) {
      data.itemsDiscovered.push(id);
    }
  }

  // Merge discovered evolutions
  for (const id of discoveredEvolutions) {
    if (!data.evolutionsDiscovered.includes(id)) {
      data.evolutionsDiscovered.push(id);
    }
  }

  // Update bests
  data.bestTime = Math.max(data.bestTime, elapsed);
  let runTotal = 0;
  for (const v of Object.values(runKills)) runTotal += v;
  data.bestKills = Math.max(data.bestKills, runTotal);
  data.totalRuns++;

  // Check achievements
  const newlyUnlocked: string[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (!data.achievements.includes(ach.id) && ach.check(data)) {
      data.achievements.push(ach.id);
      newlyUnlocked.push(ach.name);
    }
  }

  saveProgress(data);
  return newlyUnlocked;
}

/** Get kill count for a specific enemy type across all runs */
export function getKillCount(type: string): number {
  const data = loadProgress();
  return data.kills[type] ?? 0;
}

/** Get total achievements unlocked vs total */
export function getAchievementProgress(): { unlocked: number; total: number } {
  const data = loadProgress();
  return { unlocked: data.achievements.length, total: ACHIEVEMENTS.length };
}

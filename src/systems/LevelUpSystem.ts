import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { PlayerLevel } from "../components/PlayerLevel";
import type { ScrapCollector } from "../components/ScrapCollector";
import { scrapForLevel } from "../config/upgrades";

export type OnLevelUpCallback = (level: number) => void;

export class LevelUpSystem implements System {
  readonly name = "LevelUpSystem";
  private world: World;
  private onLevelUp: OnLevelUpCallback;

  constructor(world: World, onLevelUp: OnLevelUpCallback) {
    this.world = world;
    this.onLevelUp = onLevelUp;
  }

  update(_dt: number): void {
    const players = this.world.query(["PlayerTag", "PlayerLevel", "ScrapCollector"]);
    if (players.length === 0) return;

    const playerLevel = this.world.getComponent<PlayerLevel>(players[0], "PlayerLevel")!;
    const collector = this.world.getComponent<ScrapCollector>(players[0], "ScrapCollector")!;

    // Track total scrap (scrap spent on levels is consumed)
    const nextLevel = playerLevel.level + 1;
    const needed = scrapForLevel(nextLevel);

    if (collector.amount >= needed) {
      collector.amount -= needed;
      playerLevel.level = nextLevel;
      playerLevel.totalScrapCollected += needed;
      this.onLevelUp(nextLevel);
    }
  }
}

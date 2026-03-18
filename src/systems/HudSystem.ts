import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { ScrapCollector } from "../components/ScrapCollector";
import type { WaveState } from "../components/Wave";
import type { PlayerLevel } from "../components/PlayerLevel";
import type { Shield } from "../components/Shield";
import { scrapForLevel } from "../config/upgrades";
import { FLOW_TARGET_TIME } from "../config/constants";
import { Text, TextStyle, Container } from "pixi.js";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export class HudSystem implements System {
  readonly name = "HudSystem";
  private world: World;
  private scrapText: Text;
  private timerText: Text;
  private levelText: Text;
  private shieldText: Text;
  private announceText: Text;
  private announceTimer = 0;

  constructor(world: World, hudLayer: Container, screenWidth: number) {
    this.world = world;

    const style = new TextStyle({
      fontFamily: "monospace",
      fontSize: 22,
      fontWeight: "bold",
      fill: 0x8c8c8c,
    });

    // Top left: scrap + level
    this.scrapText = new Text({ text: "Scrap: 0", style });
    this.scrapText.x = 16;
    this.scrapText.y = 16;
    hudLayer.addChild(this.scrapText);

    this.levelText = new Text({ text: "Niv. 0", style });
    this.levelText.x = 16;
    this.levelText.y = 44;
    hudLayer.addChild(this.levelText);

    // Top center: timer
    const timerStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 26,
      fontWeight: "bold",
      fill: 0xf0f0f0,
    });
    this.timerText = new Text({ text: "0:00", style: timerStyle });
    this.timerText.anchor.set(0.5, 0);
    this.timerText.x = screenWidth / 2;
    this.timerText.y = 16;
    hudLayer.addChild(this.timerText);

    // Top right: shield
    const shieldStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 18,
      fontWeight: "bold",
      fill: 0x3498db,
    });
    this.shieldText = new Text({ text: "", style: shieldStyle });
    this.shieldText.anchor.set(1, 0);
    this.shieldText.x = screenWidth - 16;
    this.shieldText.y = 16;
    hudLayer.addChild(this.shieldText);

    // Center announcement
    const announceStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 36,
      fontWeight: "bold",
      fill: 0xf0f0f0,
    });

    this.announceText = new Text({ text: "", style: announceStyle });
    this.announceText.anchor.set(0.5);
    this.announceText.visible = false;
    hudLayer.addChild(this.announceText);
  }

  update(dt: number): void {
    const players = this.world.query(["PlayerTag", "ScrapCollector"]);
    if (players.length > 0) {
      const playerId = players[0];
      const collector = this.world.getComponent<ScrapCollector>(playerId, "ScrapCollector")!;
      const playerLevel = this.world.getComponent<PlayerLevel>(playerId, "PlayerLevel");

      const level = playerLevel ? playerLevel.level : 0;
      const nextCost = scrapForLevel(level + 1);

      this.scrapText.text = `Scrap: ${collector.amount} / ${nextCost}`;
      this.levelText.text = `Niv. ${level}`;

      // Shield
      const shield = this.world.getComponent<Shield>(playerId, "Shield");
      if (shield) {
        this.shieldText.text = `Shield: ${"O".repeat(shield.charges)}${"·".repeat(shield.maxCharges - shield.charges)}`;
      } else {
        this.shieldText.text = "";
      }
    }

    // Timer
    const managers = this.world.query(["WaveState"]);
    if (managers.length > 0) {
      const state = this.world.getComponent<WaveState>(managers[0], "WaveState")!;
      const remaining = Math.max(0, FLOW_TARGET_TIME - state.elapsed);
      this.timerText.text = formatTime(remaining);

      // Change color when getting close to the end
      if (remaining <= 60) {
        this.timerText.style.fill = 0xd4a047;
      } else {
        this.timerText.style.fill = 0xf0f0f0;
      }
    }

    // Announce fade out
    if (this.announceTimer > 0) {
      this.announceTimer -= dt;
      this.announceText.alpha = Math.max(0, this.announceTimer / 1.5);
      if (this.announceTimer <= 0) {
        this.announceText.visible = false;
      }
    }
  }

  showAnnouncement(text: string, screenWidth: number, screenHeight: number): void {
    this.announceText.text = text;
    this.announceText.x = screenWidth / 2;
    this.announceText.y = screenHeight / 3;
    this.announceText.alpha = 1;
    this.announceText.visible = true;
    this.announceTimer = 2;
  }
}

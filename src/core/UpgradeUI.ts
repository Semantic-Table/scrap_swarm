import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { UpgradeChoice } from "./UpgradeManager";
import { RARITY_COLORS, RARITY_LABELS } from "../config/upgrades";

const CARD_WIDTH = 220;
const CARD_HEIGHT = 280;
const CARD_GAP = 30;
const CARD_RADIUS = 12;
const HIGHLIGHT_COLOR = 0xf5c842;

export class UpgradeUI {
  readonly container: Container;
  private onChoose: ((choice: UpgradeChoice) => void) | null = null;
  private overlay: Graphics;
  private cardContainers: Container[] = [];
  private cardHighlights: Graphics[] = [];
  private selectedIndex = 0;
  private cleanupList: Container[] = [];
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandlers: Array<() => void> = [];

  constructor() {
    this.container = new Container();
    this.container.visible = false;

    // Dark overlay
    this.overlay = new Graphics();
    this.container.addChild(this.overlay);
  }

  show(
    choices: UpgradeChoice[],
    screenWidth: number,
    screenHeight: number,
    onChoose: (choice: UpgradeChoice) => void,
  ): void {
    this.onChoose = onChoose;
    this.selectedIndex = 0;

    // Clear old
    for (const item of this.cleanupList) {
      this.container.removeChild(item);
      item.destroy({ children: true });
    }
    this.cleanupList = [];
    this.cardContainers = [];
    this.cardHighlights = [];
    this.removeClickHandlers();

    // Draw overlay
    this.overlay.clear();
    this.overlay.rect(0, 0, screenWidth, screenHeight).fill({ color: 0x000000, alpha: 0.6 });

    // Title
    const titleStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 32,
      fontWeight: "bold",
      fill: 0xf0f0f0,
    });
    const title = new Text({ text: "LEVEL UP", style: titleStyle });
    title.anchor.set(0.5);
    title.x = screenWidth / 2;
    title.y = screenHeight / 2 - CARD_HEIGHT / 2 - 50;
    this.container.addChild(title);
    this.cleanupList.push(title as unknown as Container);

    // Cards
    const totalWidth = choices.length * CARD_WIDTH + (choices.length - 1) * CARD_GAP;
    const startX = (screenWidth - totalWidth) / 2;

    for (let i = 0; i < choices.length; i++) {
      const { card, highlight } = this.createCard(choices[i]);
      card.x = startX + i * (CARD_WIDTH + CARD_GAP);
      card.y = screenHeight / 2 - CARD_HEIGHT / 2;
      this.container.addChild(card);
      this.cleanupList.push(card);
      this.cardContainers.push(card);
      this.cardHighlights.push(highlight);

      // Mouse hover + click
      card.eventMode = "static";
      card.cursor = "pointer";
      const onOver = () => { this.selectedIndex = i; this.updateHighlight(); };
      const onClick = () => { this.pick(choices[i]); };
      card.on("pointerover", onOver);
      card.on("pointertap", onClick);
      this.clickHandlers.push(() => {
        card.off("pointerover", onOver);
        card.off("pointertap", onClick);
      });
    }

    // Hint
    const hintStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 16,
      fill: 0x666666,
    });
    const hint = new Text({ text: "A/D pour choisir — Espace pour valider", style: hintStyle });
    hint.anchor.set(0.5);
    hint.x = screenWidth / 2;
    hint.y = screenHeight / 2 + CARD_HEIGHT / 2 + 30;
    this.container.addChild(hint);
    this.cleanupList.push(hint as unknown as Container);

    this.container.visible = true;
    this.updateHighlight();

    // Keyboard input
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === "KeyA" || e.code === "KeyQ" || e.code === "ArrowLeft") {
        this.selectedIndex = (this.selectedIndex - 1 + choices.length) % choices.length;
        this.updateHighlight();
      } else if (e.code === "KeyD" || e.code === "ArrowRight") {
        this.selectedIndex = (this.selectedIndex + 1) % choices.length;
        this.updateHighlight();
      } else if (e.code === "Space" || e.code === "Enter") {
        this.pick(choices[this.selectedIndex]);
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  hide(): void {
    this.container.visible = false;
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.removeClickHandlers();
  }

  private removeClickHandlers(): void {
    for (const cleanup of this.clickHandlers) cleanup();
    this.clickHandlers = [];
  }

  private pick(choice: UpgradeChoice): void {
    this.hide();
    if (this.onChoose) {
      this.onChoose(choice);
    }
  }

  private updateHighlight(): void {
    for (let i = 0; i < this.cardHighlights.length; i++) {
      const highlight = this.cardHighlights[i];
      const card = this.cardContainers[i];
      if (i === this.selectedIndex) {
        highlight.visible = true;
        card.scale.set(1.05);
      } else {
        highlight.visible = false;
        card.scale.set(1.0);
      }
    }
  }

  private createCard(choice: UpgradeChoice): { card: Container; highlight: Graphics } {
    const card = new Container();
    const rarityColor = RARITY_COLORS[choice.rarity];
    const borderColor = choice.isNew ? 0xf0f0f0 : rarityColor;

    // Selection highlight glow (hidden by default)
    const highlight = new Graphics();
    highlight.roundRect(-4, -4, CARD_WIDTH + 8, CARD_HEIGHT + 8, CARD_RADIUS + 2)
      .stroke({ color: HIGHLIGHT_COLOR, width: 3, alpha: 0.9 });
    highlight.roundRect(-6, -6, CARD_WIDTH + 12, CARD_HEIGHT + 12, CARD_RADIUS + 4)
      .stroke({ color: HIGHLIGHT_COLOR, width: 1, alpha: 0.4 });
    highlight.visible = false;
    card.addChild(highlight);

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
      .fill(0x1a1a2e);
    bg.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
      .stroke({ color: borderColor, width: 2 });
    card.addChild(bg);

    // "NEW" or rarity badge
    const badgeStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 12,
      fontWeight: "bold",
      fill: choice.isNew ? 0x2ecc71 : rarityColor,
    });
    const badge = new Text({
      text: choice.isNew ? "NOUVEAU" : RARITY_LABELS[choice.rarity].toUpperCase(),
      style: badgeStyle,
    });
    badge.anchor.set(0.5, 0);
    badge.x = CARD_WIDTH / 2;
    badge.y = 16;
    card.addChild(badge);

    // Item name
    const nameStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 20,
      fontWeight: "bold",
      fill: 0xf0f0f0,
      wordWrap: true,
      wordWrapWidth: CARD_WIDTH - 30,
    });
    const name = new Text({ text: choice.item.name, style: nameStyle });
    name.anchor.set(0.5, 0);
    name.x = CARD_WIDTH / 2;
    name.y = 40;
    card.addChild(name);

    // Category icon area
    const icon = new Graphics();
    const iconY = 85;
    if (choice.item.category === "weapon") {
      icon.poly([CARD_WIDTH / 2, iconY, CARD_WIDTH / 2 + 20, iconY + 35, CARD_WIDTH / 2 - 20, iconY + 35])
        .fill(borderColor);
    } else {
      icon.circle(CARD_WIDTH / 2, iconY + 17, 18)
        .fill(borderColor);
    }
    card.addChild(icon);

    // Description
    const descStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 13,
      fill: 0xaaaaaa,
      wordWrap: true,
      wordWrapWidth: CARD_WIDTH - 30,
      align: "center",
    });
    const desc = new Text({ text: choice.description, style: descStyle });
    desc.anchor.set(0.5, 0);
    desc.x = CARD_WIDTH / 2;
    desc.y = 140;
    card.addChild(desc);

    // Level info
    if (!choice.isNew) {
      const lvlStyle = new TextStyle({
        fontFamily: "monospace",
        fontSize: 12,
        fill: 0x666666,
      });
      const lvl = new Text({
        text: `Niv. ${choice.currentLevel} → ${choice.currentLevel + 1}`,
        style: lvlStyle,
      });
      lvl.anchor.set(0.5, 0);
      lvl.x = CARD_WIDTH / 2;
      lvl.y = CARD_HEIGHT - 30;
      card.addChild(lvl);
    }

    return { card, highlight };
  }
}

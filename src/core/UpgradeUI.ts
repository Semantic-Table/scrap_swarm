import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { UpgradeChoice } from "./UpgradeManager";
import { RARITY_COLORS, RARITY_LABELS } from "../config/upgrades";

const CARD_WIDTH = 220;
const CARD_HEIGHT = 280;
const CARD_GAP = 30;
const CARD_RADIUS = 12;

export class UpgradeUI {
  readonly container: Container;
  private onChoose: ((choice: UpgradeChoice) => void) | null = null;
  private overlay: Graphics;
  private cards: Container[] = [];
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

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

    // Clear old cards
    for (const card of this.cards) {
      this.container.removeChild(card);
      card.destroy({ children: true });
    }
    this.cards = [];

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
    this.cards.push(title as unknown as Container); // cleanup later

    // Cards
    const totalWidth = choices.length * CARD_WIDTH + (choices.length - 1) * CARD_GAP;
    const startX = (screenWidth - totalWidth) / 2;

    for (let i = 0; i < choices.length; i++) {
      const card = this.createCard(choices[i], i + 1);
      card.x = startX + i * (CARD_WIDTH + CARD_GAP);
      card.y = screenHeight / 2 - CARD_HEIGHT / 2;
      this.container.addChild(card);
      this.cards.push(card);
    }

    // Hint
    const hintStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 16,
      fill: 0x666666,
    });
    const hint = new Text({ text: "Appuie sur 1, 2, ou 3", style: hintStyle });
    hint.anchor.set(0.5);
    hint.x = screenWidth / 2;
    hint.y = screenHeight / 2 + CARD_HEIGHT / 2 + 30;
    this.container.addChild(hint);
    this.cards.push(hint as unknown as Container);

    this.container.visible = true;

    // Keyboard input
    this.keyHandler = (e: KeyboardEvent) => {
      const idx = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
      if (idx >= 0 && idx < choices.length) {
        this.pick(choices[idx]);
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
  }

  private pick(choice: UpgradeChoice): void {
    this.hide();
    if (this.onChoose) {
      this.onChoose(choice);
    }
  }

  private createCard(choice: UpgradeChoice, index: number): Container {
    const card = new Container();
    const rarityColor = RARITY_COLORS[choice.rarity];
    const borderColor = choice.isNew ? 0xf0f0f0 : rarityColor;

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
      .fill(0x1a1a2e);
    bg.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
      .stroke({ color: borderColor, width: 2 });
    card.addChild(bg);

    // Index number
    const indexStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 14,
      fill: 0x666666,
    });
    const indexText = new Text({ text: `[${index}]`, style: indexStyle });
    indexText.x = CARD_WIDTH / 2;
    indexText.y = 12;
    indexText.anchor.set(0.5, 0);
    card.addChild(indexText);

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
    badge.y = 32;
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
    name.y = 55;
    card.addChild(name);

    // Category icon area (simple shape)
    const icon = new Graphics();
    const iconY = 100;
    if (choice.item.category === "weapon") {
      // Triangle for weapons
      icon.poly([CARD_WIDTH / 2, iconY, CARD_WIDTH / 2 + 20, iconY + 35, CARD_WIDTH / 2 - 20, iconY + 35])
        .fill(borderColor);
    } else {
      // Circle for utilities
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
    desc.y = 155;
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

    return card;
  }

}

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { World } from "../ecs/World";
import type { ScrapCollector } from "../components/ScrapCollector";
import type { Inventory } from "../components/Inventory";
import type { Health } from "../components/Health";
import { ITEMS } from "../config/upgrades";
import { applyUpgrade } from "./UpgradeEffects";
import { checkEvolutions } from "./EvolutionManager";

const BTN_W = 120;
const BTN_H = 28;
const BTN_GAP = 4;
const COL_W = 130;

export class DebugUI {
  readonly container: Container;
  private world: World | null = null;
  private stage: Container | null = null;
  private visible = false;

  constructor() {
    this.container = new Container();
    this.container.visible = false;
  }

  toggle(world: World, stage: Container, screenW: number, screenH: number): boolean {
    this.visible = !this.visible;
    this.container.visible = this.visible;
    if (this.visible) {
      this.world = world;
      this.stage = stage;
      this.rebuild(screenW, screenH);
    }
    return this.visible;
  }

  hide(): void {
    this.visible = false;
    this.container.visible = false;
  }

  private rebuild(screenW: number, _screenH: number): void {
    // Clear old
    this.container.removeChildren();
    for (let i = this.container.children.length - 1; i >= 0; i--) {
      this.container.children[i].destroy({ children: true });
    }

    const world = this.world!;
    const stage = this.stage!;

    // Background panel
    const items = Object.values(ITEMS);
    const rows = items.length + 2; // +XP, +HP, then each item
    const panelW = COL_W * 2 + 20;
    const panelH = rows * (BTN_H + BTN_GAP) + 50;
    const px = screenW - panelW - 10;
    const py = 60;

    const bg = new Graphics();
    bg.roundRect(px, py, panelW, panelH, 8).fill({ color: 0x000000, alpha: 0.85 });
    bg.roundRect(px, py, panelW, panelH, 8).stroke({ color: 0x444444, width: 1 });
    this.container.addChild(bg);

    const titleText = new Text({
      text: "DEBUG (F1)",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 12, fontWeight: "bold", fill: 0xff4444 }),
    });
    titleText.x = px + 10;
    titleText.y = py + 6;
    this.container.addChild(titleText);

    let y = py + 28;

    // +1000 XP button
    this.addButton(px + 10, y, "+1000 XP", 0x2ecc71, () => {
      const players = world.query(["PlayerTag", "ScrapCollector"]);
      if (players.length > 0) {
        const c = world.getComponent<ScrapCollector>(players[0], "ScrapCollector")!;
        c.amount += 1000;
      }
    });

    // +HP button
    this.addButton(px + COL_W + 10, y, "+5 HP", 0xe74c3c, () => {
      const players = world.query(["PlayerTag", "Health"]);
      if (players.length > 0) {
        const h = world.getComponent<Health>(players[0], "Health")!;
        h.current = Math.min(h.max, h.current + 5);
      }
    });
    y += BTN_H + BTN_GAP;

    // One button per item — click to acquire or upgrade
    for (const item of items) {
      this.addButton(px + 10, y, item.name, 0xd4a047, () => {
        const players = world.query(["PlayerTag", "Inventory"]);
        if (players.length === 0) return;
        const inv = world.getComponent<Inventory>(players[0], "Inventory")!;
        const slot = inv.slots.find((s) => s.itemId === item.id);

        if (!slot) {
          // Acquire new
          applyUpgrade(
            { itemId: item.id, item, isNew: true, rarity: "epic", description: item.description, currentLevel: 0 },
            world, stage,
          );
        } else if (slot.level < item.maxLevel) {
          // Upgrade existing
          applyUpgrade(
            { itemId: item.id, item, isNew: false, rarity: "epic", description: item.upgradeDescriptions.epic, currentLevel: slot.level },
            world, stage,
          );
        }
        checkEvolutions(world);
        this.rebuild(screenW, _screenH);
      });

      // Show current level
      const players = world.query(["PlayerTag", "Inventory"]);
      let lvlStr = "—";
      if (players.length > 0) {
        const inv = world.getComponent<Inventory>(players[0], "Inventory")!;
        const slot = inv.slots.find((s) => s.itemId === item.id);
        lvlStr = slot ? `Lv.${slot.level}` : "—";
      }
      const lvl = new Text({
        text: lvlStr,
        style: new TextStyle({ fontFamily: "monospace", fontSize: 12, fill: 0x888888 }),
      });
      lvl.x = px + BTN_W + 20;
      lvl.y = y + 6;
      this.container.addChild(lvl);

      y += BTN_H + BTN_GAP;
    }

    // panel built
  }

  private addButton(x: number, y: number, label: string, color: number, onClick: () => void): void {
    const btn = new Container();
    btn.x = x;
    btn.y = y;

    const bg = new Graphics();
    bg.roundRect(0, 0, BTN_W, BTN_H, 4).fill({ color: 0x1a1a2e });
    bg.roundRect(0, 0, BTN_W, BTN_H, 4).stroke({ color, width: 1 });
    btn.addChild(bg);

    const txt = new Text({
      text: label,
      style: new TextStyle({ fontFamily: "monospace", fontSize: 11, fill: color }),
    });
    txt.anchor.set(0.5);
    txt.x = BTN_W / 2;
    txt.y = BTN_H / 2;
    btn.addChild(txt);

    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.on("pointerover", () => { bg.tint = 0x444444; });
    btn.on("pointerout", () => { bg.tint = 0xffffff; });
    btn.on("pointertap", onClick);

    this.container.addChild(btn);
  }
}

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { World } from "../ecs/World";
import type { ScrapCollector } from "../components/ScrapCollector";
import type { Inventory } from "../components/Inventory";
import type { Health } from "../components/Health";
import { ITEMS } from "../config/upgrades";
import { EVOLUTIONS } from "../config/evolutions";
import type { EvolutionState } from "../components/Evolution";
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
  private scrollContent: Container | null = null;
  private scrollMask: Graphics | null = null;
  private scrollY = 0;
  private contentHeight = 0;
  private panelH = 0;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;

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
      this.scrollY = 0;
      this.rebuild(screenW, screenH);
      this.wheelHandler = (e: WheelEvent) => {
        this.scrollY = Math.max(0, Math.min(
          Math.max(0, this.contentHeight - this.panelH + 60),
          this.scrollY + e.deltaY * 0.5,
        ));
        if (this.scrollContent) this.scrollContent.y = -this.scrollY;
        e.preventDefault();
      };
      window.addEventListener("wheel", this.wheelHandler, { passive: false });
    } else {
      if (this.wheelHandler) {
        window.removeEventListener("wheel", this.wheelHandler);
        this.wheelHandler = null;
      }
    }
    return this.visible;
  }

  hide(): void {
    this.visible = false;
    this.container.visible = false;
    if (this.wheelHandler) {
      window.removeEventListener("wheel", this.wheelHandler);
      this.wheelHandler = null;
    }
  }

  private rebuild(screenW: number, screenH: number): void {
    const old = this.container.removeChildren();
    for (const child of old) child.destroy({ children: true });

    const world = this.world!;
    const stage = this.stage!;

    const items = Object.values(ITEMS);
    const panelW = COL_W * 2 + 20;
    this.panelH = screenH - 20;
    const px = screenW - panelW - 10;
    const py = 10;

    // Panel background
    const bg = new Graphics();
    bg.roundRect(px, py, panelW, this.panelH, 8).fill({ color: 0x000000, alpha: 0.85 });
    bg.roundRect(px, py, panelW, this.panelH, 8).stroke({ color: 0x444444, width: 1 });
    this.container.addChild(bg);

    const titleText = new Text({
      text: "DEBUG (F1) — Scroll ↕",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 11, fontWeight: "bold", fill: 0xff4444 }),
    });
    titleText.x = px + 10;
    titleText.y = py + 6;
    this.container.addChild(titleText);

    // Scrollable content
    const contentTop = py + 24;
    const contentAreaH = this.panelH - 34;

    this.scrollContent = new Container();
    this.container.addChild(this.scrollContent);

    this.scrollMask = new Graphics();
    this.scrollMask.rect(px, contentTop, panelW, contentAreaH).fill(0xffffff);
    this.container.addChild(this.scrollMask);
    this.scrollContent.mask = this.scrollMask;
    this.scrollContent.y = -this.scrollY;

    let y = contentTop + 4;

    // +XP / +HP buttons
    this.addButton(this.scrollContent, px + 10, y, "+1000 XP", 0x2ecc71, () => {
      const players = world.query(["PlayerTag", "ScrapCollector"]);
      if (players.length > 0) {
        const c = world.getComponent<ScrapCollector>(players[0], "ScrapCollector")!;
        c.amount += 1000;
      }
    });
    this.addButton(this.scrollContent, px + COL_W + 10, y, "+5 HP", 0xe74c3c, () => {
      const players = world.query(["PlayerTag", "Health"]);
      if (players.length > 0) {
        const h = world.getComponent<Health>(players[0], "Health")!;
        h.current = Math.min(h.max, h.current + 5);
      }
    });
    y += BTN_H + BTN_GAP;

    // Item buttons
    const itemLabel = new Text({
      text: "ITEMS",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 10, fontWeight: "bold", fill: 0x888888 }),
    });
    itemLabel.x = px + 10;
    itemLabel.y = y;
    this.scrollContent.addChild(itemLabel);
    y += 14;

    for (const item of items) {
      this.addButton(this.scrollContent, px + 10, y, item.name, 0xd4a047, () => {
        const players = world.query(["PlayerTag", "Inventory"]);
        if (players.length === 0) return;
        const inv = world.getComponent<Inventory>(players[0], "Inventory")!;
        const slot = inv.slots.find((s) => s.itemId === item.id);

        if (!slot) {
          applyUpgrade(
            { itemId: item.id, item, isNew: true, rarity: "epic", description: item.description, currentLevel: 0 },
            world, stage,
          );
        } else if (slot.level < item.maxLevel) {
          applyUpgrade(
            { itemId: item.id, item, isNew: false, rarity: "epic", description: item.upgradeDescriptions.epic, currentLevel: slot.level },
            world, stage,
          );
        }
        checkEvolutions(world);
        this.rebuild(screenW, screenH);
      });

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
      this.scrollContent.addChild(lvl);

      y += BTN_H + BTN_GAP;
    }

    // Evolution buttons
    const evoLabel = new Text({
      text: "EVOLUTIONS",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 10, fontWeight: "bold", fill: 0xf1c40f }),
    });
    evoLabel.x = px + 10;
    evoLabel.y = y + 4;
    this.scrollContent.addChild(evoLabel);
    y += 16;

    const evoPlayers = world.query(["PlayerTag", "EvolutionState"]);
    const evoState = evoPlayers.length > 0
      ? world.getComponent<EvolutionState>(evoPlayers[0], "EvolutionState")
      : null;

    for (const evo of EVOLUTIONS) {
      const active = evoState?.active.includes(evo.id) ?? false;
      this.addButton(this.scrollContent, px + 10, y, active ? `✓ ${evo.name}` : evo.name, active ? 0x666666 : evo.color, () => {
        if (active || !evoState) return;

        const inv = world.getComponent<Inventory>(evoPlayers[0], "Inventory")!;
        for (const requiredId of [evo.weaponId, evo.passiveId]) {
          let slot = inv.slots.find((s) => s.itemId === requiredId);
          if (!slot) {
            const item = ITEMS[requiredId];
            if (item) {
              applyUpgrade(
                { itemId: requiredId, item, isNew: true, rarity: "epic", description: item.description, currentLevel: 0 },
                world, stage,
              );
              slot = inv.slots.find((s) => s.itemId === requiredId);
            }
          }
          if (slot) {
            while (slot.level < 5) {
              const item = ITEMS[slot.itemId];
              if (!item) break;
              applyUpgrade(
                { itemId: slot.itemId, item, isNew: false, rarity: "epic", description: item.upgradeDescriptions.epic, currentLevel: slot.level },
                world, stage,
              );
            }
          }
        }

        checkEvolutions(world);
        if (!evoState.active.includes(evo.id)) {
          evoState.active.push(evo.id);
        }
        this.rebuild(screenW, screenH);
      });
      y += BTN_H + BTN_GAP;
    }

    this.contentHeight = y - contentTop;

    // Touch drag
    bg.eventMode = "static";
    let dragStartY = 0;
    let dragScrollStart = 0;
    bg.on("pointerdown", (e) => { dragStartY = e.globalY; dragScrollStart = this.scrollY; });
    bg.on("pointermove", (e) => {
      if (e.pressure > 0 && this.scrollContent) {
        const delta = dragStartY - e.globalY;
        const maxScroll = Math.max(0, this.contentHeight - contentAreaH);
        this.scrollY = Math.max(0, Math.min(maxScroll, dragScrollStart + delta));
        this.scrollContent.y = -this.scrollY;
      }
    });
  }

  private addButton(parent: Container, x: number, y: number, label: string, color: number, onClick: () => void): void {
    const btn = new Container();
    btn.x = x;
    btn.y = y;

    const bg = new Graphics();
    bg.roundRect(0, 0, BTN_W, BTN_H, 4).fill({ color: 0x1a1a2e });
    bg.roundRect(0, 0, BTN_W, BTN_H, 4).stroke({ color, width: 1 });
    btn.addChild(bg);

    const txt = new Text({
      text: label,
      style: new TextStyle({ fontFamily: "monospace", fontSize: 10, fill: color }),
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

    parent.addChild(btn);
  }
}

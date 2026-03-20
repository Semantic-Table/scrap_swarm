import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { ENEMY_TYPES, type EnemyTypeName } from "../config/constants";
import { ITEMS } from "../config/upgrades";
import { EVOLUTIONS } from "../config/evolutions";
import { loadProgress, ACHIEVEMENTS } from "./Progress";

const TAB_H = 40;
const PANEL_PAD = 20;

const ENEMY_DESCRIPTIONS: Record<EnemyTypeName, string> = {
  basic: "Standard melee unit. Slow but relentless.",
  runner: "Fast and fragile. Rushes in packs.",
  tank: "Heavy armor. Drops extra scrap.",
  swarm: "Tiny but numerous. Overwhelms by sheer count.",
  shooter: "Ranged attacker. Stops at distance and fires.",
};

export class CodexUI {
  readonly container: Container;
  private overlay: Graphics;
  private panel: Container;
  private currentTab = 0;
  private screenW = 0;
  private screenH = 0;
  private onClose: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.container = new Container();
    this.container.visible = false;
    this.overlay = new Graphics();
    this.container.addChild(this.overlay);
    this.panel = new Container();
    this.container.addChild(this.panel);
  }

  show(screenW: number, screenH: number, onClose: () => void): void {
    this.screenW = screenW;
    this.screenH = screenH;
    this.onClose = onClose;
    this.container.visible = true;

    this.overlay.clear();
    this.overlay.rect(0, 0, screenW, screenH).fill({ color: 0x000000, alpha: 0.85 });

    this.currentTab = 0;
    this.buildPanel();

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "Backspace") {
        this.hide();
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        this.currentTab = (this.currentTab + 1) % 3;
        this.buildPanel();
      } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
        this.currentTab = (this.currentTab + 2) % 3;
        this.buildPanel();
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
    if (this.onClose) this.onClose();
  }

  private buildPanel(): void {
    this.panel.removeChildren();
    this.panel.destroy({ children: true });
    this.panel = new Container();
    this.container.addChild(this.panel);

    const data = loadProgress();
    const tabs = ["Bestiary", "Items", "Achievements"];

    // Tab bar
    const tabW = 140;
    const tabStartX = (this.screenW - tabs.length * tabW) / 2;
    for (let i = 0; i < tabs.length; i++) {
      const tabBg = new Graphics();
      const active = i === this.currentTab;
      tabBg.roundRect(0, 0, tabW - 4, TAB_H, 6)
        .fill({ color: active ? 0x2a2a3a : 0x111118 });
      tabBg.x = tabStartX + i * tabW;
      tabBg.y = 60;
      tabBg.eventMode = "static";
      tabBg.cursor = "pointer";
      tabBg.on("pointertap", () => { this.currentTab = i; this.buildPanel(); });
      this.panel.addChild(tabBg);

      const tabLabel = new Text({
        text: tabs[i],
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 16,
          fontWeight: active ? "bold" : "normal",
          fill: active ? 0xd4a047 : 0x666666,
        }),
      });
      tabLabel.anchor.set(0.5);
      tabLabel.x = tabStartX + i * tabW + (tabW - 4) / 2;
      tabLabel.y = 60 + TAB_H / 2;
      this.panel.addChild(tabLabel);
    }

    const contentY = 60 + TAB_H + PANEL_PAD;

    switch (this.currentTab) {
      case 0: this.buildBestiary(data, contentY); break;
      case 1: this.buildItems(data, contentY); break;
      case 2: this.buildAchievements(data, contentY); break;
    }

    // Close hint
    const hint = new Text({
      text: "ESC to close",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 14, fill: 0x555555 }),
    });
    hint.anchor.set(0.5);
    hint.x = this.screenW / 2;
    hint.y = this.screenH - 30;
    this.panel.addChild(hint);
  }

  private buildBestiary(data: ReturnType<typeof loadProgress>, startY: number): void {
    const types = Object.keys(ENEMY_TYPES) as EnemyTypeName[];
    const colW = 280;
    const rowH = 60;
    const startX = (this.screenW - colW) / 2;

    const title = this.makeTitle("Bestiary", this.screenW / 2, startY - 10);
    this.panel.addChild(title);

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const config = ENEMY_TYPES[type];
      const kills = data.kills[type] ?? 0;
      const discovered = kills > 0;
      const y = startY + 20 + i * rowH;

      // Enemy color dot
      const dot = new Graphics();
      dot.circle(startX, y + 12, 8).fill(discovered ? config.color : 0x333333);
      this.panel.addChild(dot);

      // Name + kills
      const name = new Text({
        text: discovered ? `${type.charAt(0).toUpperCase() + type.slice(1)}` : "???",
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 16,
          fontWeight: "bold",
          fill: discovered ? 0xf0f0f0 : 0x444444,
        }),
      });
      name.x = startX + 20;
      name.y = y;
      this.panel.addChild(name);

      const desc = new Text({
        text: discovered ? `${ENEMY_DESCRIPTIONS[type]}  —  ${kills} killed` : "Not yet encountered",
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 12,
          fill: discovered ? 0x888888 : 0x333333,
        }),
      });
      desc.x = startX + 20;
      desc.y = y + 20;
      this.panel.addChild(desc);
    }
  }

  private buildItems(data: ReturnType<typeof loadProgress>, startY: number): void {
    const items = Object.values(ITEMS);
    const colW = 340;
    const startX = (this.screenW - colW) / 2;

    const title = this.makeTitle("Item Encyclopedia", this.screenW / 2, startY - 10);
    this.panel.addChild(title);

    let y = startY + 20;

    for (const item of items) {
      const discovered = data.itemsDiscovered.includes(item.id);

      const name = new Text({
        text: discovered ? item.name : "???",
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 15,
          fontWeight: "bold",
          fill: discovered ? 0xf0f0f0 : 0x444444,
        }),
      });
      name.x = startX;
      name.y = y;
      this.panel.addChild(name);

      const desc = new Text({
        text: discovered ? item.description : "Not yet discovered",
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 12,
          fill: discovered ? 0x888888 : 0x333333,
        }),
      });
      desc.x = startX;
      desc.y = y + 18;
      this.panel.addChild(desc);

      y += 36;

      // Show evolution if discovered (linked to this item as weapon or passive)
      if (discovered) {
        const evo = EVOLUTIONS.find((e) => e.weaponId === item.id || e.passiveId === item.id);
        if (evo) {
          const evoDiscovered = data.evolutionsDiscovered.includes(evo.id);
          const evoText = new Text({
            text: evoDiscovered
              ? `★ ${evo.name}: ${evo.description}`
              : "★ Evolution: ???",
            style: new TextStyle({
              fontFamily: "monospace",
              fontSize: 11,
              fill: evoDiscovered ? evo.color : 0x333333,
              wordWrap: true,
              wordWrapWidth: colW,
            }),
          });
          evoText.x = startX + 12;
          evoText.y = y;
          this.panel.addChild(evoText);
          y += 20;
        }
      }

      y += 8;
    }
  }

  private buildAchievements(data: ReturnType<typeof loadProgress>, startY: number): void {
    const colW = 320;
    const rowH = 45;
    const startX = (this.screenW - colW) / 2;

    const title = this.makeTitle(
      `Achievements (${data.achievements.length}/${ACHIEVEMENTS.length})`,
      this.screenW / 2,
      startY - 10,
    );
    this.panel.addChild(title);

    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const ach = ACHIEVEMENTS[i];
      const unlocked = data.achievements.includes(ach.id);
      const y = startY + 20 + i * rowH;

      const icon = new Text({
        text: unlocked ? "★" : "☆",
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 18,
          fill: unlocked ? 0xf1c40f : 0x333333,
        }),
      });
      icon.x = startX - 5;
      icon.y = y;
      this.panel.addChild(icon);

      const name = new Text({
        text: unlocked ? ach.name : "???",
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 14,
          fontWeight: "bold",
          fill: unlocked ? 0xf0f0f0 : 0x444444,
        }),
      });
      name.x = startX + 22;
      name.y = y;
      this.panel.addChild(name);

      const desc = new Text({
        text: unlocked ? ach.description : "???",
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 12,
          fill: unlocked ? 0x888888 : 0x333333,
        }),
      });
      desc.x = startX + 22;
      desc.y = y + 18;
      this.panel.addChild(desc);
    }
  }

  private makeTitle(text: string, x: number, y: number): Text {
    const t = new Text({
      text,
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 22,
        fontWeight: "bold",
        fill: 0xd4a047,
      }),
    });
    t.anchor.set(0.5, 0);
    t.x = x;
    t.y = y;
    return t;
  }
}

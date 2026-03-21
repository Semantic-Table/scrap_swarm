import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { ENEMY_TYPES, type EnemyTypeName } from "../config/constants";
import { ITEMS } from "../config/upgrades";
import { EVOLUTIONS } from "../config/evolutions";
import { loadProgress, ACHIEVEMENTS } from "./Progress";

const TAB_H = 40;
const PANEL_PAD = 20;
const PANEL_W = 460;
const PANEL_RADIUS = 10;

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
  private scrollContent: Container;
  private scrollMask: Graphics;
  private currentTab = 0;
  private screenW = 0;
  private screenH = 0;
  private scrollY = 0;
  private contentHeight = 0;
  private panelX = 0;
  private panelY = 0;
  private panelH = 0;
  private contentAreaH = 0;
  private onClose: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;

  constructor() {
    this.container = new Container();
    this.container.visible = false;
    this.overlay = new Graphics();
    this.container.addChild(this.overlay);
    this.panel = new Container();
    this.container.addChild(this.panel);
    this.scrollContent = new Container();
    this.scrollMask = new Graphics();
  }

  show(screenW: number, screenH: number, onClose: () => void): void {
    this.screenW = screenW;
    this.screenH = screenH;
    this.onClose = onClose;
    this.container.visible = true;
    this.scrollY = 0;

    this.overlay.clear();

    this.currentTab = 0;
    this.buildPanel();

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "Backspace") {
        this.hide();
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        this.currentTab = (this.currentTab + 1) % 3;
        this.scrollY = 0;
        this.buildPanel();
      } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
        this.currentTab = (this.currentTab + 2) % 3;
        this.scrollY = 0;
        this.buildPanel();
      } else if (e.code === "ArrowUp") {
        this.scroll(-40);
      } else if (e.code === "ArrowDown") {
        this.scroll(40);
      }
    };
    window.addEventListener("keydown", this.keyHandler);

    this.wheelHandler = (e: WheelEvent) => {
      this.scroll(e.deltaY * 0.5);
      e.preventDefault();
    };
    window.addEventListener("wheel", this.wheelHandler, { passive: false });
  }

  hide(): void {
    this.container.visible = false;
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    if (this.wheelHandler) {
      window.removeEventListener("wheel", this.wheelHandler);
      this.wheelHandler = null;
    }
    if (this.onClose) this.onClose();
  }

  private scroll(delta: number): void {
    const maxScroll = Math.max(0, this.contentHeight - this.contentAreaH);
    this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + delta));
    this.scrollContent.y = -this.scrollY;
  }

  private buildPanel(): void {
    this.panel.destroy({ children: true });
    this.panel = new Container();
    this.container.addChild(this.panel);

    const data = loadProgress();
    const tabs = ["Bestiary", "Items", "Achievements"];

    // Panel dimensions
    const pw = Math.min(PANEL_W, this.screenW - 40);
    this.panelX = (this.screenW - pw) / 2;
    this.panelY = 50;
    this.panelH = this.screenH - 100;

    // Panel background card
    const bg = new Graphics();
    bg.roundRect(this.panelX, this.panelY, pw, this.panelH, PANEL_RADIUS)
      .fill({ color: 0x12121e });
    bg.roundRect(this.panelX, this.panelY, pw, this.panelH, PANEL_RADIUS)
      .stroke({ color: 0x2a2a3a, width: 1 });
    this.panel.addChild(bg);

    // Tab bar (fixed, not scrollable)
    const tabW = Math.min(140, (pw - 20) / 3);
    const tabStartX = this.panelX + (pw - tabs.length * tabW) / 2;
    const tabY = this.panelY + 12;

    for (let i = 0; i < tabs.length; i++) {
      const tabBg = new Graphics();
      const active = i === this.currentTab;
      tabBg.roundRect(0, 0, tabW - 4, TAB_H, 6)
        .fill({ color: active ? 0x2a2a3a : 0x18182a });
      tabBg.x = tabStartX + i * tabW;
      tabBg.y = tabY;
      tabBg.eventMode = "static";
      tabBg.cursor = "pointer";
      tabBg.on("pointertap", () => { this.currentTab = i; this.scrollY = 0; this.buildPanel(); });
      this.panel.addChild(tabBg);

      const tabLabel = new Text({
        text: tabs[i],
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 14,
          fontWeight: active ? "bold" : "normal",
          fill: active ? 0xd4a047 : 0x666666,
        }),
      });
      tabLabel.anchor.set(0.5);
      tabLabel.x = tabStartX + i * tabW + (tabW - 4) / 2;
      tabLabel.y = tabY + TAB_H / 2;
      this.panel.addChild(tabLabel);
    }

    // Scrollable content area
    const contentTop = tabY + TAB_H + PANEL_PAD;
    this.contentAreaH = this.panelH - (contentTop - this.panelY) - 40;
    const contentAreaH = this.contentAreaH;

    this.scrollContent = new Container();
    this.scrollContent.x = 0;
    this.scrollContent.y = -this.scrollY;
    this.panel.addChild(this.scrollContent);

    // Mask to clip content within the panel
    this.scrollMask = new Graphics();
    this.scrollMask.rect(this.panelX + 4, contentTop, pw - 8, contentAreaH).fill(0xffffff);
    this.panel.addChild(this.scrollMask);
    this.scrollContent.mask = this.scrollMask;

    // Build content into scrollContent
    const startX = this.panelX + 24;
    const colW = pw - 48;

    switch (this.currentTab) {
      case 0: this.contentHeight = this.buildBestiary(data, contentTop + 10, startX, colW); break;
      case 1: this.contentHeight = this.buildItems(data, contentTop + 10, startX, colW); break;
      case 2: this.contentHeight = this.buildAchievements(data, contentTop + 10, startX, colW); break;
    }

    // Close hint (fixed)
    const hint = new Text({
      text: "ESC to close  |  Scroll ↑↓",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 12, fill: 0x444444 }),
    });
    hint.anchor.set(0.5);
    hint.x = this.screenW / 2;
    hint.y = this.panelY + this.panelH - 16;
    this.panel.addChild(hint);

    // Touch drag for scroll
    bg.eventMode = "static";
    let dragStartY = 0;
    let dragScrollStart = 0;
    bg.on("pointerdown", (e) => {
      dragStartY = e.globalY;
      dragScrollStart = this.scrollY;
    });
    bg.on("pointermove", (e) => {
      if (e.pressure > 0) {
        const delta = dragStartY - e.globalY;
        this.scrollY = Math.max(0, dragScrollStart + delta);
        const maxScroll = Math.max(0, this.contentHeight - this.contentAreaH);
        this.scrollY = Math.min(maxScroll, this.scrollY);
        this.scrollContent.y = -this.scrollY;
      }
    });
  }

  private buildBestiary(data: ReturnType<typeof loadProgress>, startY: number, startX: number, _colW: number): number {
    const types = Object.keys(ENEMY_TYPES) as EnemyTypeName[];
    const rowH = 56;
    let y = startY;

    for (const type of types) {
      const config = ENEMY_TYPES[type];
      const kills = data.kills[type] ?? 0;
      const discovered = kills > 0;

      const dot = new Graphics();
      dot.circle(startX, y + 12, 8).fill(discovered ? config.color : 0x333333);
      this.scrollContent.addChild(dot);

      const name = new Text({
        text: discovered ? type.charAt(0).toUpperCase() + type.slice(1) : "???",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 15, fontWeight: "bold", fill: discovered ? 0xf0f0f0 : 0x444444 }),
      });
      name.x = startX + 20;
      name.y = y;
      this.scrollContent.addChild(name);

      const desc = new Text({
        text: discovered ? `${ENEMY_DESCRIPTIONS[type]}  —  ${kills} killed` : "Not yet encountered",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 11, fill: discovered ? 0x888888 : 0x333333 }),
      });
      desc.x = startX + 20;
      desc.y = y + 20;
      this.scrollContent.addChild(desc);

      y += rowH;
    }

    return y - startY;
  }

  private buildItems(data: ReturnType<typeof loadProgress>, startY: number, startX: number, colW: number): number {
    let y = startY;

    for (const item of Object.values(ITEMS)) {
      const discovered = data.itemsDiscovered.includes(item.id);

      const name = new Text({
        text: discovered ? item.name : "???",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 14, fontWeight: "bold", fill: discovered ? 0xf0f0f0 : 0x444444 }),
      });
      name.x = startX;
      name.y = y;
      this.scrollContent.addChild(name);

      const desc = new Text({
        text: discovered ? item.description : "Not yet discovered",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 11, fill: discovered ? 0x888888 : 0x333333 }),
      });
      desc.x = startX;
      desc.y = y + 18;
      this.scrollContent.addChild(desc);
      y += 34;

      // Evolution linked to this item
      if (discovered) {
        const evo = EVOLUTIONS.find((e) => e.weaponId === item.id || e.passiveId === item.id);
        if (evo) {
          const evoDiscovered = data.evolutionsDiscovered.includes(evo.id);
          const evoText = new Text({
            text: evoDiscovered ? `★ ${evo.name}: ${evo.description}` : "★ Evolution: ???",
            style: new TextStyle({
              fontFamily: "monospace", fontSize: 10,
              fill: evoDiscovered ? evo.color : 0x333333,
              wordWrap: true, wordWrapWidth: colW,
            }),
          });
          evoText.x = startX + 12;
          evoText.y = y;
          this.scrollContent.addChild(evoText);
          y += 18;
        }
      }

      y += 8;
    }

    return y - startY;
  }

  private buildAchievements(data: ReturnType<typeof loadProgress>, startY: number, startX: number, _colW: number): number {
    let y = startY;
    const rowH = 42;

    for (const ach of ACHIEVEMENTS) {
      const unlocked = data.achievements.includes(ach.id);

      const icon = new Text({
        text: unlocked ? "★" : "☆",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 16, fill: unlocked ? 0xf1c40f : 0x333333 }),
      });
      icon.x = startX;
      icon.y = y;
      this.scrollContent.addChild(icon);

      const name = new Text({
        text: unlocked ? ach.name : "???",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 13, fontWeight: "bold", fill: unlocked ? 0xf0f0f0 : 0x444444 }),
      });
      name.x = startX + 22;
      name.y = y;
      this.scrollContent.addChild(name);

      const desc = new Text({
        text: unlocked ? ach.description : "???",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 11, fill: unlocked ? 0x888888 : 0x333333 }),
      });
      desc.x = startX + 22;
      desc.y = y + 17;
      this.scrollContent.addChild(desc);

      y += rowH;
    }

    return y - startY;
  }
}

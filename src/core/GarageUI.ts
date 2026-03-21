import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { GARAGE_UPGRADES, type GarageUpgradeDef } from "../config/garageUpgrades";
import { getCogs, getGarageLevel, purchaseGarageUpgrade } from "./Progress";
import { showRewardedAd } from "./CrazyGamesSDK";

const PANEL_W = 480;
const ROW_H = 52;
const PANEL_RADIUS = 10;
const COG_COLOR = 0xf1c40f;
const CATEGORY_COLORS: Record<string, number> = {
  core: 0x2ecc71,
  loadout: 0x5dade2,
  advanced: 0xd4a047,
};

export class GarageUI {
  readonly container: Container;
  private panel: Container;
  private scrollContent: Container;
  private scrollMask: Graphics;
  private onClose: ((bonusHp: number) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private scrollY = 0;
  private contentHeight = 0;
  private contentAreaH = 0;
  private cogsEarned = 0;
  private _screenW = 0;
  private _screenH = 0;
  private _runTime = 0;
  private _runKills = 0;
  private _runLevel = 0;
  private _isDeath = false;
  private _adBonusHp = 0;

  constructor() {
    this.container = new Container();
    this.container.visible = false;
    this.panel = new Container();
    this.scrollContent = new Container();
    this.scrollMask = new Graphics();
  }

  show(
    screenW: number,
    screenH: number,
    cogsEarned: number,
    runTime: number,
    runKills: number,
    runLevel: number,
    isDeath: boolean,
    onClose: (bonusHp: number) => void,
  ): void {
    this.onClose = onClose;
    this.cogsEarned = cogsEarned;
    this._screenW = screenW;
    this._screenH = screenH;
    this._runTime = runTime;
    this._runKills = runKills;
    this._runLevel = runLevel;
    this._isDeath = isDeath;
    this._adBonusHp = 0;
    this.scrollY = 0;
    this.container.visible = true;

    this.buildPanel(screenW, screenH, runTime, runKills, runLevel);

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "Enter" || e.code === "Space") {
        this.hide();
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
    if (this.onClose) this.onClose(this._adBonusHp);
  }

  private scroll(delta: number): void {
    const maxScroll = Math.max(0, this.contentHeight - this.contentAreaH);
    this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + delta));
    this.scrollContent.y = -this.scrollY;
  }

  private buildPanel(screenW: number, screenH: number, runTime: number, runKills: number, runLevel: number): void {
    // Clean old
    if (this.panel.parent) this.panel.destroy({ children: true });
    this.panel = new Container();
    this.container.addChild(this.panel);

    const pw = Math.min(PANEL_W, screenW - 40);
    const px = (screenW - pw) / 2;
    const py = 30;
    const panelH = screenH - 60;

    // Panel card background
    const bg = new Graphics();
    bg.roundRect(px, py, pw, panelH, PANEL_RADIUS).fill({ color: 0x12121e });
    bg.roundRect(px, py, pw, panelH, PANEL_RADIUS).stroke({ color: 0x2a2a3a, width: 1 });
    this.panel.addChild(bg);

    // --- Header: run summary + cogs ---
    let y = py + 16;

    const titleText = new Text({
      text: "THE GARAGE",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 22, fontWeight: "bold", fill: 0xd4a047 }),
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = screenW / 2;
    titleText.y = y;
    this.panel.addChild(titleText);
    y += 32;

    // Run stats
    const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
    const statsText = new Text({
      text: `Time: ${formatTime(runTime)}  |  Kills: ${runKills}  |  Level: ${runLevel}`,
      style: new TextStyle({ fontFamily: "monospace", fontSize: 13, fill: 0x888888 }),
    });
    statsText.anchor.set(0.5, 0);
    statsText.x = screenW / 2;
    statsText.y = y;
    this.panel.addChild(statsText);
    y += 22;

    // Cogs earned
    const cogsEarnedText = new Text({
      text: `+ ${this.cogsEarned} Cogs`,
      style: new TextStyle({ fontFamily: "monospace", fontSize: 18, fontWeight: "bold", fill: COG_COLOR }),
    });
    cogsEarnedText.anchor.set(0.5, 0);
    cogsEarnedText.x = screenW / 2;
    cogsEarnedText.y = y;
    this.panel.addChild(cogsEarnedText);
    y += 24;

    // Total cogs
    const totalCogsText = new Text({
      text: `Balance: ${getCogs()} Cogs`,
      style: new TextStyle({ fontFamily: "monospace", fontSize: 14, fill: 0xaaaaaa }),
    });
    totalCogsText.anchor.set(0.5, 0);
    totalCogsText.x = screenW / 2;
    totalCogsText.y = y;
    this.panel.addChild(totalCogsText);
    y += 30;

    // --- Scrollable upgrade list ---
    const contentTop = y;
    this.contentAreaH = panelH - (contentTop - py) - 50;

    this.scrollContent = new Container();
    this.panel.addChild(this.scrollContent);

    this.scrollMask = new Graphics();
    this.scrollMask.rect(px + 4, contentTop, pw - 8, this.contentAreaH).fill(0xffffff);
    this.panel.addChild(this.scrollMask);
    this.scrollContent.mask = this.scrollMask;

    const startX = px + 16;
    const rowW = pw - 32;
    let cy = contentTop + 4;
    let lastCategory = "";

    for (const upg of GARAGE_UPGRADES) {
      // Category separator
      if (upg.category !== lastCategory) {
        lastCategory = upg.category;
        const catLabel = upg.category === "core" ? "CORE SYSTEMS"
          : upg.category === "loadout" ? "STARTING LOADOUT"
          : "ADVANCED MODULES";

        const catText = new Text({
          text: catLabel,
          style: new TextStyle({ fontFamily: "monospace", fontSize: 11, fontWeight: "bold", fill: CATEGORY_COLORS[upg.category] ?? 0x888888 }),
        });
        catText.x = startX;
        catText.y = cy;
        this.scrollContent.addChild(catText);
        cy += 18;
      }

      this.buildUpgradeRow(upg, startX, cy, rowW, totalCogsText, screenW);
      cy += ROW_H;
    }

    this.contentHeight = cy - contentTop;

    // Touch drag
    bg.eventMode = "static";
    let dragStartY = 0;
    let dragScrollStart = 0;
    bg.on("pointerdown", (e) => { dragStartY = e.globalY; dragScrollStart = this.scrollY; });
    bg.on("pointermove", (e) => {
      if (e.pressure > 0) {
        const delta = dragStartY - e.globalY;
        const maxScroll = Math.max(0, this.contentHeight - this.contentAreaH);
        this.scrollY = Math.max(0, Math.min(maxScroll, dragScrollStart + delta));
        this.scrollContent.y = -this.scrollY;
      }
    });

    // Rewarded ad button — only show if player died (not on victory)
    if (this._isDeath && this._adBonusHp === 0) {
      const adBtn = new Container();
      const adBtnBg = new Graphics();
      const btnW = 220;
      const btnH = 34;
      const btnX = (screenW - btnW) / 2;
      const btnY = py + panelH - 58;
      adBtnBg.roundRect(btnX, btnY, btnW, btnH, 8).fill({ color: 0x1a3a1a });
      adBtnBg.roundRect(btnX, btnY, btnW, btnH, 8).stroke({ color: 0x2ecc71, width: 1.5 });
      adBtn.addChild(adBtnBg);

      const adBtnText = new Text({
        text: "Watch ad for +3 HP",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 13, fontWeight: "bold", fill: 0x2ecc71 }),
      });
      adBtnText.anchor.set(0.5);
      adBtnText.x = screenW / 2;
      adBtnText.y = btnY + btnH / 2;
      adBtn.addChild(adBtnText);

      adBtnBg.eventMode = "static";
      adBtnBg.cursor = "pointer";
      adBtnBg.on("pointertap", () => {
        adBtnText.text = "Loading...";
        adBtnText.style.fill = 0x888888;
        adBtnBg.eventMode = "none";
        showRewardedAd().then((watched) => {
          if (watched) {
            this._adBonusHp = 3;
            adBtnText.text = "+3 HP next run!";
            adBtnText.style.fill = 0x2ecc71;
          } else {
            adBtnText.text = "Watch ad for +3 HP";
            adBtnText.style.fill = 0x2ecc71;
            adBtnBg.eventMode = "static";
          }
        });
      });

      this.panel.addChild(adBtn);
    } else if (this._isDeath && this._adBonusHp > 0) {
      const adConfirm = new Text({
        text: "+3 HP next run!",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 13, fontWeight: "bold", fill: 0x2ecc71 }),
      });
      adConfirm.anchor.set(0.5);
      adConfirm.x = screenW / 2;
      adConfirm.y = py + panelH - 42;
      this.panel.addChild(adConfirm);
    }

    // Play again hint
    const hint = new Text({
      text: "ENTER to play again  |  Scroll ↑↓",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 12, fill: 0x444444 }),
    });
    hint.anchor.set(0.5);
    hint.x = screenW / 2;
    hint.y = py + panelH - 18;
    this.panel.addChild(hint);
  }

  private buildUpgradeRow(
    upg: GarageUpgradeDef,
    x: number,
    y: number,
    w: number,
    totalCogsText: Text,
    _screenW: number,
  ): void {
    const currentLevel = getGarageLevel(upg.id);
    const maxed = currentLevel >= upg.maxLevel;
    const nextCost = maxed ? 0 : upg.costs[currentLevel];
    const canAfford = !maxed && getCogs() >= nextCost;

    // Row background
    const rowBg = new Graphics();
    rowBg.roundRect(x, y, w, ROW_H - 4, 6).fill({ color: 0x18182a });
    if (canAfford) {
      rowBg.roundRect(x, y, w, ROW_H - 4, 6).stroke({ color: 0x3a3a5a, width: 1 });
    }
    this.scrollContent.addChild(rowBg);

    // Name
    const nameText = new Text({
      text: upg.name,
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 13,
        fontWeight: "bold",
        fill: maxed ? 0x666666 : 0xf0f0f0,
      }),
    });
    nameText.x = x + 10;
    nameText.y = y + 6;
    this.scrollContent.addChild(nameText);

    // Description
    const descText = new Text({
      text: upg.description,
      style: new TextStyle({ fontFamily: "monospace", fontSize: 10, fill: 0x777777 }),
    });
    descText.x = x + 10;
    descText.y = y + 24;
    this.scrollContent.addChild(descText);

    // Level pips
    for (let i = 0; i < upg.maxLevel; i++) {
      const pip = new Graphics();
      const pipX = x + w - 120 + i * 14;
      const filled = i < currentLevel;
      pip.roundRect(pipX, y + 8, 10, 10, 2).fill(filled ? 0xd4a047 : 0x333333);
      this.scrollContent.addChild(pip);
    }

    // Cost / status
    if (maxed) {
      const maxedText = new Text({
        text: "MAX",
        style: new TextStyle({ fontFamily: "monospace", fontSize: 11, fontWeight: "bold", fill: 0xd4a047 }),
      });
      maxedText.anchor.set(1, 0.5);
      maxedText.x = x + w - 10;
      maxedText.y = y + ROW_H / 2 - 2;
      this.scrollContent.addChild(maxedText);
    } else {
      const costText = new Text({
        text: `${nextCost}`,
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 12,
          fontWeight: "bold",
          fill: canAfford ? COG_COLOR : 0x555555,
        }),
      });
      costText.anchor.set(1, 0.5);
      costText.x = x + w - 10;
      costText.y = y + ROW_H / 2 - 2;
      this.scrollContent.addChild(costText);

      // Buy button
      if (canAfford) {
        rowBg.eventMode = "static";
        rowBg.cursor = "pointer";
        rowBg.on("pointertap", () => {
          if (purchaseGarageUpgrade(upg.id, nextCost)) {
            totalCogsText.text = `Balance: ${getCogs()} Cogs`;
            this.buildPanel(this._screenW, this._screenH, this._runTime, this._runKills, this._runLevel);
          }
        });
      }
    }
  }
}

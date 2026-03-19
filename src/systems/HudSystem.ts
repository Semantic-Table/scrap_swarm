import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { ScrapCollector } from "../components/ScrapCollector";
import type { WaveState } from "../components/Wave";
import type { PlayerLevel } from "../components/PlayerLevel";
import type { Inventory } from "../components/Inventory";
import { scrapForLevel, ITEMS } from "../config/upgrades";
import { FLOW_TARGET_TIME } from "../config/constants";
import { Text, TextStyle, Container, Graphics } from "pixi.js";

// ─── Layout constants ──────────────────────────────────────────────────────────

/** Horizontal padding from screen edges for the XP bar */
const BAR_PAD_X = 16;
/** Vertical position of the top of the XP bar row */
const BAR_Y = 10;
/** Height of the thin progress bar fill area */
const BAR_H = 7;
/** Radius of the rounded caps on the bar track */
const BAR_RADIUS = 3;
/** Total height of the bar container row (track + level label) */
const BAR_ROW_H = 26;

// ─── XP Bar colors ─────────────────────────────────────────────────────────────

/** Very dark navy — matches BG_COLOR (#1a1a2e) but slightly deeper */
const BAR_BG      = 0x0a0a15;
/** Subtle border around the track so it reads on dark bg */
const BAR_BORDER  = 0x2a2a3a;
/** Warm gold fill — same family as PLAYER_COLOR / SWORD_COLOR */
const BAR_FILL    = 0xd4a047;
/** Brighter leading edge on the fill (highlight sliver) */
const BAR_EDGE    = 0xffe580;
/** Flash/pulse color on level-up */
const BAR_FLASH   = 0xffffff;

// ─── Item bar constants ───────────────────────────────────────────────────────

const SLOT_W       = 52;
const SLOT_H       = 52;
const SLOT_GAP     = 6;
const SLOT_PADDING = 16;

const ITEM_ICON_COLORS: Record<string, number> = {
  sword:     0xd4a047,
  turret:    0x5dade2,
  tesla:     0x00e5ff,
  pulse:     0xff6b35,
  magnet:    0xe74c3c,
  refiner:   0x8c8c8c,
  shield:    0x3498db,
  booster:   0x2ecc71,
  might:     0xff4444,
  swiftness: 0xaa66ff,
  reach:     0x44ddaa,
  multi:     0xffaa22,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── HudSystem ────────────────────────────────────────────────────────────────

export class HudSystem implements System {
  readonly name = "HudSystem";

  private world: World;
  private screenWidth: number;
  private screenHeight: number;

  // ── XP / Scrap bar ──
  private barTrack: Graphics;       // static track drawn once
  private barFill: Graphics;        // redrawn every frame (cheap — simple rect)
  private levelLabel: Text;         // "Niv. 3" to the left of the bar
  private displayFill = 0;          // current animated fill ratio [0..1]
  private targetFill  = 0;          // where we want to be
  private lastLevel   = -1;         // detect level-up events
  private flashTimer  = 0;          // countdown for level-up flash (seconds)
  private readonly FLASH_DURATION = 0.45;
  private readonly LERP_SPEED     = 6;  // higher = snappier

  // ── Timer ──
  private timerText: Text;

  // ── Announcement ──
  private announceText: Text;
  private announceTimer = 0;

  // ── Item bar ──
  private itemBarContainer: Container;
  private itemSlots: Container[] = [];
  private lastItemKey = "";

  constructor(
    world: World,
    hudLayer: Container,
    screenWidth: number,
    screenHeight: number,
  ) {
    this.world        = world;
    this.screenWidth  = screenWidth;
    this.screenHeight = screenHeight;

    const barW = screenWidth - BAR_PAD_X * 2;

    // ── XP bar track (static — drawn once) ──────────────────────────────────
    this.barTrack = new Graphics();
    this.barTrack.x = BAR_PAD_X;
    this.barTrack.y = BAR_Y;
    this.drawBarTrack(barW);
    hudLayer.addChild(this.barTrack);

    // ── XP bar fill (redrawn each frame) ────────────────────────────────────
    this.barFill = new Graphics();
    this.barFill.x = BAR_PAD_X;
    this.barFill.y = BAR_Y;
    hudLayer.addChild(this.barFill);

    // ── Level label ─────────────────────────────────────────────────────────
    //    Positioned vertically centred on the bar track
    this.levelLabel = new Text({
      text: "Niv. 0",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 12,
        fontWeight: "bold",
        fill: 0x8c8c8c,
      }),
    });
    this.levelLabel.anchor.set(0, 0.5);
    this.levelLabel.x = BAR_PAD_X;
    this.levelLabel.y = BAR_Y + BAR_H / 2;  // vertically centered on bar
    hudLayer.addChild(this.levelLabel);

    // ── Timer (centered, above everything) ──────────────────────────────────
    //    Sits just below the bar row so there is a clear visual hierarchy
    this.timerText = new Text({
      text: "0:00",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 24,
        fontWeight: "bold",
        fill: 0xf0f0f0,
      }),
    });
    this.timerText.anchor.set(0.5, 0);
    this.timerText.x = screenWidth / 2;
    this.timerText.y = BAR_Y + BAR_ROW_H + 4;  // 4 px gap below bar row
    hudLayer.addChild(this.timerText);

    // ── Announcement text ────────────────────────────────────────────────────
    this.announceText = new Text({
      text: "",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 36,
        fontWeight: "bold",
        fill: 0xf0f0f0,
        dropShadow: {
          color: 0x000000,
          blur: 6,
          alpha: 0.8,
          distance: 2,
        },
      }),
    });
    this.announceText.anchor.set(0.5);
    this.announceText.visible = false;
    hudLayer.addChild(this.announceText);

    // ── Item bar ─────────────────────────────────────────────────────────────
    this.itemBarContainer = new Container();
    hudLayer.addChild(this.itemBarContainer);
  }

  // ── Draw helpers ────────────────────────────────────────────────────────────

  private drawBarTrack(barW: number): void {
    this.barTrack.clear();
    // Subtle outer border
    this.barTrack
      .roundRect(0, 0, barW, BAR_H, BAR_RADIUS)
      .fill({ color: BAR_BORDER });
    // Dark inner background inset by 1 px
    this.barTrack
      .roundRect(1, 1, barW - 2, BAR_H - 2, BAR_RADIUS)
      .fill({ color: BAR_BG });
  }

  /**
   * Redraws the fill Graphics.  Called every frame (the Graphics is small —
   * one filled rect + one 2 px edge sliver — so this is essentially free).
   */
  private drawBarFill(barW: number, ratio: number, flash: number): void {
    this.barFill.clear();
    if (ratio <= 0) return;

    const fillW = Math.max(0, (barW - 2) * ratio);    // inset 1px each side

    // Interpolate fill color toward BAR_FLASH during level-up pulse
    const flashT = flash > 0 ? Math.sin((flash / this.FLASH_DURATION) * Math.PI) : 0;
    const fillColor = lerpColor(BAR_FILL, BAR_FLASH, flashT * 0.55);
    const edgeColor = lerpColor(BAR_EDGE, BAR_FLASH, flashT * 0.8);

    if (fillW > 0) {
      // Main fill body — rounded left side, square right (because edge sits on top)
      this.barFill
        .roundRect(1, 1, fillW, BAR_H - 2, BAR_RADIUS)
        .fill({ color: fillColor });

      // Bright leading edge: a 2 px sliver at the right end of the fill
      if (fillW > 4) {
        const edgeX = 1 + fillW - 2;
        this.barFill
          .rect(edgeX, 1, 2, BAR_H - 2)
          .fill({ color: edgeColor });
      }
    }
  }

  // ── System update ────────────────────────────────────────────────────────────

  update(dt: number): void {
    const barW = this.screenWidth - BAR_PAD_X * 2;

    const players = this.world.query(["PlayerTag", "ScrapCollector"]);
    if (players.length > 0) {
      const playerId  = players[0];
      const collector = this.world.getComponent<ScrapCollector>(playerId, "ScrapCollector")!;
      const playerLevel = this.world.getComponent<PlayerLevel>(playerId, "PlayerLevel");

      const level    = playerLevel ? playerLevel.level : 0;
      const nextCost = scrapForLevel(level + 1);
      const rawRatio = nextCost > 0 ? Math.min(1, collector.amount / nextCost) : 1;

      // Detect level-up: level number increased → trigger flash
      if (level !== this.lastLevel) {
        if (this.lastLevel !== -1) {
          // A genuine level-up (not first frame initialisation)
          this.flashTimer  = this.FLASH_DURATION;
          this.displayFill = 0;  // snap fill back to zero so bar "refills" from scratch
        }
        this.lastLevel = level;
        this.levelLabel.text = `Niv. ${level}`;
      }

      // Offset the label so it never overlaps the fill
      //   The label lives at x=BAR_PAD_X (left-aligned), but we nudge it
      //   slightly to give the bar breathing room on the left side.
      //   Because it's anchored left-centre, it naturally stays outside the bar.

      // Animate fill toward target
      this.targetFill  = rawRatio;
      this.displayFill = lerp(this.displayFill, this.targetFill, Math.min(1, this.LERP_SPEED * dt));

      // Tick flash
      if (this.flashTimer > 0) {
        this.flashTimer = Math.max(0, this.flashTimer - dt);
      }

      this.drawBarFill(barW, this.displayFill, this.flashTimer);

      // ── Item bar ─────────────────────────────────────────────────────────────
      const inventory = this.world.getComponent<Inventory>(playerId, "Inventory");
      if (inventory) {
        this.updateItemBar(inventory);
      }
    }

    // ── Timer ─────────────────────────────────────────────────────────────────
    const managers = this.world.query(["WaveState"]);
    if (managers.length > 0) {
      const state     = this.world.getComponent<WaveState>(managers[0], "WaveState")!;
      const remaining = Math.max(0, FLOW_TARGET_TIME - state.elapsed);
      this.timerText.text = formatTime(remaining);
      // Warm gold when under 60 s — matches the XP bar accent color for cohesion
      this.timerText.style.fill = remaining <= 60 ? 0xd4a047 : 0xf0f0f0;
    }

    // ── Announcement fade ─────────────────────────────────────────────────────
    if (this.announceTimer > 0) {
      this.announceTimer -= dt;
      this.announceText.alpha = Math.max(0, this.announceTimer / 1.5);
      if (this.announceTimer <= 0) {
        this.announceText.visible = false;
      }
    }
  }

  // ── Item bar ─────────────────────────────────────────────────────────────────

  private updateItemBar(inventory: Inventory): void {
    const key = inventory.slots.map((s) => `${s.itemId}:${s.level}`).join("|");
    if (key === this.lastItemKey) return;
    this.lastItemKey = key;

    for (const slot of this.itemSlots) {
      slot.destroy({ children: true });
    }
    this.itemSlots = [];

    const baseY = this.screenHeight - SLOT_H - SLOT_PADDING;

    for (let i = 0; i < inventory.slots.length; i++) {
      const item = inventory.slots[i];
      const def  = ITEMS[item.itemId];
      if (!def) continue;

      const slot = new Container();
      slot.x = SLOT_PADDING + i * (SLOT_W + SLOT_GAP);
      slot.y = baseY;

      // Background
      const bg = new Graphics();
      bg
        .roundRect(0, 0, SLOT_W, SLOT_H, 6)
        .fill({ color: 0x000000, alpha: 0.55 });
      bg
        .roundRect(0, 0, SLOT_W, SLOT_H, 6)
        .stroke({ color: ITEM_ICON_COLORS[item.itemId] ?? 0x555555, width: 2, alpha: 0.8 });
      slot.addChild(bg);

      // Icon (simple colored shape)
      const icon  = new Graphics();
      const color = ITEM_ICON_COLORS[item.itemId] ?? 0xffffff;
      const cx    = SLOT_W / 2;
      const cy    = 20;

      switch (item.itemId) {
        case "sword":
          icon.moveTo(cx - 2, cy + 8).lineTo(cx, cy - 10).lineTo(cx + 2, cy + 8).fill(color);
          icon.rect(cx - 5, cy + 8, 10, 3).fill(0x8c8c8c);
          break;
        case "turret":
          icon.poly([cx - 8, cy + 6, cx + 8, cy, cx - 8, cy - 6]).fill(color);
          break;
        case "tesla":
          icon
            .moveTo(cx - 4, cy - 10)
            .lineTo(cx + 2, cy - 1)
            .lineTo(cx - 2, cy - 1)
            .lineTo(cx + 4, cy + 10)
            .stroke({ color, width: 2 });
          break;
        case "pulse":
          icon.circle(cx, cy, 8).stroke({ color, width: 2 });
          icon.circle(cx, cy, 4).fill(color);
          break;
        case "magnet":
          icon
            .moveTo(cx - 8, cy + 6)
            .lineTo(cx - 8, cy - 4)
            .bezierCurveTo(cx - 8, cy - 12, cx + 8, cy - 12, cx + 8, cy - 4)
            .lineTo(cx + 8, cy + 6)
            .stroke({ color, width: 2 });
          break;
        case "refiner":
          icon.rect(cx - 6, cy - 6, 12, 12).fill(color);
          icon.rect(cx - 6, cy - 6, 12, 12).stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
          break;
        case "shield":
          icon
            .poly([cx, cy - 9, cx + 8, cy - 4, cx + 6, cy + 6, cx, cy + 9, cx - 6, cy + 6, cx - 8, cy - 4])
            .fill(color);
          break;
        case "booster":
          icon.poly([cx, cy - 8, cx + 6, cy + 4, cx, cy, cx - 6, cy + 4]).fill(color);
          break;
        case "might":
          // Fist/star burst
          icon.poly([cx, cy - 9, cx + 3, cy - 3, cx + 9, cy, cx + 3, cy + 3, cx, cy + 9, cx - 3, cy + 3, cx - 9, cy, cx - 3, cy - 3]).fill(color);
          break;
        case "swiftness":
          // Double chevrons (speed)
          icon.moveTo(cx - 6, cy - 6).lineTo(cx, cy).lineTo(cx - 6, cy + 6).stroke({ color, width: 2 });
          icon.moveTo(cx, cy - 6).lineTo(cx + 6, cy).lineTo(cx, cy + 6).stroke({ color, width: 2 });
          break;
        case "reach":
          // Expanding circles
          icon.circle(cx, cy, 4).stroke({ color, width: 1.5 });
          icon.circle(cx, cy, 8).stroke({ color, width: 1, alpha: 0.5 });
          break;
        case "multi":
          // Triple dots
          icon.circle(cx - 7, cy, 3).fill(color);
          icon.circle(cx, cy, 3).fill(color);
          icon.circle(cx + 7, cy, 3).fill(color);
          break;
      }
      slot.addChild(icon);

      // Level number — bottom-center of slot
      const lvlText = new Text({
        text: `${item.level}`,
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 14,
          fontWeight: "bold",
          fill: 0xf0f0f0,
        }),
      });
      lvlText.anchor.set(0.5, 1);
      lvlText.x = SLOT_W / 2;
      lvlText.y = SLOT_H - 4;
      slot.addChild(lvlText);

      this.itemBarContainer.addChild(slot);
      this.itemSlots.push(slot);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  showAnnouncement(text: string, screenWidth: number, screenHeight: number): void {
    this.announceText.text    = text;
    this.announceText.x       = screenWidth / 2;
    this.announceText.y       = screenHeight / 3;
    this.announceText.alpha   = 1;
    this.announceText.visible = true;
    this.announceTimer        = 2;
  }
}

// ─── Color utilities ──────────────────────────────────────────────────────────

/**
 * Linear interpolation between two packed RGB hex colors.
 * t = 0 → colorA, t = 1 → colorB.
 */
function lerpColor(colorA: number, colorB: number, t: number): number {
  const rA = (colorA >> 16) & 0xff;
  const gA = (colorA >>  8) & 0xff;
  const bA =  colorA        & 0xff;
  const rB = (colorB >> 16) & 0xff;
  const gB = (colorB >>  8) & 0xff;
  const bB =  colorB        & 0xff;
  const r  = Math.round(rA + (rB - rA) * t);
  const g  = Math.round(gA + (gB - gA) * t);
  const b  = Math.round(bA + (bB - bA) * t);
  return (r << 16) | (g << 8) | b;
}

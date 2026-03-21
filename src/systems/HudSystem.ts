import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { ScrapCollector } from "../components/ScrapCollector";
import type { WaveState } from "../components/Wave";
import type { PlayerLevel } from "../components/PlayerLevel";
import type { Inventory } from "../components/Inventory";
import type { Health } from "../components/Health";
import type { BossTag } from "../components/MapObject";
import type { Transform } from "../components/Transform";
import type { EnemyType } from "../components/EnemyType";
import { scrapForLevel, ITEMS } from "../config/upgrades";
import { ENEMY_TYPES } from "../config/constants";
import { setMasterVolume } from "../core/Audio";
import { FLOW_TARGET_TIME, HORDE_DURATION } from "../config/constants";
import { triggerShake } from "../core/ScreenShake";
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
  luck:      0xf1c40f,
  armor:     0x7f8c8d,
  regen:     0x2ecc71,
  crit:      0xff2222,
  multi:     0xffaa22,
  boomerang: 0xd4a047,
  mine:      0xff4444,
  laser:     0xff3333,
  aura:      0x27ae60,
  ricochet:  0xe0e0e0,
  gravity:   0x9b59b6,
  chainsaw:  0xff8c00,
  sentry:    0x8c8c8c,
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

  // ── HP display ──
  private hpContainer: Container;
  private hpGraphics: Graphics;
  private lastHp = -1;
  private lastMaxHp = -1;

  // ── Level-up sparks ──
  private hudLayer: Container | null = null;
  private levelSparks: Array<{ g: Graphics; life: number; vx: number; vy: number; x: number; y: number }> = [];

  // ── Item bar ──
  private itemBarContainer: Container;
  private itemSlots: Container[] = [];
  private lastItemKey = "";

  // ── Act transitions ──
  private act2Shown = false;
  private act3Shown = false;

  // ── Boss HP bar ──
  private bossBarContainer: Container;
  private bossBarBg: Graphics;
  private bossBarFill: Graphics;
  private bossNameText: Text;

  // ── Off-screen indicators ──
  private indicatorGraphics: Graphics;

  // ── Mute button ──
  private muteContainer: Container;
  private muteIcon: Graphics;
  private muted = false;

  constructor(
    world: World,
    hudLayer: Container,
    screenWidth: number,
    screenHeight: number,
  ) {
    this.world        = world;
    this.hudLayer     = hudLayer;
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
      text: "Lv. 0",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 12,
        fontWeight: "bold",
        fill: 0x8c8c8c,
      }),
    });
    this.levelLabel.anchor.set(0, 0.5);
    this.levelLabel.x = BAR_PAD_X;
    this.levelLabel.y = BAR_Y + BAR_H + 6;  // below the bar
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

    // ── HP display (top-right) ────────────────────────────────────────────────
    this.hpContainer = new Container();
    this.hpContainer.x = screenWidth - BAR_PAD_X;
    this.hpContainer.y = BAR_Y + BAR_H + 6;  // below the bar, aligned with level label
    hudLayer.addChild(this.hpContainer);
    this.hpGraphics = new Graphics();
    this.hpContainer.addChild(this.hpGraphics);

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

    // ── Boss HP bar ──────────────────────────────────────────────────────────
    this.bossBarContainer = new Container();
    this.bossBarContainer.visible = false;
    this.bossBarBg = new Graphics();
    this.bossBarFill = new Graphics();
    this.bossNameText = new Text({
      text: "",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 13,
        fontWeight: "bold",
        fill: 0xf0f0f0,
      }),
    });
    this.bossNameText.anchor.set(0.5, 1);
    this.bossNameText.x = screenWidth / 2;
    this.bossNameText.y = BAR_Y + BAR_ROW_H + 2;
    this.bossBarContainer.addChild(this.bossBarBg);
    this.bossBarContainer.addChild(this.bossBarFill);
    this.bossBarContainer.addChild(this.bossNameText);
    hudLayer.addChild(this.bossBarContainer);

    // ── Off-screen indicators ─────────────────────────────────────────────────
    this.indicatorGraphics = new Graphics();
    hudLayer.addChild(this.indicatorGraphics);

    // ── Mute button (top-right, above HP pips) ───────────────────────────────
    this.muteContainer = new Container();
    this.muteContainer.x = screenWidth - 36;
    this.muteContainer.y = BAR_Y + BAR_H + 24;
    this.muteContainer.eventMode = "static";
    this.muteContainer.cursor = "pointer";
    this.muteIcon = new Graphics();
    this.drawMuteIcon(false);
    this.muteContainer.addChild(this.muteIcon);
    this.muteContainer.on("pointertap", () => {
      this.muted = !this.muted;
      setMasterVolume(this.muted ? 0 : 1);
      this.drawMuteIcon(this.muted);
    });
    hudLayer.addChild(this.muteContainer);
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
  private drawHpPips(current: number, max: number): void {
    this.hpGraphics.clear();
    const pipW = 12;
    const pipH = 10;
    const gap = 4;
    const totalW = max * pipW + (max - 1) * gap;

    for (let i = 0; i < max; i++) {
      const x = -totalW + i * (pipW + gap);
      const active = i < current;
      const color = active ? (current <= 2 ? 0xe74c3c : 0x2ecc71) : 0x333333;
      this.hpGraphics.roundRect(x, 0, pipW, pipH, 2).fill(color);
      if (active) {
        // Bright top highlight
        this.hpGraphics.roundRect(x, 0, pipW, 3, 2).fill({ color: 0xffffff, alpha: 0.2 });
      }
    }
  }

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
    // Tick level-up sparks
    for (let i = this.levelSparks.length - 1; i >= 0; i--) {
      const sp = this.levelSparks[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.g.removeFromParent(); sp.g.destroy();
        this.levelSparks.splice(i, 1);
      } else {
        sp.vy += 300 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        const t = 1 - sp.life / 0.5;
        sp.g.clear().circle(0, 0, 2.5 * (1 - t * 0.6)).fill({ color: 0xffe580, alpha: 1 - t });
        sp.g.x = sp.x;
        sp.g.y = sp.y;
      }
    }

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

          // Spawn gold sparks from the XP bar
          if (this.hudLayer) {
            for (let s = 0; s < 5; s++) {
              const sparkG = new Graphics();
              sparkG.circle(0, 0, 2.5).fill(0xffe580);
              this.hudLayer.addChild(sparkG);
              this.levelSparks.push({
                g: sparkG,
                life: 0.35 + Math.random() * 0.2,
                vx: (Math.random() - 0.3) * 120,
                vy: -(80 + Math.random() * 100),
                x: BAR_PAD_X + barW - Math.random() * barW * 0.3,
                y: BAR_Y + BAR_H / 2,
              });
            }
          }
        }
        this.lastLevel = level;
        this.levelLabel.text = `Lv. ${level}`;
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

      // ── HP pips (top-right) ──────────────────────────────────────────────────
      const health = this.world.getComponent<Health>(playerId, "Health");
      if (health && (health.current !== this.lastHp || health.max !== this.lastMaxHp)) {
        this.drawHpPips(health.current, health.max);
        this.lastHp = health.current;
        this.lastMaxHp = health.max;
      }

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
      // Color: red during horde, gold under 60s, white otherwise
      if (state.hordeActive > 0) {
        this.timerText.style.fill = 0xe74c3c;
        // Show HORDE announcement at start of horde
        if (state.hordeActive > HORDE_DURATION - 0.1) {
          this.showAnnouncement("HORDE!", this.screenWidth, this.screenHeight);
        }
      } else {
        this.timerText.style.fill = remaining <= 60 ? 0xd4a047 : 0xf0f0f0;
      }

      // Act transitions
      if (!this.act2Shown && state.elapsed >= 150) {
        this.act2Shown = true;
        this.showAnnouncement("ACT 2", this.screenWidth, this.screenHeight);
        triggerShake(5, 0.15);
      }
      if (!this.act3Shown && state.elapsed >= 420) {
        this.act3Shown = true;
        this.showAnnouncement("ACT 3", this.screenWidth, this.screenHeight);
        triggerShake(5, 0.15);
      }
    }

    // ── Boss HP bar ──────────────────────────────────────────────────────────
    const bosses = this.world.query(["BossTag", "Health"]);
    if (bosses.length > 0) {
      this.bossBarContainer.visible = true;
      const bossId = bosses[0];
      const bossHealth = this.world.getComponent<Health>(bossId, "Health")!;
      const bossTag = this.world.getComponent<BossTag>(bossId, "BossTag")!;
      const bossBarW = this.screenWidth * 0.5;
      const bossBarH = 8;
      const bossBarX = (this.screenWidth - bossBarW) / 2;
      const bossBarY = BAR_Y + BAR_ROW_H + 6;
      const bossRatio = Math.max(0, bossHealth.current / bossHealth.max);

      const bossNames: Record<string, string> = {
        colossus: "COLOSSUS",
        broadcaster: "BROADCASTER",
        queen: "SWARM QUEEN",
      };
      this.bossNameText.text = bossNames[bossTag.bossType] ?? "BOSS";
      this.bossNameText.x = this.screenWidth / 2;
      this.bossNameText.y = bossBarY - 2;

      this.bossBarBg.clear();
      this.bossBarBg.roundRect(bossBarX, bossBarY, bossBarW, bossBarH, 3).fill({ color: 0x111111, alpha: 0.8 });
      this.bossBarBg.roundRect(bossBarX, bossBarY, bossBarW, bossBarH, 3).stroke({ color: 0x444444, width: 1 });

      this.bossBarFill.clear();
      if (bossRatio > 0) {
        this.bossBarFill.roundRect(bossBarX, bossBarY, bossBarW * bossRatio, bossBarH, 3).fill(0xe74c3c);
      }
    } else {
      this.bossBarContainer.visible = false;
    }

    // ── Off-screen indicators ────────────────────────────────────────────────
    this.updateOffScreenIndicators();

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
          icon.circle(cx - 7, cy, 3).fill(color);
          icon.circle(cx, cy, 3).fill(color);
          icon.circle(cx + 7, cy, 3).fill(color);
          break;
        case "boomerang":
          icon.rect(-8 + cx, -2 + cy, 16, 4).fill(color);
          icon.rect(-2 + cx, -8 + cy, 4, 16).fill(color);
          break;
        case "mine":
          icon.circle(cx, cy, 6).fill(0x333333);
          icon.circle(cx, cy, 3).fill(color);
          break;
        case "laser":
          icon.moveTo(cx - 8, cy).lineTo(cx + 8, cy).stroke({ color, width: 3 });
          icon.circle(cx - 8, cy, 2).fill(0xffffff);
          break;
        case "aura":
          icon.circle(cx, cy, 8).stroke({ color, width: 1.5, alpha: 0.5 });
          icon.circle(cx, cy, 4).fill({ color, alpha: 0.4 });
          break;
        case "ricochet":
          icon.moveTo(cx - 6, cy - 4).lineTo(cx, cy + 2).lineTo(cx + 6, cy - 6).stroke({ color, width: 2 });
          break;
        case "gravity":
          icon.circle(cx, cy, 7).stroke({ color, width: 1.5 });
          icon.circle(cx, cy, 3).fill(color);
          icon.circle(cx, cy, 3).stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
          break;
        case "chainsaw":
          icon.rect(cx - 2, cy - 8, 4, 16).fill(color);
          icon.rect(cx - 5, cy + 4, 10, 3).fill(0x666666);
          break;
        case "sentry":
          icon.rect(cx - 6, cy - 6, 12, 12).fill(0x333333);
          icon.rect(cx - 6, cy - 6, 12, 12).stroke({ color, width: 1.5 });
          icon.circle(cx, cy, 3).fill(color);
          break;
        case "luck":
          icon.circle(cx, cy, 7).stroke({ color, width: 2 });
          icon.moveTo(cx, cy - 4).lineTo(cx + 3, cy + 3).lineTo(cx - 3, cy + 3).closePath().fill(color);
          break;
        case "armor":
          icon.poly([cx, cy - 8, cx + 7, cy - 3, cx + 5, cy + 6, cx, cy + 8, cx - 5, cy + 6, cx - 7, cy - 3]).fill(color);
          break;
        case "regen":
          icon.rect(cx - 1.5, cy - 7, 3, 14).fill(color);
          icon.rect(cx - 7, cy - 1.5, 14, 3).fill(color);
          break;
        case "crit":
          icon.moveTo(cx, cy - 8).lineTo(cx + 2, cy - 2).lineTo(cx + 8, cy).lineTo(cx + 2, cy + 2).lineTo(cx, cy + 8).lineTo(cx - 2, cy + 2).lineTo(cx - 8, cy).lineTo(cx - 2, cy - 2).closePath().fill(color);
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

  // ── Mute icon ──────────────────────────────────────────────────────────────

  private drawMuteIcon(muted: boolean): void {
    this.muteIcon.clear();
    // Speaker body
    this.muteIcon.moveTo(2, 6).lineTo(6, 6).lineTo(12, 2).lineTo(12, 18).lineTo(6, 14).lineTo(2, 14).closePath()
      .fill({ color: muted ? 0x555555 : 0xcccccc });
    if (muted) {
      // X mark
      this.muteIcon.moveTo(15, 7).lineTo(21, 13).stroke({ color: 0xe74c3c, width: 2 });
      this.muteIcon.moveTo(21, 7).lineTo(15, 13).stroke({ color: 0xe74c3c, width: 2 });
    } else {
      // Sound waves
      this.muteIcon.arc(12, 10, 5, -0.6, 0.6).stroke({ color: 0xcccccc, width: 1.5 });
      this.muteIcon.arc(12, 10, 9, -0.5, 0.5).stroke({ color: 0x999999, width: 1 });
    }
    // Hit area
    this.muteIcon.rect(-2, -2, 28, 24).fill({ color: 0x000000, alpha: 0.001 });
  }

  // ── Off-screen indicators ─────────────────────────────────────────────────

  private updateOffScreenIndicators(): void {
    this.indicatorGraphics.clear();

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const hw = this.screenWidth / 2;
    const hh = this.screenHeight / 2;
    const margin = 24; // arrow distance from edge

    // Collect targets: bosses + caches (priority), then tank/shooter enemies
    const targets: Array<{ x: number; y: number; color: number; priority: boolean }> = [];

    const bosses = this.world.query(["BossTag", "Transform"]);
    for (const e of bosses) {
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      targets.push({ x: t.x, y: t.y, color: 0xe74c3c, priority: true });
    }

    const caches = this.world.query(["CacheTag", "Transform"]);
    for (const e of caches) {
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      targets.push({ x: t.x, y: t.y, color: 0xf1c40f, priority: true });
    }

    // Add tank and shooter enemies within 800px of the player
    const enemies = this.world.query(["EnemyTag", "EnemyType", "Transform"]);
    for (const e of enemies) {
      const et = this.world.getComponent<EnemyType>(e, "EnemyType")!;
      if (et.name !== "tank" && et.name !== "shooter") continue;
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      const dx = t.x - pT.x;
      const dy = t.y - pT.y;
      if (dx * dx + dy * dy > 800 * 800) continue;
      targets.push({ x: t.x, y: t.y, color: ENEMY_TYPES[et.name].color, priority: false });
    }

    // Sort: priority first (bosses/caches), then non-priority
    targets.sort((a, b) => (a.priority === b.priority ? 0 : a.priority ? -1 : 1));

    let drawn = 0;
    for (let i = 0; i < targets.length && drawn < 6; i++) {
      const tgt = targets[i];
      const dx = tgt.x - pT.x;
      const dy = tgt.y - pT.y;

      // Check if on-screen (with some padding)
      if (Math.abs(dx) < hw - 20 && Math.abs(dy) < hh - 20) continue;

      // Clamp to screen edge
      const angle = Math.atan2(dy, dx);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Find intersection with screen rect
      let sx: number;
      let sy: number;
      const scaleX = cos !== 0 ? (hw - margin) / Math.abs(cos) : Infinity;
      const scaleY = sin !== 0 ? (hh - margin) / Math.abs(sin) : Infinity;
      const scale = Math.min(scaleX, scaleY);
      sx = hw + cos * scale;
      sy = hh + sin * scale;

      // Draw arrow pointing toward target
      const arrowSize = 8;
      this.indicatorGraphics
        .moveTo(sx + Math.cos(angle) * arrowSize, sy + Math.sin(angle) * arrowSize)
        .lineTo(sx + Math.cos(angle + 2.4) * arrowSize, sy + Math.sin(angle + 2.4) * arrowSize)
        .lineTo(sx + Math.cos(angle - 2.4) * arrowSize, sy + Math.sin(angle - 2.4) * arrowSize)
        .closePath()
        .fill({ color: tgt.color, alpha: 0.85 });

      drawn++;
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

import { Application, Container, Graphics, Text, TextStyle, TilingSprite } from "pixi.js";
import { World } from "../ecs/World";
import { Input } from "./Input";
import { UpgradeUI } from "./UpgradeUI";
import { generateChoices } from "./UpgradeManager";
import { applyUpgrade } from "./UpgradeEffects";
import { recordRun, getTopRuns } from "./Progress";
import { CodexUI } from "./CodexUI";
import { DebugUI } from "./DebugUI";
import { GarageUI } from "./GarageUI";
import { calculateCogs } from "../config/garageUpgrades";
import { addCogs } from "./Progress";
import {
  getGarageHpBonus, getGarageStartingWeapons,
  getGarageShieldGen, getGarageExtraChoice,
  getGarageVeteranCore,
} from "./GarageEffects";
import { createShield } from "../components/Shield";

// Components
import { createTransform } from "../components/Transform";
import type { Transform } from "../components/Transform";
import { createVelocity } from "../components/Velocity";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createPlayerTag } from "../components/Tags";
import { createScrapCollector } from "../components/ScrapCollector";
import { createWaveState } from "../components/Wave";
import { createInventory } from "../components/Inventory";
import { createPlayerLevel } from "../components/PlayerLevel";
import { createEvolutionState } from "../components/Evolution";
import { checkEvolutions } from "./EvolutionManager";
import type { PlayerLevel } from "../components/PlayerLevel";
import type { Sprite } from "../components/Sprite";
import type { WaveState } from "../components/Wave";
import type { Inventory } from "../components/Inventory";
import type { BossTag } from "../components/MapObject";

// Systems
import { InputSystem } from "../systems/InputSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { RenderSystem } from "../systems/RenderSystem";
import { SpawnSystem } from "../systems/SpawnSystem";
import { EnemyAISystem } from "../systems/EnemyAISystem";
import { CollisionSystem } from "../systems/CollisionSystem";
import { ProjectileHitSystem } from "../systems/ProjectileHitSystem";
import { LifetimeSystem } from "../systems/LifetimeSystem";
import { ScrapPickupSystem } from "../systems/ScrapPickupSystem";
import { OrbitSystem } from "../systems/OrbitSystem";
import { TurretShootSystem } from "../systems/TurretShootSystem";
import { WaveSystem } from "../systems/WaveSystem";
import { LevelUpSystem } from "../systems/LevelUpSystem";
import { ShieldSystem } from "../systems/ShieldSystem";
import { TeslaSystem } from "../systems/TeslaSystem";
import { PulseSystem } from "../systems/PulseSystem";
import { CleanupSystem } from "../systems/CleanupSystem";
import { SwordSystem } from "../systems/SwordSystem";
import { EnemyShootSystem } from "../systems/EnemyShootSystem";
import { BoomerangSystem } from "../systems/BoomerangSystem";
import { MineSystem } from "../systems/MineSystem";
import { LaserSystem } from "../systems/LaserSystem";
import { AuraSystem } from "../systems/AuraSystem";
import { RicochetSystem } from "../systems/RicochetSystem";
import { GravityWellSystem } from "../systems/GravityWellSystem";
import { ChainSawSystem } from "../systems/ChainSawSystem";
import { SentrySystem } from "../systems/SentrySystem";
import { HudSystem } from "../systems/HudSystem";
import { BossSystem } from "../systems/BossSystem";
import { CameraSystem } from "../systems/CameraSystem";

// CrazyGames SDK
import {
  initCrazySDK, showInterstitialAd,
  gameplayStart as cgGameplayStart, gameplayStop as cgGameplayStop,
  happyTime,
} from "./CrazyGamesSDK";

// Config
import { hitStop } from "./HitStop";
import { screenShake } from "./ScreenShake";
import { initAudio, disposeAudio, suspendAudio, resumeAudio, playLevelUp, playEvolution, playGameOver, playVictory } from "./Audio";
import { spawnEvolutionBurst, updateParticles, clearParticles } from "./Particles";
import { createHealth } from "../components/Health";
import {
  PLAYER_SIZE,
  PLAYER_COLOR,
  PLAYER_HP,
  SCRAP_PICKUP_RADIUS,
  BG_COLOR,
  FLOW_TARGET_TIME,
  GRID_TILE_SIZE,
  GRID_COLOR_A,
} from "../config/constants";

export class Game {
  private app: Application;
  private world: World;
  private input: Input;
  private gameContainer: Container;
  private hudLayer: Container;
  private background!: TilingSprite;
  private hudSystem: HudSystem | null = null;
  private upgradeUI: UpgradeUI;
  private codexUI: CodexUI;
  private debugUI: DebugUI;
  private garageUI: GarageUI;
  private running = false;
  private paused = false;
  private adBonusHp = 0;
  private lastRunWasVictory = false;

  constructor() {
    this.app = new Application();
    this.world = new World();
    this.input = new Input();
    this.gameContainer = new Container();
    this.hudLayer = new Container();
    this.upgradeUI = new UpgradeUI();
    this.codexUI = new CodexUI();
    this.debugUI = new DebugUI();
    this.garageUI = new GarageUI();
  }

  async start(): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: BG_COLOR,
      antialias: true,
    });

    document.body.appendChild(this.app.canvas);

    // Initialize CrazyGames SDK (no-op in local dev)
    await initCrazySDK();

    // Remove loading screen
    const loading = document.getElementById("loading");
    if (loading) loading.remove();

    // Unlock AudioContext on first user gesture — required by all browsers.
    // A one-shot handler covers both keyboard and touch/pointer paths.
    const unlockAudio = () => {
      void initAudio();
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("pointerdown", unlockAudio);
    };
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("pointerdown", unlockAudio);

    // Pause when tab is hidden
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.app.ticker.stop();
        suspendAudio();
      } else {
        this.app.ticker.start();
        resumeAudio();
      }
    });

    // F1 to toggle debug panel during gameplay
    window.addEventListener("keydown", (e) => {
      if (e.code === "F1" && this.running && !this.paused) {
        e.preventDefault();
        this.app.stage.addChild(this.debugUI.container);
        this.debugUI.toggle(this.world, this.gameContainer, this.app.screen.width, this.app.screen.height);
      }
    });

    // Escape to pause + open codex during gameplay
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && this.running) {
        if (this.codexUI.container.visible) {
          this.codexUI.hide();
        } else if (!this.paused) {
          this.paused = true;
          this.app.stage.addChild(this.codexUI.container);
          this.codexUI.show(this.app.screen.width, this.app.screen.height, () => {
            this.paused = false;
          });
        }
      }
    });

    this.app.ticker.add((ticker) => {
      if (!this.running || this.paused) return;
      // Hit-stop: brief time-slow on heavy kills
      if (hitStop.timer > 0) {
        hitStop.timer -= ticker.deltaTime / 60;
        if (hitStop.timer <= 0) hitStop.scale = 1.0;
      }
      // Cap dt to avoid teleportation after tab switch
      const dt = Math.min((ticker.deltaTime / 60) * hitStop.scale, 0.1);
      // Animate player ring + body breathe
      this.breatheTimer += dt;
      if (this.playerRing) {
        this.playerRing.rotation += dt * 1.5;
      }
      if (this.playerBody) {
        const breathe = 1 + Math.sin(this.breatheTimer * 2.5) * 0.03;
        this.playerBody.scale.set(breathe);
      }
      this.world.update(dt);
      updateParticles(dt);
      this.updateTutorial(dt);
      this.checkVictory();
    });

    // Game starts immediately — overlay on top
    this.createBackground();
    this.app.stage.addChild(this.background);
    this.beginGame();
    this.showTitleOverlay();
  }

  /**
   * Semi-transparent overlay on top of the running game.
   * Auto-dismisses after 3s or on tap/Enter. Fades out smoothly.
   */
  private showTitleOverlay(): void {
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const cx = sw / 2;
    const cy = sh / 2;

    // Pause gameplay during overlay
    this.paused = true;

    const overlay = new Container();
    this.app.stage.addChild(overlay);

    // Dim scrim
    const scrim = new Graphics();
    scrim.rect(0, 0, sw, sh).fill({ color: 0x0a0a15, alpha: 0.7 });
    overlay.addChild(scrim);

    // Animated logo — player octagon + rotating ring
    const logoSize = 32;
    const logoContainer = new Container();
    logoContainer.x = cx;
    logoContainer.y = cy - 100;
    overlay.addChild(logoContainer);

    const logoBody = new Graphics();
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i - Math.PI / 8;
      pts.push(Math.cos(a) * logoSize, Math.sin(a) * logoSize);
    }
    logoBody.poly(pts).fill(0x3d2a0a);
    logoBody.poly(pts).stroke({ color: 0xd4a047, width: 2 });
    logoBody.circle(0, 0, logoSize * 0.35).fill(0xf5c842);
    logoContainer.addChild(logoBody);

    const logoRing = new Graphics();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      logoRing.arc(0, 0, logoSize + 10, a + 0.1, a + 0.45);
    }
    logoRing.stroke({ color: 0xd4a047, width: 2, alpha: 0.6 });
    logoContainer.addChild(logoRing);

    // Title text
    const title = new Text({
      text: "SCRAP SWARM",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 48,
        fontWeight: "bold",
        fill: 0xd4a047,
        letterSpacing: 6,
      }),
    });
    title.anchor.set(0.5);
    title.x = cx;
    title.y = cy - 30;
    overlay.addChild(title);

    // Subtitle
    const sub = new Text({
      text: "Survive 10 minutes.",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 16, fill: 0x888888 }),
    });
    sub.anchor.set(0.5);
    sub.x = cx;
    sub.y = cy + 14;
    overlay.addChild(sub);

    // Best score (if exists)
    const best = this.loadBestScore();
    let nextY = cy + 38;
    if (best) {
      const bestText = new Text({
        text: `Best: ${this.formatTime(best.time)}  |  ${best.kills} kills  |  Lv. ${best.level}`,
        style: new TextStyle({ fontFamily: "monospace", fontSize: 13, fill: 0x555566 }),
      });
      bestText.anchor.set(0.5);
      bestText.x = cx;
      bestText.y = nextY;
      overlay.addChild(bestText);
      nextY += 18;
    }

    // Top 3 runs (compact list below best score)
    const topRuns = getTopRuns();
    if (topRuns.length > 0) {
      const lines = topRuns.slice(0, 3).map(
        (r, i) => `#${i + 1}  ${this.formatTime(r.time)}  |  ${r.kills} kills  |  Lv. ${r.level}`,
      );
      const topText = new Text({
        text: lines.join("\n"),
        style: new TextStyle({ fontFamily: "monospace", fontSize: 11, fill: 0x444455, lineHeight: 16 }),
      });
      topText.anchor.set(0.5, 0);
      topText.x = cx;
      topText.y = nextY + 2;
      overlay.addChild(topText);
    }

    // Start prompt
    const prompt = new Text({
      text: this.input.isMobile ? "TAP ANYWHERE TO START" : "PRESS ENTER TO START",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 20,
        fontWeight: "bold",
        fill: 0xe0e0e0,
      }),
    });
    prompt.anchor.set(0.5);
    prompt.x = cx;
    prompt.y = cy + 80;
    overlay.addChild(prompt);

    // Codex + Garage pill buttons side by side
    const codexPill = new Container();
    codexPill.x = cx - 130;
    codexPill.y = cy + 130;
    const pillBg = new Graphics();
    pillBg.roundRect(0, 0, 120, 36, 12).fill({ color: 0x22223a });
    pillBg.roundRect(0, 0, 120, 36, 12).stroke({ color: 0x3a3a5a, width: 1.5 });
    codexPill.addChild(pillBg);
    const pillText = new Text({
      text: "CODEX",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 15, fontWeight: "bold", fill: 0x888888 }),
    });
    pillText.anchor.set(0.5);
    pillText.x = 60;
    pillText.y = 18;
    codexPill.addChild(pillText);
    codexPill.eventMode = "static";
    codexPill.cursor = "pointer";
    codexPill.on("pointerover", () => {
      pillBg.clear();
      pillBg.roundRect(0, 0, 120, 36, 12).fill({ color: 0x2a2a4a });
      pillBg.roundRect(0, 0, 120, 36, 12).stroke({ color: 0xd4a047, width: 1.5 });
      pillText.style.fill = 0xd4a047;
    });
    codexPill.on("pointerout", () => {
      pillBg.clear();
      pillBg.roundRect(0, 0, 120, 36, 12).fill({ color: 0x22223a });
      pillBg.roundRect(0, 0, 120, 36, 12).stroke({ color: 0x3a3a5a, width: 1.5 });
      pillText.style.fill = 0x888888;
    });
    codexPill.on("pointertap", () => {
      this.app.stage.addChild(this.codexUI.container);
      this.codexUI.show(sw, sh, () => { /* codex closed */ });
    });
    overlay.addChild(codexPill);

    // Garage pill button
    const garagePill = new Container();
    garagePill.x = cx + 10;
    garagePill.y = cy + 130;
    const gPillBg = new Graphics();
    gPillBg.roundRect(0, 0, 120, 36, 12).fill({ color: 0x22223a });
    gPillBg.roundRect(0, 0, 120, 36, 12).stroke({ color: 0x3a3a5a, width: 1.5 });
    garagePill.addChild(gPillBg);
    const gPillText = new Text({
      text: "GARAGE",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 15, fontWeight: "bold", fill: 0x888888 }),
    });
    gPillText.anchor.set(0.5);
    gPillText.x = 60;
    gPillText.y = 18;
    garagePill.addChild(gPillText);
    garagePill.eventMode = "static";
    garagePill.cursor = "pointer";
    garagePill.on("pointerover", () => {
      gPillBg.clear();
      gPillBg.roundRect(0, 0, 120, 36, 12).fill({ color: 0x2a2a4a });
      gPillBg.roundRect(0, 0, 120, 36, 12).stroke({ color: 0xf1c40f, width: 1.5 });
      gPillText.style.fill = 0xf1c40f;
    });
    garagePill.on("pointerout", () => {
      gPillBg.clear();
      gPillBg.roundRect(0, 0, 120, 36, 12).fill({ color: 0x22223a });
      gPillBg.roundRect(0, 0, 120, 36, 12).stroke({ color: 0x3a3a5a, width: 1.5 });
      gPillText.style.fill = 0x888888;
    });
    garagePill.on("pointertap", () => {
      this.app.stage.addChild(this.garageUI.container);
      this.garageUI.show(sw, sh, 0, 0, 0, 0, false, () => { /* garage closed */ });
    });
    overlay.addChild(garagePill);

    // --- Animations + auto-dismiss ---
    let elapsed = 0;
    let dismissing = false;
    let dismissed = false;

    const dismiss = () => {
      if (dismissing || dismissed || this.codexUI.container.visible || this.garageUI.container.visible) return;
      dismissing = true;
      window.removeEventListener("keydown", onKey);
    };

    const tickFn = (ticker: { deltaTime: number }) => {
      const dt = ticker.deltaTime / 60;
      elapsed += dt;

      // Rotate logo ring
      logoRing.rotation += dt * 2;

      // Blink prompt
      prompt.alpha = Math.sin(elapsed * 3) * 0.4 + 0.6;

      // Auto-dismiss after 3 seconds
      if (elapsed >= 3 && !dismissing && !this.codexUI.container.visible && !this.garageUI.container.visible) {
        dismiss();
      }

      // Fade out
      if (dismissing) {
        overlay.alpha -= dt * 2.5; // ~0.4s fade
        if (overlay.alpha <= 0) {
          dismissed = true;
          this.app.ticker.remove(tickFn);
          overlay.destroy({ children: true });
          this.paused = false;
        }
      }
    };
    this.app.ticker.add(tickFn);

    // Input handlers
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "Space") dismiss();
    };
    window.addEventListener("keydown", onKey);

    // Tap anywhere (except codex button) to dismiss
    scrim.eventMode = "static";
    scrim.on("pointertap", () => dismiss());
    title.eventMode = "static";
    title.on("pointertap", () => dismiss());
    prompt.eventMode = "static";
    prompt.on("pointertap", () => dismiss());
  }

  private tutorialShown = false;

  private beginGame(): void {
    this.app.stage.addChild(this.gameContainer);

    this.createPlayer();
    this.createWaveManager();

    // Veteran Core: silently apply one random normal-rarity upgrade at start
    if (getGarageVeteranCore()) {
      const players = this.world.query(["PlayerTag", "Inventory"]);
      if (players.length > 0) {
        const inv = this.world.getComponent<import("../components/Inventory").Inventory>(players[0], "Inventory")!;
        const choices = generateChoices(inv.slots, 999, 1); // level 999 to skip first-level-up curated
        const normalChoice = choices.find((c) => c.rarity === "normal") ?? choices[0];
        if (normalChoice) {
          normalChoice.rarity = "normal";
          applyUpgrade(normalChoice, this.world, this.gameContainer);
        }
      }
    }

    this.registerSystems();
    this.running = true;
    cgGameplayStart();

    this.app.stage.addChild(this.hudLayer);
    this.app.stage.addChild(this.upgradeUI.container);

    // Contextual tutorial on first run
    if (!this.tutorialShown) {
      this.tutorialShown = true;
      this.scheduleTutorial();
    }
  }

  private tutorialTimers: Array<{ delay: number; text: string }> = [
    { delay: 1.0, text: "WASD to move" },
    { delay: 4.0, text: "Attacks are automatic" },
    { delay: 8.0, text: "Collect scrap to level up" },
  ];
  private tutorialElapsed = 0;
  private tutorialActive = false;

  private scheduleTutorial(): void {
    this.tutorialElapsed = 0;
    this.tutorialActive = true;
  }

  private updateTutorial(dt: number): void {
    if (!this.tutorialActive) return;
    this.tutorialElapsed += dt;

    for (let i = this.tutorialTimers.length - 1; i >= 0; i--) {
      if (this.tutorialElapsed >= this.tutorialTimers[i].delay) {
        const msg = this.tutorialTimers.splice(i, 1)[0];
        if (this.hudSystem) {
          this.hudSystem.showAnnouncement(msg.text, this.app.screen.width, this.app.screen.height);
        }
      }
    }

    if (this.tutorialTimers.length === 0) {
      this.tutorialActive = false;
    }
  }

  private createBackground(): void {
    // Industrial grid tile with visible lines and corner rivets
    const ts = GRID_TILE_SIZE;
    const g = new Graphics();
    g.rect(0, 0, ts, ts).fill(GRID_COLOR_A);
    g.rect(0.5, 0.5, ts - 1, ts - 1).stroke({ color: 0x242438, width: 1 });
    // Corner rivets (crosshair marks)
    g.rect(0, 0, 3, 1).fill(0x2e2e4a);
    g.rect(0, 0, 1, 3).fill(0x2e2e4a);
    g.rect(ts - 3, ts - 1, 3, 1).fill(0x2e2e4a);
    g.rect(ts - 1, ts - 3, 1, 3).fill(0x2e2e4a);

    const texture = this.app.renderer.generateTexture(g);
    g.destroy();

    this.background = new TilingSprite({
      texture,
      width: this.app.screen.width,
      height: this.app.screen.height,
    });
  }

  private playerRing: Graphics | null = null;
  private playerBody: Graphics | null = null;
  private breatheTimer = 0;

  private createPlayer(): void {
    const entity = this.world.createEntity();

    // Mechanical core: dark body + bright stroke + inner detail
    const s = PLAYER_SIZE;
    const body = new Graphics();
    // Octagon shape
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i - Math.PI / 8;
      pts.push(Math.cos(a) * s, Math.sin(a) * s);
    }
    body.poly(pts).fill(0x3d2a0a);
    body.poly(pts).stroke({ color: PLAYER_COLOR, width: 2 });
    // Inner core glow
    body.circle(0, 0, s * 0.35).fill(0xf5c842);
    // Directional arrow on the edge
    body.poly([s + 4, 0, s - 4, -5, s - 4, 5]).fill(0xf5c842);
    this.playerBody = body;

    // Rotating ring segments
    this.playerRing = new Graphics();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      this.playerRing.arc(0, 0, s + 8, a + 0.1, a + 0.45);
    }
    this.playerRing.stroke({ color: PLAYER_COLOR, width: 2, alpha: 0.5 });

    const container = new Container();
    container.addChild(body);
    container.addChild(this.playerRing);
    this.gameContainer.addChild(container);

    const graphic = container;

    this.world.addComponent(entity, createTransform(
      this.app.screen.width / 2,
      this.app.screen.height / 2,
    ));
    this.world.addComponent(entity, createVelocity());
    this.world.addComponent(entity, createSprite(graphic));
    this.world.addComponent(entity, createCollider(PLAYER_SIZE));
    this.world.addComponent(entity, createPlayerTag());
    // Apply garage permanent bonuses
    const totalHp = PLAYER_HP + getGarageHpBonus() + this.adBonusHp;
    this.adBonusHp = 0; // Consume the bonus
    this.world.addComponent(entity, createHealth(totalHp));
    this.world.addComponent(entity, createScrapCollector(SCRAP_PICKUP_RADIUS));
    const inventory = createInventory();
    inventory.slots.push({ itemId: "sword", level: 1 });
    // Starting weapons from garage protocols
    for (const weaponId of getGarageStartingWeapons()) {
      if (!inventory.slots.find((s) => s.itemId === weaponId)) {
        inventory.slots.push({ itemId: weaponId, level: 1 });
      }
    }
    this.world.addComponent(entity, inventory);
    this.world.addComponent(entity, createPlayerLevel());
    this.world.addComponent(entity, createEvolutionState());

    // Shield Generator: free shield at start
    if (getGarageShieldGen()) {
      this.world.addComponent(entity, createShield(1, 15));
    }
  }

  private createWaveManager(): void {
    const entity = this.world.createEntity();
    this.world.addComponent(entity, createWaveState());
  }

  private registerSystems(): void {
    const gc = this.gameContainer;

    // Order matters:
    // 1. Input: read keyboard
    // 2. Wave: manage wave progression
    // 3. Spawn: create new enemies
    // 4. LevelUp: check if player leveled up
    // 5. TurretShoot: turrets auto-fire
    // 6. Tesla: chain lightning
    // 7. Pulse: area damage
    // 8. EnemyAI: orient enemies toward player
    // 9. Movement: apply velocities
    // 10. Orbit: position turrets around player
    // 11. ProjectileHit: projectile vs enemy → spawn scrap
    // 12. ScrapPickup: attract + collect scrap
    // 13. Shield: recharge shield
    // 14. Collision: enemy vs player (uses shield)
    // 15. Cleanup: remove far-away enemies
    // 16. Lifetime: expire old projectiles
    // 17. Render: sync graphics
    // 18. Camera: center viewport on player
    // 19. HUD: update UI
    this.world.addSystem(new InputSystem(this.world, this.input));
    this.world.addSystem(new WaveSystem(this.world));
    this.world.addSystem(new SpawnSystem(this.world, this.app, gc));
    this.world.addSystem(new LevelUpSystem(this.world, (level) => this.onLevelUp(level)));
    this.world.addSystem(new SwordSystem(this.world, gc));
    this.world.addSystem(new TurretShootSystem(this.world, gc));
    this.world.addSystem(new TeslaSystem(this.world, gc));
    this.world.addSystem(new PulseSystem(this.world, gc));
    this.world.addSystem(new BoomerangSystem(this.world, gc));
    this.world.addSystem(new MineSystem(this.world, gc));
    this.world.addSystem(new LaserSystem(this.world, gc));
    this.world.addSystem(new AuraSystem(this.world, gc));
    this.world.addSystem(new RicochetSystem(this.world, gc, this.app.screen.width, this.app.screen.height));
    this.world.addSystem(new GravityWellSystem(this.world, gc));
    this.world.addSystem(new ChainSawSystem(this.world, gc));
    this.world.addSystem(new SentrySystem(this.world, gc));
    this.world.addSystem(new EnemyAISystem(this.world));
    this.world.addSystem(new EnemyShootSystem(this.world, gc));
    this.world.addSystem(new BossSystem(this.world, gc));
    this.world.addSystem(new MovementSystem(this.world));
    this.world.addSystem(new OrbitSystem(this.world));
    this.world.addSystem(new ProjectileHitSystem(this.world, gc));
    this.world.addSystem(new ScrapPickupSystem(this.world, gc));
    this.world.addSystem(new ShieldSystem(this.world));
    this.world.addSystem(new CollisionSystem(this.world, gc, () => this.gameOver()));
    this.world.addSystem(new CleanupSystem(this.world));
    this.world.addSystem(new LifetimeSystem(this.world));
    this.world.addSystem(new RenderSystem(this.world));
    this.world.addSystem(new CameraSystem(this.world, this.app, gc, this.background));

    this.hudSystem = new HudSystem(this.world, this.hudLayer, this.app.screen.width, this.app.screen.height);
    this.world.addSystem(this.hudSystem);
  }

  private onLevelUp(level: number): void {
    const players = this.world.query(["PlayerTag", "Inventory"]);
    if (players.length === 0) return;

    const inventory = this.world.getComponent<Inventory>(players[0], "Inventory")!;
    const choiceCount = getGarageExtraChoice() ? 4 : 3;
    const choices = generateChoices(inventory.slots, level, choiceCount);

    if (choices.length === 0) return;

    playLevelUp();
    happyTime();
    this.paused = true;

    this.upgradeUI.show(
      choices,
      this.app.screen.width,
      this.app.screen.height,
      (choice) => {
        applyUpgrade(choice, this.world, this.gameContainer);

        // Check for weapon evolutions after applying upgrade
        const evo = checkEvolutions(this.world);
        if (evo && this.hudSystem) {
          playEvolution();
          happyTime();
          this.hudSystem.showAnnouncement(
            `EVOLUTION: ${evo.name}!`,
            this.app.screen.width,
            this.app.screen.height,
          );
          // Burst particles at player position
          const evoPlayers = this.world.query(["PlayerTag", "Transform"]);
          if (evoPlayers.length > 0) {
            const pt = this.world.getComponent<Transform>(evoPlayers[0], "Transform")!;
            spawnEvolutionBurst(this.gameContainer, pt.x, pt.y, evo.color);
          }
        }

        this.paused = false;
      },
    );
  }

  private checkVictory(): void {
    const managers = this.world.query(["WaveState"]);
    if (managers.length === 0) return;

    const state = this.world.getComponent<WaveState>(managers[0], "WaveState")!;
    if (state.elapsed >= FLOW_TARGET_TIME) {
      this.victory(state.elapsed);
    }
  }

  private getElapsed(): number {
    const managers = this.world.query(["WaveState"]);
    if (managers.length === 0) return 0;
    return this.world.getComponent<WaveState>(managers[0], "WaveState")!.elapsed;
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  private victory(elapsed: number): void {
    this.running = false;
    this.lastRunWasVictory = true;
    cgGameplayStop();
    happyTime();
    playVictory();
    this.showEndScreen("VICTORY", 0x2ecc71, elapsed);
  }

  private gameOver(): void {
    this.running = false;
    this.lastRunWasVictory = false;
    cgGameplayStop();
    playGameOver();
    this.showEndScreen("GAME OVER", 0xf0f0f0, this.getElapsed());
  }

  private showEndScreen(title: string, titleColor: number, elapsed: number): void {
    const enemies = this.world.query(["EnemyTag", "Sprite"]);
    for (const entity of enemies) {
      const sprite = this.world.getComponent<Sprite>(entity, "Sprite")!;
      sprite.graphic.alpha = 0.4;
    }

    // Gather stats
    const managers = this.world.query(["WaveState"]);
    const waveState = managers.length > 0
      ? this.world.getComponent<WaveState>(managers[0], "WaveState")!
      : null;
    const totalKills = waveState ? waveState.totalKills : 0;
    const killsByType = waveState ? waveState.killsByType : {};
    const players = this.world.query(["PlayerTag", "PlayerLevel"]);
    const playerLevel = players.length > 0
      ? (this.world.getComponent<PlayerLevel>(players[0], "PlayerLevel")?.level ?? 0)
      : 0;

    // Gather discovered items from inventory
    const discoveredItems: string[] = [];
    const invPlayers = this.world.query(["PlayerTag", "Inventory"]);
    if (invPlayers.length > 0) {
      const inv = this.world.getComponent<Inventory>(invPlayers[0], "Inventory")!;
      for (const slot of inv.slots) {
        discoveredItems.push(slot.itemId);
      }
    }

    // Gather discovered evolutions
    const discoveredEvolutions: string[] = [];
    const evoPlayers = this.world.query(["PlayerTag", "EvolutionState"]);
    if (evoPlayers.length > 0) {
      const evoState = this.world.getComponent<import("../components/Evolution").EvolutionState>(
        evoPlayers[0], "EvolutionState",
      );
      if (evoState) {
        for (const id of evoState.active) discoveredEvolutions.push(id);
      }
    }

    // Record progress + check achievements
    const newAchievements = recordRun(elapsed, killsByType, discoveredItems, discoveredEvolutions, playerLevel);

    // Calculate and save Cogs
    const isVictory = elapsed >= FLOW_TARGET_TIME;
    // Luck passive boosts cog earnings
    const luckLevel = invPlayers.length > 0
      ? (this.world.getComponent<Inventory>(invPlayers[0], "Inventory")!.slots.find((s) => s.itemId === "luck")?.level ?? 0)
      : 0;
    const cogsEarned = calculateCogs(elapsed, totalKills, playerLevel, isVictory, luckLevel);
    addCogs(cogsEarned);

    // Save best score
    this.saveBestScore(elapsed, totalKills, playerLevel);
    const best = this.loadBestScore();

    const cx = this.app.screen.width / 2;
    const cy = this.app.screen.height / 2;

    const style = new TextStyle({
      fontFamily: "monospace",
      fontSize: 48,
      fontWeight: "bold",
      fill: titleColor,
    });

    const text = new Text({ text: title, style });
    text.anchor.set(0.5);
    text.x = cx;
    text.y = cy - 60;
    this.app.stage.addChild(text);

    // Stats
    const statsStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 18,
      fill: 0xd4a047,
    });

    const statsText = [
      `Time: ${this.formatTime(elapsed)}  |  Kills: ${totalKills}  |  Level: ${playerLevel}`,
    ].join("\n");

    const stats = new Text({ text: statsText, style: statsStyle });
    stats.anchor.set(0.5);
    stats.x = cx;
    stats.y = cy - 10;
    this.app.stage.addChild(stats);

    // Queen status message
    let queenYOffset = 0;
    if (waveState && waveState.queenSpawned) {
      const queenBosses = this.world.query(["BossTag"]);
      let queenAlive = false;
      for (const be of queenBosses) {
        const bt = this.world.getComponent<BossTag>(be, "BossTag");
        if (bt && bt.bossType === "queen") { queenAlive = true; break; }
      }
      const queenMsg = queenAlive
        ? "The Swarm Queen survived..."
        : "The Swarm Queen has fallen!";
      const queenColor = queenAlive ? 0xe74c3c : 0x2ecc71;
      const queenText = new Text({
        text: queenMsg,
        style: new TextStyle({ fontFamily: "monospace", fontSize: 16, fontWeight: "bold", fill: queenColor }),
      });
      queenText.anchor.set(0.5);
      queenText.x = cx;
      queenText.y = cy + 14;
      this.app.stage.addChild(queenText);
      queenYOffset = 22;
    }

    // Best score
    if (best) {
      const bestStyle = new TextStyle({
        fontFamily: "monospace",
        fontSize: 14,
        fill: 0x666666,
      });
      const bestText = new Text({
        text: `Best: ${this.formatTime(best.time)}  |  ${best.kills} kills  |  Lv. ${best.level}`,
        style: bestStyle,
      });
      bestText.anchor.set(0.5);
      bestText.x = cx;
      bestText.y = cy + 16 + queenYOffset;
      this.app.stage.addChild(bestText);
    }

    // Newly unlocked achievements
    if (newAchievements.length > 0) {
      const achStyle = new TextStyle({
        fontFamily: "monospace",
        fontSize: 16,
        fontWeight: "bold",
        fill: 0xf1c40f,
      });
      const achText = new Text({
        text: "🏆 " + newAchievements.join("  |  "),
        style: achStyle,
      });
      achText.anchor.set(0.5);
      achText.x = cx;
      achText.y = cy + 40 + queenYOffset;
      this.app.stage.addChild(achText);
    }

    const subStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 20,
      fill: 0x888888,
    });

    // Cogs earned display
    const cogsStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 18,
      fontWeight: "bold",
      fill: 0xf1c40f,
    });
    const cogsText = new Text({
      text: `+ ${cogsEarned} Cogs`,
      style: cogsStyle,
    });
    cogsText.anchor.set(0.5);
    cogsText.x = cx;
    cogsText.y = cy + 60 + queenYOffset;
    this.app.stage.addChild(cogsText);

    const sub = new Text({
      text: this.input.isMobile ? "Tap to continue" : "Press any key",
      style: subStyle,
    });
    sub.anchor.set(0.5);
    sub.x = this.app.screen.width / 2;
    sub.y = this.app.screen.height / 2 + 90 + queenYOffset;
    this.app.stage.addChild(sub);

    // Continue → open Garage
    let continued = false;
    const onTap = () => doContinue();
    const tapTimeout = setTimeout(() => window.addEventListener("pointerdown", onTap), 500);
    const doContinue = () => {
      if (continued) return;
      continued = true;
      clearTimeout(tapTimeout);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onTap);
      this.showGarage(cogsEarned, elapsed, totalKills, playerLevel);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyR" || e.code === "Space" || e.code === "Enter") doContinue();
    };
    window.addEventListener("keydown", onKey);
  }

  private showGarage(cogsEarned: number, runTime: number, runKills: number, runLevel: number): void {
    const openGarage = () => {
      this.app.stage.addChild(this.garageUI.container);
      this.garageUI.show(
        this.app.screen.width,
        this.app.screen.height,
        cogsEarned,
        runTime,
        runKills,
        runLevel,
        !this.lastRunWasVictory,
        (bonusHp: number) => {
          this.adBonusHp = bonusHp;
          this.restart();
        },
      );
    };
    // Show interstitial ad between runs, then open garage
    showInterstitialAd().then(openGarage, openGarage);
  }

  private saveBestScore(time: number, kills: number, level: number): void {
    try {
      const prev = this.loadBestScore();
      if (!prev || time > prev.time) {
        localStorage.setItem("scrapswarm_best", JSON.stringify({ time, kills, level }));
      }
    } catch { /* localStorage unavailable */ }
  }

  private loadBestScore(): { time: number; kills: number; level: number } | null {
    try {
      const raw = localStorage.getItem("scrapswarm_best");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  }

  private restart(): void {
    // Properly destroy old containers to free VRAM
    this.gameContainer.destroy({ children: true });
    this.hudLayer.destroy({ children: true });
    this.upgradeUI.container.destroy({ children: true });
    if (this.background.texture) {
      this.background.texture.destroy(true);
    }
    this.background.destroy();
    this.app.stage.removeChildren();

    this.world = new World();
    this.gameContainer = new Container();
    this.hudLayer = new Container();
    this.hudSystem = null;
    this.upgradeUI = new UpgradeUI();
    this.codexUI = new CodexUI();
    this.debugUI = new DebugUI();
    this.garageUI = new GarageUI();
    this.paused = false;
    this.running = false;
    this.playerRing = null;
    this.playerBody = null;
    this.breatheTimer = 0;

    // Reset singleton state
    hitStop.timer = 0;
    hitStop.scale = 1.0;
    screenShake.timer = 0;
    screenShake.intensity = 0;
    screenShake.duration = 0;

    // Clear particle pool before destroying containers
    clearParticles();

    // Dispose old audio synths and restart ambience
    disposeAudio();
    void initAudio();

    // Direct restart — skip title screen
    this.createBackground();
    this.app.stage.addChild(this.background);
    this.beginGame();
  }
}

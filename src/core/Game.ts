import { Application, Container, Graphics, Text, TextStyle, TilingSprite } from "pixi.js";
import { World } from "../ecs/World";
import { Input } from "./Input";
import { UpgradeUI } from "./UpgradeUI";
import { generateChoices } from "./UpgradeManager";
import { applyUpgrade } from "./UpgradeEffects";

// Components
import { createTransform } from "../components/Transform";
import { createVelocity } from "../components/Velocity";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createPlayerTag } from "../components/Tags";
import { createScrapCollector } from "../components/ScrapCollector";
import { createWaveState } from "../components/Wave";
import { createInventory } from "../components/Inventory";
import { createPlayerLevel } from "../components/PlayerLevel";
import type { PlayerLevel } from "../components/PlayerLevel";
import type { Sprite } from "../components/Sprite";
import type { WaveState } from "../components/Wave";
import type { Inventory } from "../components/Inventory";

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
import { HudSystem } from "../systems/HudSystem";
import { CameraSystem } from "../systems/CameraSystem";

// Config
import { hitStop } from "./HitStop";
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
  private running = false;
  private paused = false;

  constructor() {
    this.app = new Application();
    this.world = new World();
    this.input = new Input();
    this.gameContainer = new Container();
    this.hudLayer = new Container();
    this.upgradeUI = new UpgradeUI();
  }

  async start(): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: BG_COLOR,
      antialias: true,
    });

    document.body.appendChild(this.app.canvas);

    // Remove loading screen
    const loading = document.getElementById("loading");
    if (loading) loading.remove();

    this.app.ticker.add((ticker) => {
      if (!this.running || this.paused) return;
      // Hit-stop: brief time-slow on heavy kills
      if (hitStop.timer > 0) {
        hitStop.timer -= ticker.deltaTime / 60;
        if (hitStop.timer <= 0) hitStop.scale = 1.0;
      }
      const dt = (ticker.deltaTime / 60) * hitStop.scale;
      // Animate player ring
      if (this.playerRing) {
        this.playerRing.rotation += dt * 1.5;
      }
      this.world.update(dt);
      this.checkVictory();
    });

    this.showTitleScreen();
  }

  private showTitleScreen(): void {
    this.createBackground();
    this.app.stage.addChild(this.background);

    const cx = this.app.screen.width / 2;
    const cy = this.app.screen.height / 2;

    const titleContainer = new Container();
    this.app.stage.addChild(titleContainer);

    // Title
    const title = new Text({
      text: "SCRAP SWARM",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 56,
        fontWeight: "bold",
        fill: 0xd4a047,
        letterSpacing: 4,
      }),
    });
    title.anchor.set(0.5);
    title.x = cx;
    title.y = cy - 60;
    titleContainer.addChild(title);

    // Subtitle
    const sub = new Text({
      text: "Survive. Scrap. Build.",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 20,
        fill: 0x8c8c8c,
      }),
    });
    sub.anchor.set(0.5);
    sub.x = cx;
    sub.y = cy;
    titleContainer.addChild(sub);

    // Start prompt
    const prompt = new Text({
      text: this.input.isMobile ? "[ TAP TO START ]" : "[ ENTER ]",
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 24,
        fontWeight: "bold",
        fill: 0xf0f0f0,
      }),
    });
    prompt.anchor.set(0.5);
    prompt.x = cx;
    prompt.y = cy + 60;
    titleContainer.addChild(prompt);

    // Blink the prompt
    let blinkTimer = 0;
    const blinkFn = (ticker: { deltaTime: number }) => {
      blinkTimer += ticker.deltaTime / 60;
      prompt.alpha = Math.sin(blinkTimer * 3) * 0.4 + 0.6;
    };
    this.app.ticker.add(blinkFn);

    let started = false;
    const doStart = () => {
      if (started) return;
      started = true;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onTap);
      this.app.ticker.remove(blinkFn);
      titleContainer.destroy({ children: true });
      this.beginGame();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "Space") doStart();
    };
    const onTap = () => doStart();

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onTap);
  }

  private beginGame(): void {
    this.app.stage.addChild(this.gameContainer);

    this.createPlayer();
    this.createWaveManager();
    this.registerSystems();
    this.running = true;

    this.app.stage.addChild(this.hudLayer);
    this.app.stage.addChild(this.upgradeUI.container);
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
    this.world.addComponent(entity, createHealth(PLAYER_HP));
    this.world.addComponent(entity, createScrapCollector(SCRAP_PICKUP_RADIUS));
    const inventory = createInventory();
    inventory.slots.push({ itemId: "sword", level: 1 });
    this.world.addComponent(entity, inventory);
    this.world.addComponent(entity, createPlayerLevel());
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
    this.world.addSystem(new EnemyAISystem(this.world));
    this.world.addSystem(new EnemyShootSystem(this.world, gc));
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
    const choices = generateChoices(inventory.slots, level);

    if (choices.length === 0) return;

    this.paused = true;

    this.upgradeUI.show(
      choices,
      this.app.screen.width,
      this.app.screen.height,
      (choice) => {
        applyUpgrade(choice, this.world, this.gameContainer);
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
    this.showEndScreen("VICTORY", 0x2ecc71, elapsed);
  }

  private gameOver(): void {
    this.running = false;
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
    const totalKills = managers.length > 0
      ? this.world.getComponent<WaveState>(managers[0], "WaveState")!.totalKills
      : 0;
    const players = this.world.query(["PlayerTag", "PlayerLevel"]);
    const playerLevel = players.length > 0
      ? (this.world.getComponent<PlayerLevel>(players[0], "PlayerLevel")?.level ?? 0)
      : 0;

    // Save best score to localStorage
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
      bestText.y = cy + 16;
      this.app.stage.addChild(bestText);
    }

    const subStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 20,
      fill: 0x888888,
    });

    const sub = new Text({
      text: this.input.isMobile ? "Tap to play again" : "R to play again",
      style: subStyle,
    });
    sub.anchor.set(0.5);
    sub.x = this.app.screen.width / 2;
    sub.y = this.app.screen.height / 2 + 60;
    this.app.stage.addChild(sub);

    let restarted = false;
    const doRestart = () => {
      if (restarted) return;
      restarted = true;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onTap);
      this.restart();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyR" || e.code === "Space" || e.code === "Enter") doRestart();
    };
    // Delay tap listener slightly to avoid accidental restart
    const onTap = () => doRestart();
    window.addEventListener("keydown", onKey);
    setTimeout(() => window.addEventListener("pointerdown", onTap), 500);
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
    this.paused = false;
    this.running = false;

    // Direct restart — skip title screen
    this.createBackground();
    this.app.stage.addChild(this.background);
    this.beginGame();
  }
}

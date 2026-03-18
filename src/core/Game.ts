import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
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
import type { Sprite } from "../components/Sprite";
import type { WaveState } from "../components/Wave";
import type { Inventory } from "../components/Inventory";

// Systems
import { InputSystem } from "../systems/InputSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { BoundsSystem } from "../systems/BoundsSystem";
import { RenderSystem } from "../systems/RenderSystem";
import { SpawnSystem } from "../systems/SpawnSystem";
import { EnemyAISystem } from "../systems/EnemyAISystem";
import { CollisionSystem } from "../systems/CollisionSystem";
import { ShootSystem } from "../systems/ShootSystem";
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
import { HudSystem } from "../systems/HudSystem";

// Config
import { PLAYER_SIZE, PLAYER_COLOR, SCRAP_PICKUP_RADIUS, BG_COLOR, FLOW_TARGET_TIME } from "../config/constants";

export class Game {
  private app: Application;
  private world: World;
  private input: Input;
  private hudLayer: Container;
  private hudSystem: HudSystem | null = null;
  private upgradeUI: UpgradeUI;
  private running = false;
  private paused = false;

  constructor() {
    this.app = new Application();
    this.world = new World();
    this.input = new Input();
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

    this.createPlayer();
    this.createWaveManager();
    this.registerSystems();
    this.running = true;

    // HUD layer always on top, then upgrade UI on top of HUD
    this.app.stage.addChild(this.hudLayer);
    this.app.stage.addChild(this.upgradeUI.container);

    this.app.ticker.add((ticker) => {
      if (!this.running || this.paused) return;
      const dt = ticker.deltaTime / 60;
      this.world.update(dt);
      this.checkVictory();
    });
  }

  private createPlayer(): void {
    const entity = this.world.createEntity();

    const graphic = new Graphics()
      .rect(-PLAYER_SIZE, -PLAYER_SIZE, PLAYER_SIZE * 2, PLAYER_SIZE * 2)
      .fill(PLAYER_COLOR);
    this.app.stage.addChild(graphic);

    this.world.addComponent(entity, createTransform(
      this.app.screen.width / 2,
      this.app.screen.height / 2,
    ));
    this.world.addComponent(entity, createVelocity());
    this.world.addComponent(entity, createSprite(graphic));
    this.world.addComponent(entity, createCollider(PLAYER_SIZE));
    this.world.addComponent(entity, createPlayerTag());
    this.world.addComponent(entity, createScrapCollector(SCRAP_PICKUP_RADIUS));
    this.world.addComponent(entity, createInventory());
    this.world.addComponent(entity, createPlayerLevel());
  }

  private createWaveManager(): void {
    const entity = this.world.createEntity();
    this.world.addComponent(entity, createWaveState());
  }

  private registerSystems(): void {
    // Order matters:
    // 1. Input: read keyboard
    // 2. Wave: manage wave progression
    // 3. Spawn: create new enemies
    // 4. LevelUp: check if player leveled up
    // 5. Shoot: player auto-fire
    // 6. TurretShoot: turrets auto-fire
    // 7. Tesla: chain lightning
    // 8. Pulse: area damage
    // 9. EnemyAI: orient enemies toward player
    // 10. Movement: apply velocities
    // 11. Orbit: position turrets around player
    // 12. Bounds: clamp player to screen
    // 13. ProjectileHit: projectile vs enemy → spawn scrap
    // 14. ScrapPickup: attract + collect scrap
    // 15. Shield: recharge shield
    // 16. Collision: enemy vs player (uses shield)
    // 17. Cleanup: remove off-screen enemies
    // 18. Lifetime: expire old projectiles
    // 19. Render: sync graphics
    // 20. HUD: update UI
    this.world.addSystem(new InputSystem(this.world, this.input));
    this.world.addSystem(new WaveSystem(this.world));
    this.world.addSystem(new SpawnSystem(this.world, this.app));
    this.world.addSystem(new LevelUpSystem(this.world, (level) => this.onLevelUp(level)));
    this.world.addSystem(new ShootSystem(this.world, this.app));
    this.world.addSystem(new TurretShootSystem(this.world, this.app));
    this.world.addSystem(new TeslaSystem(this.world, this.app));
    this.world.addSystem(new PulseSystem(this.world, this.app));
    this.world.addSystem(new EnemyAISystem(this.world));
    this.world.addSystem(new MovementSystem(this.world));
    this.world.addSystem(new OrbitSystem(this.world));
    this.world.addSystem(new BoundsSystem(this.world, this.app));
    this.world.addSystem(new ProjectileHitSystem(this.world, this.app));
    this.world.addSystem(new ScrapPickupSystem(this.world, this.app));
    this.world.addSystem(new ShieldSystem(this.world));
    this.world.addSystem(new CollisionSystem(this.world, this.app, () => this.gameOver()));
    this.world.addSystem(new CleanupSystem(this.world, this.app));
    this.world.addSystem(new LifetimeSystem(this.world, this.app));
    this.world.addSystem(new RenderSystem(this.world));

    this.hudSystem = new HudSystem(this.world, this.hudLayer, this.app.screen.width);
    this.world.addSystem(this.hudSystem);
  }

  private onLevelUp(_level: number): void {
    const players = this.world.query(["PlayerTag", "Inventory"]);
    if (players.length === 0) return;

    const inventory = this.world.getComponent<Inventory>(players[0], "Inventory")!;
    const choices = generateChoices(inventory.slots);

    if (choices.length === 0) return;

    this.paused = true;

    this.upgradeUI.show(
      choices,
      this.app.screen.width,
      this.app.screen.height,
      (choice) => {
        applyUpgrade(choice, this.world, this.app);
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

    const style = new TextStyle({
      fontFamily: "monospace",
      fontSize: 48,
      fontWeight: "bold",
      fill: titleColor,
    });

    const text = new Text({ text: title, style });
    text.anchor.set(0.5);
    text.x = this.app.screen.width / 2;
    text.y = this.app.screen.height / 2 - 30;
    this.app.stage.addChild(text);

    const scoreStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 24,
      fill: 0xd4a047,
    });

    const score = new Text({
      text: `Survived ${this.formatTime(elapsed)}`,
      style: scoreStyle,
    });
    score.anchor.set(0.5);
    score.x = this.app.screen.width / 2;
    score.y = this.app.screen.height / 2 + 20;
    this.app.stage.addChild(score);

    const subStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 20,
      fill: 0x888888,
    });

    const sub = new Text({ text: "R to restart", style: subStyle });
    sub.anchor.set(0.5);
    sub.x = this.app.screen.width / 2;
    sub.y = this.app.screen.height / 2 + 60;
    this.app.stage.addChild(sub);

    const onRestart = (e: KeyboardEvent) => {
      if (e.code === "KeyR") {
        window.removeEventListener("keydown", onRestart);
        this.restart();
      }
    };
    window.addEventListener("keydown", onRestart);
  }

  private restart(): void {
    this.app.stage.removeChildren();
    this.world = new World();
    this.hudLayer = new Container();
    this.hudSystem = null;
    this.upgradeUI = new UpgradeUI();
    this.paused = false;

    this.createPlayer();
    this.createWaveManager();
    this.registerSystems();
    this.app.stage.addChild(this.hudLayer);
    this.app.stage.addChild(this.upgradeUI.container);
    this.running = true;
  }
}

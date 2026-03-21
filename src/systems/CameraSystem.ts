import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Application } from "pixi.js";
import type { Container, TilingSprite } from "pixi.js";
import { screenShake } from "../core/ScreenShake";

export class CameraSystem implements System {
  readonly name = "CameraSystem";
  private world: World;
  private app: Application;
  private gameContainer: Container;
  private background: TilingSprite;
  private camX = 0;
  private camY = 0;

  constructor(
    world: World,
    app: Application,
    gameContainer: Container,
    background: TilingSprite,
  ) {
    this.world = world;
    this.app = app;
    this.gameContainer = gameContainer;
    this.background = background;
  }

  update(dt: number): void {
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;

    const t = this.world.getComponent<Transform>(players[0], "Transform")!;

    // Camera lerp — slight lag for weight/feel
    const targetX = -t.x + this.app.screen.width / 2;
    const targetY = -t.y + this.app.screen.height / 2;
    const lerpSpeed = 8;
    this.camX += (targetX - this.camX) * Math.min(1, lerpSpeed * dt);
    this.camY += (targetY - this.camY) * Math.min(1, lerpSpeed * dt);

    let cx = this.camX;
    let cy = this.camY;

    // Screen shake
    if (screenShake.timer > 0) {
      screenShake.timer -= dt;
      const ratio = screenShake.timer / screenShake.duration;
      const mag = screenShake.intensity * ratio;
      cx += (Math.random() - 0.5) * mag * 2;
      cy += (Math.random() - 0.5) * mag * 2;

      // Background shudder on shake
      const rumble = 1 + (mag / 100) * 0.008;
      this.background.tileScale.set(rumble);

      if (screenShake.timer <= 0) {
        screenShake.intensity = 0;
        this.background.tileScale.set(1);
      }
    }

    this.gameContainer.x = cx;
    this.gameContainer.y = cy;

    this.background.tilePosition.x = cx;
    this.background.tilePosition.y = cy;
  }
}

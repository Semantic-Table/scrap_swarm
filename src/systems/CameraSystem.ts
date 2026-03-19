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

    let cx = -t.x + this.app.screen.width / 2;
    let cy = -t.y + this.app.screen.height / 2;

    // Screen shake
    if (screenShake.timer > 0) {
      screenShake.timer -= dt;
      const ratio = screenShake.timer / screenShake.duration;
      const mag = screenShake.intensity * ratio;
      cx += (Math.random() - 0.5) * mag * 2;
      cy += (Math.random() - 0.5) * mag * 2;

      if (screenShake.timer <= 0) {
        screenShake.intensity = 0;
      }
    }

    this.gameContainer.x = cx;
    this.gameContainer.y = cy;

    this.background.tilePosition.x = cx;
    this.background.tilePosition.y = cy;
  }
}

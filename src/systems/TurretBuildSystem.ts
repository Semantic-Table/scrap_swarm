import type { System } from "../ecs/types";
import type { Entity, Component } from "../ecs/types";
import type { World } from "../ecs/World";
import type { ScrapCollector } from "../components/ScrapCollector";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createSprite } from "../components/Sprite";
import { createTurretTag } from "../components/Turret";
import { createOrbit } from "../components/Orbit";
import {
  TURRET_SIZE,
  TURRET_COLOR,
  TURRET_ORBIT_DISTANCE,
  TURRET_ORBIT_SPEED,
  TURRET_SHOOT_COOLDOWN,
  TURRET_FIRST_COST,
  TURRET_COST_INCREASE,
} from "../config/constants";

export class TurretBuildSystem implements System {
  readonly name = "TurretBuildSystem";
  private world: World;
  private stage: Container;
  private turretCount = 0;

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  private get nextCost(): number {
    return TURRET_FIRST_COST + this.turretCount * TURRET_COST_INCREASE;
  }

  update(_dt: number): void {
    const players = this.world.query(["PlayerTag", "ScrapCollector"]);
    if (players.length === 0) return;

    const playerId = players[0];
    const collector = this.world.getComponent<ScrapCollector>(playerId, "ScrapCollector")!;

    while (collector.amount >= this.nextCost) {
      collector.amount -= this.nextCost;
      this.buildTurret(playerId);
    }
  }

  private buildTurret(playerId: Entity): void {
    const entity = this.world.createEntity();

    // Triangle shape for turret
    const s = TURRET_SIZE;
    const graphic = new Graphics()
      .poly([-s, -s * 0.7, s, 0, -s, s * 0.7])
      .fill(TURRET_COLOR);
    this.stage.addChild(graphic);

    // Spread turrets evenly around the orbit
    const angle = this.turretCount * (Math.PI * 2 / Math.max(1, this.turretCount + 1));

    this.world.addComponent(entity, createTransform(0, 0));
    this.world.addComponent(entity, createSprite(graphic));
    this.world.addComponent(entity, createTurretTag(TURRET_SHOOT_COOLDOWN));
    this.world.addComponent(entity, createOrbit(
      playerId,
      angle,
      TURRET_ORBIT_DISTANCE,
      TURRET_ORBIT_SPEED,
    ));

    this.turretCount++;
    this.redistributeAngles();
  }

  /** Evenly space all turrets around the orbit */
  private redistributeAngles(): void {
    const turrets = this.world.query(["TurretTag", "Orbit"]);
    const count = turrets.length;

    for (let i = 0; i < count; i++) {
      const orbit = this.world.getComponent<Component & { angle: number }>(turrets[i], "Orbit")!;
      orbit.angle = (Math.PI * 2 / count) * i;
    }
  }
}

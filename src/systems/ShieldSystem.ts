import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Shield } from "../components/Shield";

/** Recharges shield over time */
export class ShieldSystem implements System {
  readonly name = "ShieldSystem";
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  update(dt: number): void {
    const players = this.world.query(["PlayerTag", "Shield"]);

    for (const entity of players) {
      const shield = this.world.getComponent<Shield>(entity, "Shield")!;

      if (shield.charges < shield.maxCharges) {
        shield.rechargeTimer -= dt;
        if (shield.rechargeTimer <= 0) {
          shield.charges++;
          shield.rechargeTimer = shield.rechargeCooldown;
        }
      }
    }
  }
}

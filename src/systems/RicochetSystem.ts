import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Collider } from "../components/Collider";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playRicochetPing } from "../core/Audio";
import { RICOCHET_COOLDOWN, RICOCHET_DAMAGE, RICOCHET_SPEED, RICOCHET_BOUNCES, RICOCHET_COLOR } from "../config/constants";

interface Bolt { g: Graphics; x: number; y: number; vx: number; vy: number; bounces: number; damage: number; life: number }

export class RicochetSystem implements System {
  readonly name = "RicochetSystem";
  private world: World;
  private stage: Container;
  private timer = 0;
  private bolts: Bolt[] = [];
  private screenW = 0;
  private screenH = 0;

  constructor(world: World, stage: Container, screenW: number, screenH: number) {
    this.world = world; this.stage = stage;
    this.screenW = screenW; this.screenH = screenH;
  }

  update(dt: number): void {
    // Get player position for viewport-relative bouncing
    const players = this.world.query(["PlayerTag", "Transform"]);
    let camX = 0, camY = 0;
    if (players.length > 0) {
      const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
      camX = pT.x - this.screenW / 2;
      camY = pT.y - this.screenH / 2;
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) { b.g.removeFromParent(); b.g.destroy(); this.bolts.splice(i, 1); continue; }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.g.x = b.x; b.g.y = b.y;
      b.g.rotation = Math.atan2(b.vy, b.vx);

      // Bounce off viewport edges
      if (b.x < camX || b.x > camX + this.screenW) { b.vx *= -1; b.bounces--; b.damage++; }
      if (b.y < camY || b.y > camY + this.screenH) { b.vy *= -1; b.bounces--; b.damage++; }
      if (b.bounces < 0) { b.life = 0; continue; }

      // Hit enemies — railgun pierces through all
      const isRailgun = hasEvolution(this.world, "railgun");
      const enemies = this.world.query(["EnemyTag", "Transform", "Collider"]);
      for (const e of enemies) {
        if (!this.world.isAlive(e)) continue;
        const t = this.world.getComponent<Transform>(e, "Transform")!;
        const c = this.world.getComponent<Collider>(e, "Collider")!;
        const dx = b.x - t.x, dy = b.y - t.y;
        if (dx * dx + dy * dy <= (c.radius + 4) * (c.radius + 4)) {
          damageEnemy(this.world, this.stage, e, b.damage, t.x, t.y);
          if (!isRailgun) { b.life = 0; break; }
          // Railgun: pierce through, don't stop
        }
      }
      // Railgun: infinite bounces
      if (isRailgun) { b.bounces = Math.max(b.bounces, 1); }
    }

    const level = getItemLevel(this.world, "ricochet");
    if (level <= 0) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = RICOCHET_COOLDOWN * getCooldownMult(this.world);

    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const angle = pT.rotation + (Math.random() - 0.5) * 0.3;

    const g = new Graphics();
    g.rect(-6, -2, 12, 4).fill(RICOCHET_COLOR);
    this.stage.addChild(g);

    playRicochetPing();
    this.bolts.push({
      g, x: pT.x, y: pT.y,
      vx: Math.cos(angle) * RICOCHET_SPEED, vy: Math.sin(angle) * RICOCHET_SPEED,
      bounces: RICOCHET_BOUNCES + Math.floor((level - 1) / 2),
      damage: RICOCHET_DAMAGE + getBonusDamage(this.world),
      life: 5,
    });
  }
}

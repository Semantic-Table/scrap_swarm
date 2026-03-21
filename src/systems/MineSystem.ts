import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playMineExplosion } from "../core/Audio";
import { MINE_COOLDOWN, MINE_DAMAGE, MINE_RADIUS, MINE_COLOR, MINE_LIFETIME } from "../config/constants";

interface ActiveMine { g: Graphics; x: number; y: number; life: number; radius: number; damage: number; exploded: boolean }

export class MineSystem implements System {
  readonly name = "MineSystem";
  private world: World;
  private stage: Container;
  private timer = 0;
  private mines: ActiveMine[] = [];

  constructor(world: World, stage: Container) { this.world = world; this.stage = stage; }

  update(dt: number): void {
    // Update mines
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.life -= dt;
      if (m.life <= 0 || m.exploded) {
        m.g.removeFromParent(); m.g.destroy();
        this.mines.splice(i, 1);
        continue;
      }
      // Check enemy proximity
      const enemies = this.world.query(["EnemyTag", "Transform"]);
      for (const e of enemies) {
        if (!this.world.isAlive(e)) continue;
        const t = this.world.getComponent<Transform>(e, "Transform")!;
        const dx = m.x - t.x, dy = m.y - t.y;
        if (dx * dx + dy * dy <= 20 * 20) {
          // Explode!
          m.exploded = true;
          playMineExplosion();
          for (const e2 of enemies) {
            if (!this.world.isAlive(e2)) continue;
            const t2 = this.world.getComponent<Transform>(e2, "Transform")!;
            const d2x = m.x - t2.x, d2y = m.y - t2.y;
            if (d2x * d2x + d2y * d2y <= m.radius * m.radius) {
              damageEnemy(this.world, this.stage, e2, m.damage, t2.x, t2.y);
            }
          }
          break;
        }
      }
      // Blink faster near end of life
      if (m.life < 2) m.g.alpha = 0.5 + Math.sin(m.life * 15) * 0.5;
    }

    const level = getItemLevel(this.world, "mine");
    if (level <= 0) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = MINE_COOLDOWN * getCooldownMult(this.world);

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;

    const g = new Graphics();
    g.circle(0, 0, 8).fill(0x333333);
    g.circle(0, 0, 4).fill(MINE_COLOR);
    g.x = pT.x; g.y = pT.y;
    this.stage.addChild(g);

    const isNuke = hasEvolution(this.world, "nuke_field");
    const baseRadius = (MINE_RADIUS + (level - 1) * 8) * getRangeMult(this.world);
    const baseDamage = MINE_DAMAGE + (level - 1) + getBonusDamage(this.world);

    this.mines.push({
      g, x: pT.x, y: pT.y, life: MINE_LIFETIME,
      radius: isNuke ? baseRadius * 2 : baseRadius,
      damage: isNuke ? baseDamage * 2 : baseDamage,
      exploded: false,
    });
  }
}

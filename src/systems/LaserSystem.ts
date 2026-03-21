import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playLaser } from "../core/Audio";
import { LASER_COOLDOWN, LASER_DAMAGE, LASER_RANGE, LASER_WIDTH, LASER_COLOR, LASER_DURATION } from "../config/constants";

export class LaserSystem implements System {
  readonly name = "LaserSystem";
  private world: World;
  private stage: Container;
  private timer = 0;
  private activeBeams: Array<{ g: Graphics; life: number; maxLife: number }> = [];

  constructor(world: World, stage: Container) { this.world = world; this.stage = stage; }

  update(dt: number): void {
    // Fade active beams
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const b = this.activeBeams[i];
      b.life -= dt;
      if (b.life <= 0) {
        b.g.removeFromParent(); b.g.destroy();
        this.activeBeams.splice(i, 1);
      } else {
        b.g.alpha = b.life / b.maxLife;
      }
    }

    const level = getItemLevel(this.world, "laser");
    if (level <= 0) return;
    const isDeathRay = hasEvolution(this.world, "death_ray");
    this.timer -= dt;
    // Sound only on fire (not every frame for death ray)
    let shouldPlaySound = false;
    if (this.timer > 0) return;
    shouldPlaySound = !isDeathRay || Math.random() < 0.2; // throttle death ray sound
    this.timer = isDeathRay ? 0.15 * getCooldownMult(this.world) : LASER_COOLDOWN * getCooldownMult(this.world);

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const range = (LASER_RANGE + (level - 1) * 30) * getRangeMult(this.world);
    const damage = LASER_DAMAGE + Math.floor((level - 1) / 2) + getBonusDamage(this.world);
    const width = LASER_WIDTH + level;

    const endX = pT.x + Math.cos(pT.rotation) * range;
    const endY = pT.y + Math.sin(pT.rotation) * range;

    // Damage all enemies along the line
    const enemies = this.world.query(["EnemyTag", "Transform"]);
    for (const e of enemies) {
      if (!this.world.isAlive(e)) continue;
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      if (this.pointToLineDist(pT.x, pT.y, endX, endY, t.x, t.y) < width * 2) {
        damageEnemy(this.world, this.stage, e, damage, t.x, t.y);
      }
    }

    if (shouldPlaySound) playLaser();

    // Visual beam
    const g = new Graphics();
    g.moveTo(pT.x, pT.y).lineTo(endX, endY).stroke({ color: 0xffffff, width: width, alpha: 0.9 });
    g.moveTo(pT.x, pT.y).lineTo(endX, endY).stroke({ color: LASER_COLOR, width: width + 4, alpha: 0.4 });
    this.stage.addChild(g);
    this.activeBeams.push({ g, life: LASER_DURATION, maxLife: LASER_DURATION });
  }

  private pointToLineDist(lx1: number, ly1: number, lx2: number, ly2: number, px: number, py: number): number {
    const dx = lx2 - lx1, dy = ly2 - ly1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - lx1) ** 2 + (py - ly1) ** 2);
    const t = Math.max(0, Math.min(1, ((px - lx1) * dx + (py - ly1) * dy) / lenSq));
    const nearX = lx1 + t * dx, nearY = ly1 + t * dy;
    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
  }
}

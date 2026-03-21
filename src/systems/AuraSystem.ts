import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playAuraTick } from "../core/Audio";
import { AURA_COOLDOWN, AURA_DAMAGE, AURA_RADIUS, AURA_COLOR } from "../config/constants";

export class AuraSystem implements System {
  readonly name = "AuraSystem";
  private world: World;
  private stage: Container;
  private timer = 0;
  private auraGraphic: Graphics | null = null;

  constructor(world: World, stage: Container) { this.world = world; this.stage = stage; }

  update(dt: number): void {
    const level = getItemLevel(this.world, "aura");
    if (level <= 0) {
      if (this.auraGraphic) { this.auraGraphic.visible = false; }
      return;
    }

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const radius = (AURA_RADIUS + (level - 1) * 10) * getRangeMult(this.world);

    // Draw aura ring around player
    if (!this.auraGraphic) {
      this.auraGraphic = new Graphics();
      this.stage.addChild(this.auraGraphic);
    }
    this.auraGraphic.visible = true;
    this.auraGraphic.clear();
    this.auraGraphic.circle(pT.x, pT.y, radius).fill({ color: AURA_COLOR, alpha: 0.08 });
    this.auraGraphic.circle(pT.x, pT.y, radius).stroke({ color: AURA_COLOR, width: 2, alpha: 0.25 });

    // Tick damage
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = AURA_COOLDOWN * getCooldownMult(this.world);

    playAuraTick();
    const isPlague = hasEvolution(this.world, "plague");
    const damage = AURA_DAMAGE + Math.floor((level - 1) / 3) + getBonusDamage(this.world);
    const plagueRadius = isPlague ? radius * 0.4 : 0;

    const enemies = this.world.query(["EnemyTag", "Transform"]);
    for (const e of enemies) {
      if (!this.world.isAlive(e)) continue;
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      const dx = pT.x - t.x, dy = pT.y - t.y;
      if (dx * dx + dy * dy <= radius * radius) {
        const killed = damageEnemy(this.world, this.stage, e, damage, t.x, t.y);
        // Plague: on kill, damage nearby enemies (chain reaction)
        if (killed && isPlague) {
          for (const e2 of enemies) {
            if (!this.world.isAlive(e2) || e2 === e) continue;
            const t2 = this.world.getComponent<Transform>(e2, "Transform")!;
            const d2x = t.x - t2.x, d2y = t.y - t2.y;
            if (d2x * d2x + d2y * d2y <= plagueRadius * plagueRadius) {
              damageEnemy(this.world, this.stage, e2, damage, t2.x, t2.y);
            }
          }
        }
      }
    }
  }
}

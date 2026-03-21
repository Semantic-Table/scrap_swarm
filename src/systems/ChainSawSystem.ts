import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Collider } from "../components/Collider";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playChainsawBuzz } from "../core/Audio";
import { SAW_COOLDOWN, SAW_DAMAGE, SAW_RANGE, SAW_ARC, SAW_COLOR } from "../config/constants";

export class ChainSawSystem implements System {
  readonly name = "ChainSawSystem";
  private world: World;
  private stage: Container;
  private timer = 0;
  private soundTimer = 0;
  private sawGraphic: Graphics | null = null;

  constructor(world: World, stage: Container) { this.world = world; this.stage = stage; }

  update(dt: number): void {
    const level = getItemLevel(this.world, "chainsaw");
    if (level <= 0) {
      if (this.sawGraphic) this.sawGraphic.visible = false;
      return;
    }

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
    const range = (SAW_RANGE + (level - 1) * 5) * getRangeMult(this.world);
    const isMassacre = hasEvolution(this.world, "massacre");
    const arc = isMassacre ? Math.PI * 2 : SAW_ARC + (level - 1) * 0.05;
    const halfArc = arc / 2;

    // Draw saw cone
    if (!this.sawGraphic) {
      this.sawGraphic = new Graphics();
      this.stage.addChild(this.sawGraphic);
    }
    this.sawGraphic.visible = true;
    this.sawGraphic.clear();
    this.sawGraphic.moveTo(pT.x, pT.y);
    this.sawGraphic.arc(pT.x, pT.y, range, pT.rotation - halfArc, pT.rotation + halfArc);
    this.sawGraphic.lineTo(pT.x, pT.y);
    this.sawGraphic.fill({ color: SAW_COLOR, alpha: 0.15 });
    this.sawGraphic.arc(pT.x, pT.y, range, pT.rotation - halfArc, pT.rotation + halfArc);
    this.sawGraphic.stroke({ color: SAW_COLOR, width: 2, alpha: 0.5 });

    // Sound throttle
    this.soundTimer -= dt;

    // Tick damage
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.soundTimer <= 0) { playChainsawBuzz(); this.soundTimer = 0.3; }
    this.timer = SAW_COOLDOWN * getCooldownMult(this.world);

    const damage = SAW_DAMAGE + Math.floor((level - 1) / 3) + getBonusDamage(this.world);
    const enemies = this.world.query(["EnemyTag", "Transform", "Collider"]);

    for (const e of enemies) {
      if (!this.world.isAlive(e)) continue;
      const t = this.world.getComponent<Transform>(e, "Transform")!;
      const c = this.world.getComponent<Collider>(e, "Collider")!;
      const dx = t.x - pT.x, dy = t.y - pT.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range + c.radius) continue;

      const angle = Math.atan2(dy, dx);
      let diff = angle - pT.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) {
        damageEnemy(this.world, this.stage, e, damage, t.x, t.y);
      }
    }
  }
}

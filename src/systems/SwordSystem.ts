import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { Collider } from "../components/Collider";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { getItemLevel, getBonusDamage, getCooldownMult, getRangeMult, getQuantityBonus } from "../core/UpgradeEffects";
import { damageEnemy } from "../core/Combat";
import { hasEvolution } from "../core/EvolutionManager";
import { playSlash } from "../core/Audio";
import {
  SWORD_COOLDOWN,
  SWORD_RANGE,
  SWORD_ARC,
  SWORD_DAMAGE,
  SWORD_COLOR,
  SWORD_FLASH_DURATION,
} from "../config/constants";

export class SwordSystem implements System {
  readonly name = "SwordSystem";
  private world: World;
  private stage: Container;
  private timer = 0;
  private spinAngle = 0;
  private whirlwindSoundTimer = 0;
  private pendingSlashes: Array<{ delay: number; range: number; arc: number; damage: number }> = [];
  private activeSlashes: Array<{ g: Graphics; life: number; maxLife: number }> = [];

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  update(dt: number): void {
    // Process active slash visuals (ticker-driven, no rAF)
    for (let i = this.activeSlashes.length - 1; i >= 0; i--) {
      const s = this.activeSlashes[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.g.removeFromParent();
        s.g.destroy();
        this.activeSlashes.splice(i, 1);
      } else {
        // Follow player position
        const players = this.world.query(["PlayerTag", "Transform"]);
        if (players.length > 0) {
          const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
          s.g.x = pT.x;
          s.g.y = pT.y;
        }
        s.g.alpha = s.life / s.maxLife;
      }
    }

    // Process pending delayed slashes
    for (let i = this.pendingSlashes.length - 1; i >= 0; i--) {
      this.pendingSlashes[i].delay -= dt;
      if (this.pendingSlashes[i].delay <= 0) {
        const p = this.pendingSlashes.splice(i, 1)[0];
        const players = this.world.query(["PlayerTag", "Transform"]);
        if (players.length > 0) {
          const pT = this.world.getComponent<Transform>(players[0], "Transform")!;
          this.slash(pT.x, pT.y, pT.rotation, p.range, p.arc, p.damage);
        }
      }
    }

    const level = getItemLevel(this.world, "sword");
    if (level <= 0) return;

    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;

    const range = (SWORD_RANGE + (level - 1) * 12) * getRangeMult(this.world);
    const damage = SWORD_DAMAGE + Math.floor((level - 1) / 2) + getBonusDamage(this.world);

    // --- WHIRLWIND evolution: permanent 360° spin ---
    if (hasEvolution(this.world, "whirlwind")) {
      this.spinAngle += dt * 8; // fast spin
      this.timer -= dt;
      this.whirlwindSoundTimer -= dt;
      if (this.timer > 0) return;
      this.timer = 0.15 * getCooldownMult(this.world); // very fast hits

      // Play slash sound at reduced rate — every ~0.4s — to avoid audio spam
      if (this.whirlwindSoundTimer <= 0) {
        playSlash();
        this.whirlwindSoundTimer = 0.4;
      }

      // Full circle slash at current spin angle
      this.slash(pT.x, pT.y, this.spinAngle, range * 0.85, Math.PI * 2, Math.max(1, Math.floor(damage * 0.6)));
      return;
    }

    // --- Counter Strike evolution: handled by CollisionSystem ---

    // --- Normal sword ---
    this.timer -= dt;
    if (this.timer > 0) return;

    this.timer = Math.max(0.2, SWORD_COOLDOWN - (level - 1) * 0.05) * getCooldownMult(this.world);

    const arc = SWORD_ARC + (level - 1) * 0.15;
    playSlash();
    this.slash(pT.x, pT.y, pT.rotation, range, arc, damage);

    // Queue extra slashes from Quantité
    const extra = getQuantityBonus(this.world);
    for (let i = 1; i <= extra; i++) {
      this.pendingSlashes.push({ delay: i * 0.05, range, arc, damage });
    }
  }

  private slash(cx: number, cy: number, facing: number, range: number, arc: number, damage: number): void {
    const enemies = this.world.query(["EnemyTag", "Transform", "Collider"]);
    const halfArc = arc / 2;

    for (const entity of enemies) {
      if (!this.world.isAlive(entity)) continue;

      const t = this.world.getComponent<Transform>(entity, "Transform")!;
      const c = this.world.getComponent<Collider>(entity, "Collider")!;
      const dx = t.x - cx;
      const dy = t.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > range + c.radius) continue;

      const angle = Math.atan2(dy, dx);
      let diff = angle - facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) <= halfArc) {
        damageEnemy(this.world, this.stage, entity, damage, t.x, t.y);
      }
    }

    this.drawSlash(cx, cy, facing, range, halfArc);
  }

  private drawSlash(cx: number, cy: number, facing: number, range: number, halfArc: number): void {
    const g = new Graphics();

    // Arc fill
    g.moveTo(0, 0);
    g.arc(0, 0, range, facing - halfArc, facing + halfArc);
    g.lineTo(0, 0);
    g.fill({ color: SWORD_COLOR, alpha: 0.25 });
    // Bright white leading edge
    g.arc(0, 0, range, facing - halfArc, facing + halfArc);
    g.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
    // Gold outer stroke
    g.arc(0, 0, range, facing - halfArc, facing + halfArc);
    g.stroke({ color: SWORD_COLOR, width: 4, alpha: 0.6 });

    g.x = cx;
    g.y = cy;
    this.stage.addChild(g);

    this.activeSlashes.push({ g, life: SWORD_FLASH_DURATION, maxLife: SWORD_FLASH_DURATION });
  }
}

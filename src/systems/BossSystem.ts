import type { System } from "../ecs/types";
import type { World } from "../ecs/World";
import type { Transform } from "../components/Transform";
import type { BossTag } from "../components/MapObject";
import type { WaveState } from "../components/Wave";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createVelocity } from "../components/Velocity";
import { createSprite } from "../components/Sprite";
import { createCollider } from "../components/Collider";
import { createHealth } from "../components/Health";
import { createEnemyTag } from "../components/Tags";
import { createEnemyType } from "../components/EnemyType";
import { createBossTag } from "../components/MapObject";
import { createEnemyProjectileTag } from "../components/EnemyProjectile";
import { createLifetime } from "../components/Lifetime";
import {
  BOSS_A_HP, BOSS_A_SIZE, BOSS_A_COLOR, BOSS_A_SPAWN_AT, BOSS_A_SHOCKWAVE_INTERVAL, BOSS_A_SHOCKWAVE_SPEED,
  BOSS_B_HP, BOSS_B_SIZE, BOSS_B_COLOR, BOSS_B_SPAWN_AT, BOSS_B_FIRE_INTERVAL,
  QUEEN_SPAWN_AT, QUEEN_HP, QUEEN_SIZE, QUEEN_COLOR, QUEEN_SPEED,
  QUEEN_SWARM_INTERVAL, QUEEN_SWARM_COUNT, QUEEN_PULSE_INTERVAL, QUEEN_PULSE_COUNT, QUEEN_PULSE_SPEED,
  ENEMY_TYPES,
} from "../config/constants";

/** Handles boss spawning and behavior */
export class BossSystem implements System {
  readonly name = "BossSystem";
  private world: World;
  private stage: Container;

  // Per-boss timers (keyed by entity ID)
  private bossTimers = new Map<number, { attack: number; special: number }>();
  // Active shockwave rings
  private shockwaves: Array<{ g: Graphics; x: number; y: number; radius: number; maxRadius: number; speed: number; hitPlayer: boolean }> = [];

  constructor(world: World, stage: Container) {
    this.world = world;
    this.stage = stage;
  }

  update(dt: number): void {
    const managers = this.world.query(["WaveState"]);
    if (managers.length === 0) return;
    const wave = this.world.getComponent<WaveState>(managers[0], "WaveState")!;

    // Note: overclockTimer and magnetPulseTimer are ticked in WaveSystem

    // Spawn bosses at act boundaries
    this.checkBossSpawns(wave);

    // Update shockwave rings — damage player on contact
    const shockPlayers = this.world.query(["PlayerTag", "Transform", "Collider"]);
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      const prevRadius = sw.radius;
      sw.radius += sw.speed * dt;
      if (sw.radius >= sw.maxRadius) {
        sw.g.removeFromParent(); sw.g.destroy();
        this.shockwaves.splice(i, 1);
        continue;
      }
      sw.g.clear();
      sw.g.circle(sw.x, sw.y, sw.radius).stroke({ color: BOSS_A_COLOR, width: 4, alpha: 1 - sw.radius / sw.maxRadius });

      // Check if shockwave ring crossed the player this frame
      if (shockPlayers.length > 0 && !sw.hitPlayer) {
        const pt = this.world.getComponent<Transform>(shockPlayers[0], "Transform")!;
        const dx = pt.x - sw.x, dy = pt.y - sw.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ringWidth = 20;
        if (dist >= prevRadius - ringWidth && dist <= sw.radius + ringWidth) {
          sw.hitPlayer = true;
          // Damage handled by CollisionSystem — create a brief enemy projectile at player pos
          const projEntity = this.world.createEntity();
          const projG = new Graphics();
          projG.circle(0, 0, 1).fill({ color: BOSS_A_COLOR, alpha: 0 }); // invisible
          this.stage.addChild(projG);
          this.world.addComponent(projEntity, createTransform(pt.x, pt.y));
          this.world.addComponent(projEntity, createVelocity(0, 0));
          this.world.addComponent(projEntity, createSprite(projG));
          this.world.addComponent(projEntity, createCollider(ringWidth));
          this.world.addComponent(projEntity, createEnemyProjectileTag());
          this.world.addComponent(projEntity, createLifetime(0.05));
        }
      }
    }

    // Process boss behaviors
    const bosses = this.world.query(["BossTag", "Transform", "Health"]);
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;

    for (const entity of bosses) {
      if (!this.world.isAlive(entity)) continue;
      const boss = this.world.getComponent<BossTag>(entity, "BossTag")!;
      const t = this.world.getComponent<Transform>(entity, "Transform")!;

      let timers = this.bossTimers.get(entity);
      if (!timers) { timers = { attack: 1, special: 3 }; this.bossTimers.set(entity, timers); }
      timers.attack -= dt;
      timers.special -= dt;

      // Move toward player (slow)
      const dx = pT.x - t.x, dy = pT.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        const speed = boss.bossType === "queen" ? QUEEN_SPEED : 40;
        t.x += (dx / dist) * speed * dt;
        t.y += (dy / dist) * speed * dt;
        t.rotation = Math.atan2(dy, dx);
      }

      switch (boss.bossType) {
        case "colossus":
          if (timers.attack <= 0) {
            timers.attack = BOSS_A_SHOCKWAVE_INTERVAL;
            this.spawnShockwave(t.x, t.y);
          }
          break;

        case "broadcaster":
          if (timers.attack <= 0) {
            timers.attack = BOSS_B_FIRE_INTERVAL;
            this.fireBurst(t.x, t.y, 8);
          }
          break;

        case "queen":
          if (timers.attack <= 0) {
            timers.attack = QUEEN_SWARM_INTERVAL;
            this.spawnSwarmRing(t.x, t.y);
          }
          if (timers.special <= 0) {
            timers.special = QUEEN_PULSE_INTERVAL;
            this.fireBurst(t.x, t.y, QUEEN_PULSE_COUNT);
          }
          break;
      }
    }

    // Clean up timers for dead bosses
    for (const id of this.bossTimers.keys()) {
      if (!this.world.isAlive(id)) this.bossTimers.delete(id);
    }
  }

  private checkBossSpawns(wave: WaveState): void {
    const players = this.world.query(["PlayerTag", "Transform"]);
    if (players.length === 0) return;
    const pT = this.world.getComponent<Transform>(players[0], "Transform")!;

    if (!wave.bossASpawned && wave.elapsed >= BOSS_A_SPAWN_AT) {
      wave.bossASpawned = true;
      this.spawnBoss("colossus", pT.x + 300, pT.y, BOSS_A_HP, BOSS_A_SIZE, BOSS_A_COLOR);
    }

    if (!wave.bossBSpawned && wave.elapsed >= BOSS_B_SPAWN_AT) {
      wave.bossBSpawned = true;
      this.spawnBoss("broadcaster", pT.x - 300, pT.y, BOSS_B_HP, BOSS_B_SIZE, BOSS_B_COLOR);
    }

    if (!wave.queenSpawned && wave.elapsed >= QUEEN_SPAWN_AT) {
      wave.queenSpawned = true;
      wave.queenActive = true;
      this.spawnBoss("queen", pT.x, pT.y - 400, QUEEN_HP, QUEEN_SIZE, QUEEN_COLOR);
    }
  }

  private spawnBoss(bossType: "colossus" | "broadcaster" | "queen", x: number, y: number, hp: number, size: number, color: number): void {
    const entity = this.world.createEntity();
    const g = new Graphics();

    // Distinct visual per boss
    if (bossType === "colossus") {
      // Big hexagon
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push(Math.cos(a) * size, Math.sin(a) * size);
      }
      g.poly(pts).fill(0x1a0a2e);
      g.poly(pts).stroke({ color, width: 4 });
      g.circle(0, 0, size * 0.4).fill(color);
    } else if (bossType === "broadcaster") {
      // Big cross
      g.rect(-size, -size * 0.25, size * 2, size * 0.5).fill(0x2a0a1e);
      g.rect(-size * 0.25, -size, size * 0.5, size * 2).fill(0x2a0a1e);
      g.rect(-size, -size * 0.25, size * 2, size * 0.5).stroke({ color, width: 3 });
      g.rect(-size * 0.25, -size, size * 0.5, size * 2).stroke({ color, width: 3 });
      g.circle(0, 0, size * 0.3).fill(color);
    } else {
      // Queen — concentric circles
      g.circle(0, 0, size).fill(0x0a2a1e);
      g.circle(0, 0, size).stroke({ color, width: 3 });
      g.circle(0, 0, size * 0.7).stroke({ color, width: 2, alpha: 0.6 });
      g.circle(0, 0, size * 0.4).fill(color);
    }

    this.stage.addChild(g);

    this.world.addComponent(entity, createTransform(x, y));
    this.world.addComponent(entity, createVelocity());
    this.world.addComponent(entity, createSprite(g));
    this.world.addComponent(entity, createCollider(size));
    this.world.addComponent(entity, createHealth(hp));
    this.world.addComponent(entity, createEnemyTag());
    this.world.addComponent(entity, createBossTag(bossType));
    // EnemyType for compatibility with Combat.ts kill logic
    this.world.addComponent(entity, createEnemyType("tank", 40, bossType === "queen" ? 60 : 30));
  }

  private spawnShockwave(x: number, y: number): void {
    const g = new Graphics();
    this.stage.addChild(g);
    this.shockwaves.push({ g, x, y, radius: 10, maxRadius: 300, speed: BOSS_A_SHOCKWAVE_SPEED, hitPlayer: false });
  }

  private fireBurst(cx: number, cy: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const entity = this.world.createEntity();
      const g = new Graphics();
      g.circle(0, 0, 5).fill(0xff69b4);
      this.stage.addChild(g);

      this.world.addComponent(entity, createTransform(cx, cy));
      this.world.addComponent(entity, createVelocity(
        Math.cos(angle) * QUEEN_PULSE_SPEED,
        Math.sin(angle) * QUEEN_PULSE_SPEED,
      ));
      this.world.addComponent(entity, createSprite(g));
      this.world.addComponent(entity, createCollider(5));
      this.world.addComponent(entity, createEnemyProjectileTag());
      this.world.addComponent(entity, createLifetime(3));
    }
  }

  private spawnSwarmRing(cx: number, cy: number): void {
    for (let i = 0; i < QUEEN_SWARM_COUNT; i++) {
      const angle = (Math.PI * 2 / QUEEN_SWARM_COUNT) * i;
      const x = cx + Math.cos(angle) * 40;
      const y = cy + Math.sin(angle) * 40;

      const config = ENEMY_TYPES.swarm;
      const entity = this.world.createEntity();
      const g = new Graphics();
      g.circle(0, 0, config.size).fill(0x0a1a0e);
      g.circle(0, 0, config.size).stroke({ color: config.color, width: 1.5 });
      this.stage.addChild(g);

      this.world.addComponent(entity, createTransform(x, y));
      this.world.addComponent(entity, createVelocity());
      this.world.addComponent(entity, createSprite(g));
      this.world.addComponent(entity, createCollider(config.size));
      this.world.addComponent(entity, createHealth(config.hp));
      this.world.addComponent(entity, createEnemyTag());
      this.world.addComponent(entity, createEnemyType("swarm", config.speed, config.scrapDrop));
    }
  }
}

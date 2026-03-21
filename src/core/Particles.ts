import type { Container } from "pixi.js";
import { Graphics, Text, TextStyle } from "pixi.js";

// ─── Particle types ──────────────────────────────────────────────────────────

type ParticleType = "death" | "killFlash" | "pickupRing" | "pickupSpark" | "evoBurst" | "evoRing" | "shockwave";

interface Particle {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  ptype: ParticleType;
  size: number;
  color: number;
  baseR: number;
  baseG: number;
  baseB: number;
  /** Shockwave segments count (only for shockwave type) */
  segments: number;
  /** Ring delay before animation starts (evoRing) */
  delay: number;
}

interface FloatingText {
  text: Text;
  startY: number;
  life: number;
  maxLife: number;
}

// ─── Module-level pools ──────────────────────────────────────────────────────

const activeParticles: Particle[] = [];
const activeTexts: FloatingText[] = [];

// ─── Public API ──────────────────────────────────────────────────────────────

/** Tick all active particles and texts. Call from Game.ts main ticker. */
export function updateParticles(dt: number): void {
  // Update particles
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];

    // Handle delay (evoRing waits before animating)
    if (p.delay > 0) {
      p.delay -= dt;
      continue;
    }

    p.life -= dt;
    if (p.life <= 0) {
      p.g.removeFromParent();
      p.g.destroy();
      activeParticles.splice(i, 1);
      continue;
    }

    const t = 1 - p.life / p.maxLife; // 0→1 progress

    switch (p.ptype) {
      case "death":
        updateDeathParticle(p, dt, t);
        break;
      case "killFlash":
        updateKillFlash(p, t);
        break;
      case "pickupRing":
        updatePickupRing(p, t);
        break;
      case "pickupSpark":
        updatePickupSpark(p, t);
        break;
      case "evoBurst":
        updateEvoBurst(p, dt, t);
        break;
      case "evoRing":
        updateEvoRing(p, t);
        break;
      case "shockwave":
        updateShockwave(p, t);
        break;
    }
  }

  // Update floating texts
  for (let i = activeTexts.length - 1; i >= 0; i--) {
    const ft = activeTexts[i];
    ft.life -= dt;
    if (ft.life <= 0) {
      ft.text.removeFromParent();
      ft.text.destroy();
      activeTexts.splice(i, 1);
      continue;
    }
    const t = 1 - ft.life / ft.maxLife;
    ft.text.y = ft.startY - t * 30;
    ft.text.alpha = 1 - t;
  }
}

/** Clear all active particles and texts. Call on restart. */
export function clearParticles(): void {
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];
    p.g.removeFromParent();
    p.g.destroy();
  }
  activeParticles.length = 0;

  for (let i = activeTexts.length - 1; i >= 0; i--) {
    const ft = activeTexts[i];
    ft.text.removeFromParent();
    ft.text.destroy();
  }
  activeTexts.length = 0;
}

// ─── Update helpers ──────────────────────────────────────────────────────────

function updateDeathParticle(p: Particle, dt: number, t: number): void {
  p.vy += 120 * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.g.x = p.x;
  p.g.y = p.y;

  // Color: white → enemy color → dark
  const tint = Math.max(0, 1 - t * 2);
  const r = Math.round(255 * (1 - t * 0.4) * (1 - tint) + p.baseR * tint);
  const green = Math.round(200 * (1 - t) * (1 - tint) + p.baseG * tint);
  const b = Math.round(p.baseB * tint * (1 - t));
  const col = (r << 16) | (green << 8) | b;

  p.g.clear();
  const s = p.size * (1 - t * 0.5);
  p.g.circle(0, 0, s).fill({ color: col, alpha: 1 - t * 0.7 });
  if (t < 0.4) {
    p.g.circle(0, 0, s * 0.5).fill({ color: 0xffffff, alpha: (0.4 - t) * 2 });
  }
  p.g.rotation += dt * 8;
}

function updateKillFlash(p: Particle, t: number): void {
  p.g.clear();
  const r = p.size * (1 + t * 1.5);
  p.g.circle(0, 0, r).fill({ color: 0xffffff, alpha: (1 - t) * 0.5 });
  p.g.circle(0, 0, r * 1.2).stroke({ color: 0xffffff, width: 2, alpha: (1 - t) * 0.3 });
}

function updatePickupRing(p: Particle, t: number): void {
  const r = 6 + t * 20;
  p.g.clear().circle(0, 0, r).stroke({ color: 0xd4a047, width: 2, alpha: 1 - t });
}

function updatePickupSpark(p: Particle, t: number): void {
  const angle = p.vx; // we store angle in vx for sparks
  const dist = p.size; // we store max dist in size
  const r = dist * t;
  const ox = p.x; // original x stored
  const oy = p.y; // original y stored
  p.g.clear()
    .moveTo(ox + Math.cos(angle) * r * 0.5, oy + Math.sin(angle) * r * 0.5)
    .lineTo(ox + Math.cos(angle) * r, oy + Math.sin(angle) * r)
    .stroke({ color: 0xf5c842, width: 2, alpha: 1 - t * t });
}

function updateEvoBurst(p: Particle, dt: number, t: number): void {
  p.vy += 60 * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.g.x = p.x;
  p.g.y = p.y;
  p.g.clear();
  const s = p.size * (1 - t * 0.4);
  p.g.circle(0, 0, s).fill({ color: p.color, alpha: 1 - t });
  if (t < 0.3) {
    p.g.circle(0, 0, s * 0.5).fill({ color: 0xffffff, alpha: (0.3 - t) * 3 });
  }
}

function updateEvoRing(p: Particle, t: number): void {
  p.g.clear();
  const rad = 20 + t * 100;
  p.g.circle(0, 0, rad).stroke({ color: p.color, width: 4 * (1 - t), alpha: 1 - t });
}

function updateShockwave(p: Particle, t: number): void {
  p.g.clear();
  const r = t * 120;
  const alpha = (1 - t) * 0.9;
  const bulge = 1 + Math.sin(t * Math.PI) * 0.15;
  const SEGMENTS = p.segments;
  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = (Math.PI * 2 / SEGMENTS) * i;
    const a1 = a0 + (Math.PI * 2 / SEGMENTS) * 0.65;
    p.g.moveTo(Math.cos(a0) * r * bulge, Math.sin(a0) * r * bulge)
      .arc(0, 0, r * bulge, a0, a1)
      .stroke({ color: p.color, width: 3 - t * 2, alpha });
  }
  if (t < 0.25) {
    p.g.circle(0, 0, r * 0.6).fill({ color: 0xffffff, alpha: (0.25 - t) * 3 });
  }
}

// ─── Spawn functions ─────────────────────────────────────────────────────────

function makeParticle(ptype: ParticleType): Particle {
  return {
    g: new Graphics(),
    x: 0, y: 0, vx: 0, vy: 0,
    life: 0, maxLife: 0,
    ptype,
    size: 0, color: 0,
    baseR: 0, baseG: 0, baseB: 0,
    segments: 0, delay: 0,
  };
}

/** Spawn hot-core metal shard particles at a position */
export function spawnDeathParticles(
  stage: Container,
  x: number,
  y: number,
  color: number,
  count = 6,
): void {
  const baseR = (color >> 16) & 0xff;
  const baseG = (color >> 8) & 0xff;
  const baseB = color & 0xff;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 200;
    const size = 2 + Math.random() * 3;
    const duration = (350 + Math.random() * 300) / 1000; // convert ms to seconds

    const p = makeParticle("death");
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.size = size;
    p.life = duration;
    p.maxLife = duration;
    p.color = color;
    p.baseR = baseR;
    p.baseG = baseG;
    p.baseB = baseB;

    p.g.circle(0, 0, size).fill(0xffffff);
    p.g.x = x;
    p.g.y = y;
    stage.addChild(p.g);
    activeParticles.push(p);
  }
}

/** White flash ring at kill position */
export function spawnKillFlash(stage: Container, x: number, y: number, radius: number): void {
  const duration = 180 / 1000;
  const p = makeParticle("killFlash");
  p.x = x;
  p.y = y;
  p.size = radius;
  p.life = duration;
  p.maxLife = duration;

  p.g.x = x;
  p.g.y = y;
  stage.addChild(p.g);
  activeParticles.push(p);
}

/** Expanding gold ring + spark lines on scrap pickup */
export function spawnPickupBurst(stage: Container, x: number, y: number): void {
  // Ring
  const ringDur = 200 / 1000;
  const ring = makeParticle("pickupRing");
  ring.x = x;
  ring.y = y;
  ring.life = ringDur;
  ring.maxLife = ringDur;
  ring.g.x = x;
  ring.g.y = y;
  stage.addChild(ring.g);
  activeParticles.push(ring);

  // Sparks
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const sparkDur = 150 / 1000;
    const dist = 12 + Math.random() * 10;

    const spark = makeParticle("pickupSpark");
    spark.x = x;  // store origin x
    spark.y = y;  // store origin y
    spark.vx = angle;  // store angle in vx
    spark.size = dist;  // store max distance in size
    spark.life = sparkDur;
    spark.maxLife = sparkDur;

    stage.addChild(spark.g);
    activeParticles.push(spark);
  }
}

/** Multi-kill tracking (no slowmo for now — placeholder for future effect) */
export function registerKill(): void {
  // Reserved for future multi-kill feedback
}

/** Big colorful burst for evolution unlock */
export function spawnEvolutionBurst(stage: Container, x: number, y: number, color: number): void {
  // 20 fast particles
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 200 + Math.random() * 300;
    const size = 3 + Math.random() * 4;
    const duration = (500 + Math.random() * 400) / 1000;

    const p = makeParticle("evoBurst");
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.size = size;
    p.life = duration;
    p.maxLife = duration;
    p.color = color;

    p.g.circle(0, 0, size).fill(color);
    p.g.x = x;
    p.g.y = y;
    stage.addChild(p.g);
    activeParticles.push(p);
  }

  // Two expanding rings
  for (let r = 0; r < 2; r++) {
    const ringDur = (400 + r * 200) / 1000;
    const ringDelay = (r * 100) / 1000;

    const ring = makeParticle("evoRing");
    ring.x = x;
    ring.y = y;
    ring.life = ringDur;
    ring.maxLife = ringDur;
    ring.color = color;
    ring.delay = ringDelay;

    ring.g.x = x;
    ring.g.y = y;
    stage.addChild(ring.g);
    activeParticles.push(ring);
  }
}

/** Segmented shockwave ring for heavy kills (tanks) */
export function spawnShockwave(stage: Container, x: number, y: number, color: number): void {
  const duration = 350 / 1000;
  const p = makeParticle("shockwave");
  p.x = x;
  p.y = y;
  p.life = duration;
  p.maxLife = duration;
  p.color = color;
  p.segments = 12;

  p.g.x = x;
  p.g.y = y;
  stage.addChild(p.g);
  activeParticles.push(p);
}

/** Floating damage number that rises and fades */
export function spawnDamageNumber(stage: Container, x: number, y: number, value: number, color: number): void {
  const text = new Text({
    text: `+${value}`,
    style: new TextStyle({
      fontFamily: "monospace",
      fontSize: 14,
      fontWeight: "bold",
      fill: color,
    }),
  });
  text.anchor.set(0.5);
  text.x = x;
  text.y = y;
  stage.addChild(text);

  const duration = 0.6;
  activeTexts.push({
    text,
    startY: y,
    life: duration,
    maxLife: duration,
  });
}

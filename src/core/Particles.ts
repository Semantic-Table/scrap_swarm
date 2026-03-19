import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
/** Spawn hot-core metal shard particles at a position */
export function spawnDeathParticles(
  stage: Container,
  x: number,
  y: number,
  _color: number,
  count = 6,
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 200;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    const size = 2 + Math.random() * 3;

    const g = new Graphics();
    g.circle(0, 0, size).fill(0xffffff);
    g.x = x;
    g.y = y;
    stage.addChild(g);

    const duration = 350 + Math.random() * 300;
    const start = performance.now();
    let lastFrame = start;

    const animate = () => {
      const now = performance.now();
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      const t = (now - start) / duration;

      if (t >= 1) {
        g.removeFromParent();
        g.destroy();
        return;
      }

      // Gravity
      vy += 120 * dt;

      g.x += vx * dt;
      g.y += vy * dt;

      // Color: white → yellow → orange → dark rust
      const r = Math.round(255 * (1 - t * 0.6));
      const green = Math.round(200 * (1 - t));
      const b = 0;
      const col = (r << 16) | (green << 8) | b;

      g.clear();
      const s = size * (1 - t * 0.5);
      g.circle(0, 0, s).fill({ color: col, alpha: 1 - t * 0.7 });
      // Bright inner core (fades faster)
      if (t < 0.4) {
        g.circle(0, 0, s * 0.5).fill({ color: 0xffffff, alpha: (0.4 - t) * 2 });
      }

      g.rotation += dt * 8;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}

/** White flash ring at kill position */
export function spawnKillFlash(stage: Container, x: number, y: number, radius: number): void {
  const g = new Graphics();
  g.x = x;
  g.y = y;
  stage.addChild(g);
  const start = performance.now();
  const DURATION = 180;

  const anim = () => {
    const t = (performance.now() - start) / DURATION;
    if (t >= 1) { g.removeFromParent(); g.destroy(); return; }
    g.clear();
    const r = radius * (1 + t * 1.5);
    g.circle(0, 0, r).fill({ color: 0xffffff, alpha: (1 - t) * 0.5 });
    g.circle(0, 0, r * 1.2).stroke({ color: 0xffffff, width: 2, alpha: (1 - t) * 0.3 });
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

/** Expanding gold ring + spark lines on scrap pickup */
export function spawnPickupBurst(stage: Container, x: number, y: number): void {
  const ring = new Graphics();
  stage.addChild(ring);
  const startMs = performance.now();
  const DURATION = 200;

  const animRing = () => {
    const t = (performance.now() - startMs) / DURATION;
    if (t >= 1) { ring.removeFromParent(); ring.destroy(); return; }
    const r = 6 + t * 20;
    ring.clear().circle(0, 0, r).stroke({ color: 0xd4a047, width: 2, alpha: 1 - t });
    ring.x = x; ring.y = y;
    requestAnimationFrame(animRing);
  };
  requestAnimationFrame(animRing);

  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spark = new Graphics();
    stage.addChild(spark);
    const sparkStart = performance.now();
    const SPARK_DUR = 150;
    const dist = 12 + Math.random() * 10;

    const animSpark = () => {
      const t = (performance.now() - sparkStart) / SPARK_DUR;
      if (t >= 1) { spark.removeFromParent(); spark.destroy(); return; }
      const r = dist * t;
      spark.clear()
        .moveTo(x + Math.cos(angle) * r * 0.5, y + Math.sin(angle) * r * 0.5)
        .lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r)
        .stroke({ color: 0xf5c842, width: 2, alpha: 1 - t * t });
      requestAnimationFrame(animSpark);
    };
    requestAnimationFrame(animSpark);
  }
}

/** Multi-kill tracking (no slowmo for now — placeholder for future effect) */
export function registerKill(): void {
  // Reserved for future multi-kill feedback
}

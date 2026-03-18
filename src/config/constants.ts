// Player
export const PLAYER_SPEED = 300;
export const PLAYER_SIZE = 20; // half-size (drawn as 40x40)
export const PLAYER_COLOR = 0xd4a047;

// Enemy types
export const ENEMY_TYPES = {
  basic: {
    speed: 120,
    size: 16,
    color: 0xc0392b,
    hp: 1,
    scrapDrop: 1,
  },
  runner: {
    speed: 220,
    size: 10,
    color: 0xe67e22,
    hp: 1,
    scrapDrop: 1,
  },
  tank: {
    speed: 60,
    size: 24,
    color: 0x7d3c98,
    hp: 3,
    scrapDrop: 3,
  },
  swarm: {
    speed: 160,
    size: 8,
    color: 0x27ae60,
    hp: 1,
    scrapDrop: 1,
  },
} as const;

export type EnemyTypeName = keyof typeof ENEMY_TYPES;

// Waves — enemy type unlock schedule (wave number)
export const ENEMY_UNLOCK_WAVE: Record<EnemyTypeName, number> = {
  basic: 1,
  runner: 3,
  swarm: 5,
  tank: 4,
};

// Legacy (used as fallback)
export const ENEMY_SPEED = 120;
export const ENEMY_SIZE = 16;
export const ENEMY_COLOR = 0xc0392b;

// Spawn
export const SPAWN_MARGIN = 50; // distance outside screen edge

// Projectile
export const PROJECTILE_SPEED = 500;
export const PROJECTILE_SIZE = 4;
export const PROJECTILE_COLOR = 0xf5c842;
export const PROJECTILE_LIFETIME = 2; // seconds
export const SHOOT_COOLDOWN = 0.3; // seconds between shots
export const SHOOT_RANGE = 300; // max targeting range in pixels

// Scrap
export const SCRAP_SIZE = 6;
export const SCRAP_COLOR = 0x8c8c8c;
export const SCRAP_PICKUP_RADIUS = 60;
export const SCRAP_ATTRACT_SPEED = 250; // pixels/s when being sucked toward player
export const SCRAP_ATTRACT_RADIUS = 80; // starts moving toward player at this distance

// Turret
export const TURRET_SIZE = 12;
export const TURRET_COLOR = 0x5dade2;
export const TURRET_ORBIT_DISTANCE = 80;
export const TURRET_ORBIT_SPEED = 1.2; // radians per second
export const TURRET_SHOOT_COOLDOWN = 0.5;
export const TURRET_SHOOT_RANGE = 250;
export const TURRET_FIRST_COST = 5;   // scrap needed for first turret
export const TURRET_COST_INCREASE = 3; // extra scrap per additional turret

// Tesla
export const TESLA_COOLDOWN = 1.5;
export const TESLA_RANGE = 200;
export const TESLA_CHAIN_RANGE = 150;
export const TESLA_BASE_BOUNCES = 2;
export const TESLA_DAMAGE = 1;
export const TESLA_COLOR = 0x00e5ff;
export const TESLA_FLASH_DURATION = 0.15;

// Pulse (zone de dégâts)
export const PULSE_COOLDOWN = 2.5;
export const PULSE_RADIUS = 100;
export const PULSE_DAMAGE = 1;
export const PULSE_COLOR = 0xff6b35;
export const PULSE_FLASH_DURATION = 0.2;

// Flow (continuous spawning)
export const FLOW_INITIAL_INTERVAL = 1.5;   // seconds between spawns at start
export const FLOW_MIN_INTERVAL = 0.15;      // fastest possible spawn rate
export const FLOW_SPEED_SCALE = 0.15;       // enemy speed increase per minute
export const FLOW_INTERVAL_SCALE = 0.08;    // spawn interval decrease per minute
export const FLOW_HP_SCALE_INTERVAL = 180;  // seconds between enemy HP increases
export const FLOW_TARGET_TIME = 900;        // 15 minutes in seconds

// Display
export const BG_COLOR = "#1a1a2e";

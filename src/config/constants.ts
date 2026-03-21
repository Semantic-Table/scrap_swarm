// Player
export const PLAYER_SPEED = 300;
export const PLAYER_SIZE = 20; // half-size (drawn as 40x40)
export const PLAYER_COLOR = 0xd4a047;
export const PLAYER_HP = 5;
export const PLAYER_INVINCIBILITY = 1.0; // seconds of invincibility after taking a hit

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
    speed: 200,
    size: 8,
    color: 0x27ae60,
    hp: 1,
    scrapDrop: 1,
  },
  shooter: {
    speed: 80,
    size: 14,
    color: 0xe84393,
    hp: 2,
    scrapDrop: 2,
  },
} as const;

export type EnemyTypeName = keyof typeof ENEMY_TYPES;

// Waves — enemy type unlock schedule (wave number)
export const ENEMY_UNLOCK_WAVE: Record<EnemyTypeName, number> = {
  basic: 1,
  runner: 3,
  swarm: 5,
  tank: 4,
  shooter: 6,
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

// Shooter enemy
export const SHOOTER_STOP_DISTANCE = 250;  // stops approaching at this range
export const SHOOTER_FIRE_COOLDOWN = 2.0;
export const SHOOTER_PROJECTILE_SPEED = 200;
export const SHOOTER_PROJECTILE_SIZE = 5;
export const SHOOTER_PROJECTILE_COLOR = 0xe84393;
export const SHOOTER_PROJECTILE_LIFETIME = 1.5;

// Sword (melee slash)
export const SWORD_COOLDOWN = 0.8;
export const SWORD_RANGE = 100;
export const SWORD_ARC = Math.PI / 2;     // 90° sweep
export const SWORD_DAMAGE = 1;
export const SWORD_COLOR = 0xd4a047;
export const SWORD_FLASH_DURATION = 0.15;

// Pulse (zone de dégâts)
export const PULSE_COOLDOWN = 2.5;
export const PULSE_RADIUS = 100;
export const PULSE_DAMAGE = 1;
export const PULSE_COLOR = 0xff6b35;
export const PULSE_FLASH_DURATION = 0.2;

// Pack spawning — enemies spawn in groups
export const ENEMY_PACK_SIZE: Record<EnemyTypeName, number> = {
  basic: 4,
  runner: 5,
  tank: 1,
  swarm: 12,
  shooter: 3,
};
export const PACK_SPREAD = 80; // positional spread within a pack

// Flow (continuous spawning)
export const FLOW_INITIAL_INTERVAL = 1.2;   // seconds between pack spawns at start
export const FLOW_MIN_INTERVAL = 0.2;       // fastest possible spawn rate
export const FLOW_SPEED_SCALE = 0.15;       // enemy speed increase per minute
export const FLOW_INTERVAL_SCALE = 0.10;    // spawn interval decrease per minute
export const FLOW_HP_SCALE_INTERVAL = 120;  // seconds between enemy HP increases (every 2 min)
export const FLOW_TARGET_TIME = 600;        // 10 minutes in seconds

// Horde events — periodic difficulty spikes
export const HORDE_INTERVAL = 150;          // seconds between horde events (2.5 min)
export const HORDE_PACK_MULT = 4;           // spawn multiplier during horde
export const HORDE_DURATION = 8;            // seconds of horde spawning
export const HORDE_CALM_AFTER = 12;         // seconds of reduced spawns after horde

// Health pickup
export const HEALTH_DROP_CHANCE = 0.04; // 4% per enemy kill (only when player HP < 50%)
export const HEALTH_PICKUP_SIZE = 8;
export const HEALTH_PICKUP_COLOR = 0x2ecc71;
export const HEALTH_PICKUP_HEAL = 2;

// Destructible props
export const PROP_SPAWN_INTERVAL = 20;  // seconds between prop spawns
export const PROP_SIZE = 14;
export const PROP_COLOR = 0x7a6840;
export const PROP_HP = 2;

// Boomerang
export const BOOMERANG_COOLDOWN = 1.2;
export const BOOMERANG_DAMAGE = 1;
export const BOOMERANG_RANGE = 150;
export const BOOMERANG_SPEED = 300;
export const BOOMERANG_COLOR = 0xd4a047;

// Mine
export const MINE_COOLDOWN = 1.5;
export const MINE_DAMAGE = 3;
export const MINE_RADIUS = 60;
export const MINE_COLOR = 0xff4444;
export const MINE_LIFETIME = 8;

// Laser
export const LASER_COOLDOWN = 2.0;
export const LASER_DAMAGE = 2;
export const LASER_RANGE = 400;
export const LASER_WIDTH = 6;
export const LASER_COLOR = 0xff3333;
export const LASER_DURATION = 0.15;

// Aura (poison DoT)
export const AURA_COOLDOWN = 0.5;
export const AURA_DAMAGE = 1;
export const AURA_RADIUS = 80;
export const AURA_COLOR = 0x27ae60;

// Ricochet Bolt
export const RICOCHET_COOLDOWN = 0.8;
export const RICOCHET_DAMAGE = 1;
export const RICOCHET_SPEED = 400;
export const RICOCHET_BOUNCES = 3;
export const RICOCHET_COLOR = 0xe0e0e0;

// Gravity Well
export const GRAVITY_COOLDOWN = 4.0;
export const GRAVITY_DAMAGE = 5;
export const GRAVITY_RADIUS = 120;
export const GRAVITY_PULL_DURATION = 1.5;
export const GRAVITY_COLOR = 0x9b59b6;

// Chain Saw
export const SAW_COOLDOWN = 0.1;
export const SAW_DAMAGE = 1;
export const SAW_RANGE = 45;
export const SAW_ARC = Math.PI / 3;
export const SAW_COLOR = 0xff8c00;

// Scrap Turret (stationary)
export const SENTRY_COOLDOWN = 0.6;
export const SENTRY_RANGE = 200;
export const SENTRY_DAMAGE = 1;
export const SENTRY_LIFETIME = 15;
export const SENTRY_COLOR = 0x8c8c8c;
export const SENTRY_DEPLOY_COOLDOWN = 8;

// Scrap Caches — map objectives
export const CACHE_SPAWN_INTERVAL = 60;
export const CACHE_SPAWN_DISTANCE = 350;
export const CACHE_SIZE = 22;
export const CACHE_HP = 6;
export const CACHE_COLOR = 0xb8860b;
export const CACHE_SCRAP_DROP = 15;
export const CACHE_STOP_AT = 420;

// Power Crates
export const MAGNETITE_INTERVAL = 90;
export const MAGNETITE_COLOR = 0x3498db;
export const MAGNETITE_SPAWN_DIST = 500;
export const OVERCLOCK_INTERVAL = 120;
export const OVERCLOCK_DURATION = 8.0;
export const OVERCLOCK_COLOR = 0xf5c842;
export const REPAIR_COLOR = 0x2ecc71;
export const REPAIR_COOLDOWN = 15;
export const REPAIR_HEAL = 2;
export const POWER_CRATE_SIZE = 14;

// Bosses
export const BOSS_A_HP = 30;
export const BOSS_A_SIZE = 48;
export const BOSS_A_COLOR = 0xc882ff;
export const BOSS_A_SPAWN_AT = 150;
export const BOSS_A_SHOCKWAVE_INTERVAL = 3.0;
export const BOSS_A_SHOCKWAVE_SPEED = 200;

export const BOSS_B_HP = 50;
export const BOSS_B_SIZE = 36;
export const BOSS_B_COLOR = 0xff69b4;
export const BOSS_B_SPAWN_AT = 420;
export const BOSS_B_FIRE_INTERVAL = 0.8;
export const BOSS_B_SUMMON_INTERVAL = 6.0;

// Swarm Queen — final boss
export const QUEEN_SPAWN_AT = 570;
export const QUEEN_HP = 80;
export const QUEEN_SIZE = 50;
export const QUEEN_SPEED = 120;
export const QUEEN_COLOR = 0x1abc9c;
export const QUEEN_SWARM_INTERVAL = 1.5;
export const QUEEN_SWARM_COUNT = 12;
export const QUEEN_PULSE_INTERVAL = 8.0;
export const QUEEN_PULSE_COUNT = 8;
export const QUEEN_PULSE_SPEED = 150;
export const QUEEN_SCRAP_DROP = 60;

// Enemy spawn weights (weighted random selection)
export const ENEMY_SPAWN_WEIGHTS: Record<EnemyTypeName, number> = {
  basic: 30,
  runner: 25,
  swarm: 20,
  tank: 15,
  shooter: 10,
};

// Display
export const BG_COLOR = "#1a1a2e";

// Grid background
export const GRID_TILE_SIZE = 64;
export const GRID_COLOR_A = 0x1a1a2e;
export const GRID_COLOR_B = 0x16162a;

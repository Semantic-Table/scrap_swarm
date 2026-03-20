import type { World } from "../ecs/World";
import type { Inventory } from "../components/Inventory";
import type { ScrapCollector } from "../components/ScrapCollector";
import type { UpgradeChoice } from "./UpgradeManager";
import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { createTransform } from "../components/Transform";
import { createSprite } from "../components/Sprite";
import { createTurretTag } from "../components/Turret";
import { createOrbit } from "../components/Orbit";
import type { TurretTag } from "../components/Turret";
import type { Orbit } from "../components/Orbit";
import { createShield } from "../components/Shield";
import type { Shield } from "../components/Shield";
import type { Entity } from "../ecs/types";
import {
  TURRET_SIZE,
  TURRET_COLOR,
  TURRET_ORBIT_DISTANCE,
  TURRET_ORBIT_SPEED,
  TURRET_SHOOT_COOLDOWN,
} from "../config/constants";

/** Apply an upgrade choice to the world */
export function applyUpgrade(
  choice: UpgradeChoice,
  world: World,
  stage: Container,
): void {
  const players = world.query(["PlayerTag", "Inventory"]);
  if (players.length === 0) return;

  const playerId = players[0];
  const inventory = world.getComponent<Inventory>(playerId, "Inventory")!;

  if (choice.isNew) {
    // Add new item at level 1
    inventory.slots.push({ itemId: choice.itemId, level: 1 });
    applyNewItem(choice.itemId, world, stage, playerId);
  } else {
    // Upgrade existing item
    const slot = inventory.slots.find((s) => s.itemId === choice.itemId);
    if (slot) {
      slot.level++;
      applyItemUpgrade(choice.itemId, slot.level, choice.rarity, world, stage, playerId);
    }
  }
}

function applyNewItem(
  itemId: string,
  world: World,
  stage: Container,
  playerId: Entity,
): void {
  switch (itemId) {
    case "turret": {
      // Spawn 1 base turret + extra from Quantité passive
      const multiLevel = getItemLevel(world, "multi");
      for (let i = 0; i < 1 + multiLevel; i++) {
        spawnTurret(world, stage, playerId);
      }
      break;
    }
    case "tesla":
      // Tesla is handled by TeslaSystem reading inventory
      break;
    case "magnet": {
      const collector = world.getComponent<ScrapCollector>(playerId, "ScrapCollector");
      if (collector) {
        collector.pickupRadius += 30;
      }
      break;
    }
    case "refiner":
      // Handled by ScrapPickupSystem reading inventory
      break;
    case "shield": {
      // Add shield component with 1 charge + extra from Quantité passive
      const multiLvl = getItemLevel(world, "multi");
      world.addComponent(playerId, createShield(1 + multiLvl, 15));
      break;
    }
    case "booster":
      // Handled by InputSystem reading inventory
      break;
    case "multi":
      // Dynamic effects only — read by weapon systems via getQuantityBonus()
      // Turret/shield bonuses are applied when those items are acquired/upgraded
      break;
  }
}

function applyItemUpgrade(
  itemId: string,
  _level: number,
  rarity: string,
  world: World,
  stage: Container,
  playerId: Entity,
): void {
  const mult = rarity === "epic" ? 3 : rarity === "rare" ? 2 : 1;

  switch (itemId) {
    case "turret":
      if (rarity === "epic") {
        // Epic = add a turret
        spawnTurret(world, stage, playerId);
      } else {
        // Reduce cooldown on all turrets
        const turrets = world.query(["TurretTag"]);
        for (const t of turrets) {
          const tag = world.getComponent<TurretTag>(t, "TurretTag")!;
          tag.shootCooldown *= rarity === "rare" ? 0.8 : 0.9;
        }
      }
      break;

    case "tesla":
      // Stats stored in inventory level, read by TeslaSystem
      break;

    case "magnet": {
      const collector = world.getComponent<ScrapCollector>(playerId, "ScrapCollector");
      if (collector) {
        collector.pickupRadius += 20 * mult;
      }
      break;
    }

    case "refiner":
      // Bonus stored in inventory level, read by ScrapPickupSystem
      break;

    case "shield": {
      const shield = world.getComponent<Shield>(playerId, "Shield");
      if (shield) {
        if (rarity === "epic") {
          shield.maxCharges++;
          shield.charges++;
        } else {
          // Reduce recharge cooldown
          shield.rechargeCooldown *= rarity === "rare" ? 0.7 : 0.85;
        }
      }
      break;
    }

    case "booster":
      // Read by InputSystem from inventory
      break;

    case "multi":
      // Dynamic effects only — read by weapon systems via getQuantityBonus()
      break;
  }
}

function spawnTurret(world: World, stage: Container, playerId: Entity): void {
  const entity = world.createEntity();

  const s = TURRET_SIZE;
  const graphic = new Graphics()
    .poly([-s, -s * 0.7, s, 0, -s, s * 0.7])
    .fill(TURRET_COLOR);
  stage.addChild(graphic);

  const turrets = world.query(["TurretTag", "Orbit"]);
  const count = turrets.length;
  const angle = count > 0 ? (Math.PI * 2 / (count + 1)) * count : 0;

  world.addComponent(entity, createTransform(0, 0));
  world.addComponent(entity, createSprite(graphic));
  world.addComponent(entity, createTurretTag(TURRET_SHOOT_COOLDOWN));
  world.addComponent(entity, createOrbit(playerId, angle, TURRET_ORBIT_DISTANCE, TURRET_ORBIT_SPEED));

  // Redistribute all turrets evenly
  const allTurrets = world.query(["TurretTag", "Orbit"]);
  for (let i = 0; i < allTurrets.length; i++) {
    const orbit = world.getComponent<Orbit>(allTurrets[i], "Orbit")!;
    orbit.angle = (Math.PI * 2 / allTurrets.length) * i;
  }
}

/** Read the effective stats from inventory for systems to use */
export function getItemLevel(world: World, itemId: string): number {
  const players = world.query(["PlayerTag", "Inventory"]);
  if (players.length === 0) return 0;

  const inventory = world.getComponent<Inventory>(players[0], "Inventory")!;
  const slot = inventory.slots.find((s) => s.itemId === itemId);
  return slot ? slot.level : 0;
}

/** Get flat bonus damage from Puissance passive */
export function getBonusDamage(world: World): number {
  return getItemLevel(world, "might");
}

/** Get cooldown multiplier from Célérité passive (< 1 = faster) */
export function getCooldownMult(world: World): number {
  const level = getItemLevel(world, "swiftness");
  return Math.max(0.3, 1 - level * 0.10);
}

/** Get range multiplier from Portée passive (> 1 = farther) */
export function getRangeMult(world: World): number {
  const level = getItemLevel(world, "reach");
  return 1 + level * 0.15;
}

/** Get quantity bonus from Quantité passive */
export function getQuantityBonus(world: World): number {
  return getItemLevel(world, "multi");
}

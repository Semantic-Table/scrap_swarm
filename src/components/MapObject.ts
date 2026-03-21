import type { Component } from "../ecs/types";

/** Scrap Cache — big crate with guards */
export interface CacheTag extends Component {
  readonly type: "CacheTag";
}
export function createCacheTag(): CacheTag { return { type: "CacheTag" }; }

/** Power Crate — temporary pickup */
export interface PowerCrateTag extends Component {
  readonly type: "PowerCrateTag";
  crateType: "magnetite" | "overclock" | "repair";
}
export function createPowerCrateTag(crateType: "magnetite" | "overclock" | "repair"): PowerCrateTag {
  return { type: "PowerCrateTag", crateType };
}

/** Boss entity marker */
export interface BossTag extends Component {
  readonly type: "BossTag";
  bossType: "colossus" | "broadcaster" | "queen";
}
export function createBossTag(bossType: "colossus" | "broadcaster" | "queen"): BossTag {
  return { type: "BossTag", bossType };
}

import type { Component } from "../ecs/types";

export interface Shield extends Component {
  readonly type: "Shield";
  charges: number;
  maxCharges: number;
  rechargeCooldown: number; // seconds to recharge 1 charge
  rechargeTimer: number;    // current countdown
}

export function createShield(charges: number, rechargeCooldown: number): Shield {
  return {
    type: "Shield",
    charges,
    maxCharges: charges,
    rechargeCooldown,
    rechargeTimer: 0,
  };
}

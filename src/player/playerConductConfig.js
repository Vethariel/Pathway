import { PLAYER_SPAWN_Z } from "../scene/corridorConfig.js";

/** Must advance at least this far (−Z) from spawn before camp rules relax. */
export const CAMP_FORWARD_METERS = 2.5;

/** Idle near spawn before camp pressure starts (seconds). */
export const CAMP_GRACE_SEC = 3;

/** Holding S / walking +Z before backward pressure starts. */
export const BACKWARD_GRACE_SEC = 0.35;

/** Standing still (no W/S) anywhere on the path. */
export const IDLE_GRACE_SEC = 4;

/** Seconds over grace to reach full pressure. */
export const PENALTY_RAMP_SEC = 7;

/** Max timer / drain multiplier from conduct (0–1 pressure maps here). */
export const MAX_CONDUCT_PRESSURE = 1;

export { PLAYER_SPAWN_Z };

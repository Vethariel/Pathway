import {
  BACKWARD_GRACE_SEC,
  CAMP_FORWARD_METERS,
  CAMP_GRACE_SEC,
  IDLE_GRACE_SEC,
  MAX_CONDUCT_PRESSURE,
  PENALTY_RAMP_SEC,
  PLAYER_SPAWN_Z,
} from "./playerConductConfig.js";

function ramp(time, grace, rampDuration) {
  if (time <= grace) return 0;
  const t = (time - grace) / rampDuration;
  return Math.min(1, Math.max(0, t));
}

/**
 * Tracks camping at spawn, standing still, and walking backward.
 */
export class PlayerConduct {
  constructor() {
    this.pressure = 0;
    this.isCamping = false;
    this.isIdle = false;
    this.isRetreating = false;
    this._campAccum = 0;
    this._idleAccum = 0;
    this._backwardAccum = 0;
  }

  reset() {
    this.pressure = 0;
    this.isCamping = false;
    this.isIdle = false;
    this.isRetreating = false;
    this._campAccum = 0;
    this._idleAccum = 0;
    this._backwardAccum = 0;
  }

  /**
   * @param {number} delta
   * @param {number} playerZ
   * @param {{
   *   movingForward: boolean,
   *   movingBackward: boolean,
   *   illuminatingWolf?: boolean,
   * }} motion
   */
  update(delta, playerZ, { movingForward, movingBackward, illuminatingWolf = false }) {
    const forwardMeters = PLAYER_SPAWN_Z - playerZ;
    const nearSpawn = forwardMeters < CAMP_FORWARD_METERS;
    const isMoving = movingForward || movingBackward;

    this.isCamping = nearSpawn && !movingForward;
    this.isIdle = !isMoving && !illuminatingWolf;
    this.isRetreating = movingBackward;

    if (this.isCamping) {
      this._campAccum += delta;
    } else {
      this._campAccum = Math.max(0, this._campAccum - delta * 2.2);
    }

    if (this.isIdle) {
      this._idleAccum += delta;
    } else {
      this._idleAccum = Math.max(0, this._idleAccum - delta * 2);
    }

    if (movingBackward) {
      this._backwardAccum += delta;
    } else {
      this._backwardAccum = Math.max(0, this._backwardAccum - delta * 1.8);
    }

    const campP = ramp(this._campAccum, CAMP_GRACE_SEC, PENALTY_RAMP_SEC);
    const idleP = ramp(this._idleAccum, IDLE_GRACE_SEC, PENALTY_RAMP_SEC);
    const backP = ramp(this._backwardAccum, BACKWARD_GRACE_SEC, PENALTY_RAMP_SEC);

    this.pressure = Math.min(
      MAX_CONDUCT_PRESSURE,
      Math.max(campP, idleP, backP),
    );

    return this.pressure;
  }

  /** Scales passive survival time gain (1 = normal). */
  get survivalTimeScale() {
    return Math.max(0.12, 1 - this.pressure * 0.88);
  }

  /** Scales wolf stalk / attack / respawn timers (1 = normal). */
  get threatTimeScale() {
    return 1 + this.pressure * 1.85;
  }

  /** Extra flashlight drain multiplier (1 = none). */
  get batteryDrainScale() {
    return 1 + this.pressure * 0.65;
  }
}

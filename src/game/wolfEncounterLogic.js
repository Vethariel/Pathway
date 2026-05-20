import {
  ATTACK_RANGE,
  ATTACK_TIME,
  ILLUMINATION_RANGE,
  ILLUMINATION_TIME,
  LOW_BATTERY_ATTACK_BLEED,
  MALFUNCTION_ATTACK_BLEED,
  PASS_BY_MARGIN,
  STALK_DELAY,
  STALK_CREEP_FLOOR_Z_GAP,
  STALK_CREEP_SPEED_MULT,
  STALK_MIN_Z_GAP,
  STALK_SPEED,
} from "./wolfEncounterConfig.js";

export const ENCOUNTER_STATE = {
  cooldown: "cooldown",
  active: "active",
  retreating: "retreating",
  attacking: "attacking",
};

export const SLOT_STATE = {
  hidden: "hidden",
  active: "active",
  retreating: "retreating",
};

/** Gameplay distance on the ground plane (ignores eye vs feet height). */
export function horizontalDistanceXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function isWithinIlluminationRange(playerPos, wolfPos) {
  return horizontalDistanceXZ(playerPos, wolfPos) <= ILLUMINATION_RANGE;
}

export function isWithinAttackRange(playerPos, wolfPos) {
  return horizontalDistanceXZ(playerPos, wolfPos) <= ATTACK_RANGE;
}

/** Player walked past the wolf down the corridor (-Z) without dealing with it. */
export function hasPlayerPassedWolf(playerPos, wolfPos) {
  return playerPos.z < wolfPos.z - PASS_BY_MARGIN;
}

export function isWolfIlluminated(input) {
  const {
    playerPos,
    wolfPos,
    wolfVisible,
    flashlightOn,
    beamLit,
    inSpotlight,
  } = input;
  if (!wolfVisible || !flashlightOn || !beamLit) return false;
  return (
    isWithinIlluminationRange(playerPos, wolfPos) && inSpotlight
  );
}

/**
 * Next wolf position while stalking along the corridor (Z only; keeps flank X).
 * @returns {{ x: number, z: number } | null} null if already at min Z gap
 */
export function computeStalkPosition(wolfPos, playerPos, delta, params = {}) {
  const minGap = params.stalkMinZGap ?? STALK_MIN_Z_GAP;
  const creepFloor = params.creepFloorZGap ?? STALK_CREEP_FLOOR_Z_GAP;
  const speed = (params.stalkSpeed ?? STALK_SPEED) * (params.stalkSpeedMult ?? 1);
  const zGap = playerPos.z - wolfPos.z;

  if (zGap <= creepFloor) return null;

  let step;
  if (zGap <= minGap) {
    const creepMult = params.creepSpeedMult ?? STALK_CREEP_SPEED_MULT;
    step = Math.min(speed * delta * creepMult, zGap - creepFloor);
  } else {
    step = Math.min(speed * delta, zGap - minGap);
  }

  if (step <= 0.0001) return null;

  return {
    x: wolfPos.x,
    z: wolfPos.z + step,
  };
}

/**
 * One simulation step while the wolf is active (not cooldown / retreat / attack).
 */
export function stepActiveEncounter(timers, input, delta) {
  const events = [];
  let { illuminationTimer, attackTimer, unilluminatedTimer, isStalking } =
    timers;
  const {
    playerPos,
    wolfPos,
    wolfVisible,
    flashlightOn,
    beamLit,
    inSpotlight,
    flashlightLowBattery,
    flashlightMalfunctioning,
    stalkDelay = STALK_DELAY,
    attackTime = ATTACK_TIME,
    illuminationTime = ILLUMINATION_TIME,
  } = input;

  if (!wolfVisible) {
    return {
      illuminationTimer: 0,
      attackTimer: 0,
      unilluminatedTimer: 0,
      isStalking: false,
      events,
    };
  }

  const inAttackRange = isWithinAttackRange(playerPos, wolfPos);
  const illuminated = isWolfIlluminated({
    playerPos,
    wolfPos,
    wolfVisible,
    flashlightOn,
    beamLit,
    inSpotlight,
  });

  if (illuminated) {
    if (flashlightLowBattery || flashlightMalfunctioning) {
      const bleedRate = flashlightMalfunctioning
        ? MALFUNCTION_ATTACK_BLEED
        : LOW_BATTERY_ATTACK_BLEED;
      attackTimer = Math.max(0, attackTimer - delta * bleedRate);
    } else {
      attackTimer = 0;
    }
    unilluminatedTimer = 0;
    isStalking = false;
    illuminationTimer += delta;
    if (illuminationTimer >= illuminationTime) {
      events.push("retreat");
      illuminationTimer = 0;
    }
  } else {
    illuminationTimer = 0;
    unilluminatedTimer += delta;
    isStalking = unilluminatedTimer >= stalkDelay;

    if (inAttackRange) {
      attackTimer += delta;
      if (attackTimer >= attackTime) {
        events.push("attack");
        attackTimer = 0;
      }
    } else {
      attackTimer = 0;
    }
  }

  return {
    illuminationTimer,
    attackTimer,
    unilluminatedTimer,
    isStalking,
    events,
  };
}

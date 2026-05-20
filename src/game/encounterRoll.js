import {
  ATTACK_TIME,
  ATTACK_TIME_MAX,
  ATTACK_TIME_MIN,
  ILLUMINATION_TIME,
  ILLUMINATION_TIME_MAX,
  ILLUMINATION_TIME_MIN,
  RETREAT_COOLDOWN_MAX,
  RETREAT_COOLDOWN_MIN,
  SPAWN_AHEAD_MAX,
  SPAWN_AHEAD_MIN,
  SPAWN_CLOSE_AHEAD_MAX,
  SPAWN_CLOSE_AHEAD_MIN,
  SPAWN_CLOSE_CHANCE,
  STALK_DELAY,
  STALK_DELAY_MAX,
  STALK_DELAY_MIN,
} from "./wolfEncounterConfig.js";
import { getThreatEscalation } from "./threatEscalation.js";

function rollRange(min, max) {
  return min + Math.random() * (max - min);
}

function rollIlluminationTime() {
  return rollRange(ILLUMINATION_TIME_MIN, ILLUMINATION_TIME_MAX);
}

/**
 * Per-encounter timings and spawn hints (scaled by survival time).
 * @param {number} survivalTime
 * @param {number | null} lastSpawnSide -1 or 1
 */
export function rollEncounterParams(survivalTime, lastSpawnSide = null) {
  const esc = getThreatEscalation(survivalTime);

  const stalkDelay = rollRange(STALK_DELAY_MIN, STALK_DELAY_MAX) * esc.stalkDelayMult;
  const attackTime = rollRange(ATTACK_TIME_MIN, ATTACK_TIME_MAX) * esc.attackTimeMult;
  const retreatCooldown =
    rollRange(RETREAT_COOLDOWN_MIN, RETREAT_COOLDOWN_MAX) * esc.retreatCooldownMult;

  const useCloseSpawn = Math.random() < SPAWN_CLOSE_CHANCE;
  const aheadMin = useCloseSpawn ? SPAWN_CLOSE_AHEAD_MIN : SPAWN_AHEAD_MIN;
  const aheadMax = useCloseSpawn ? SPAWN_CLOSE_AHEAD_MAX : SPAWN_AHEAD_MAX;

  const isPartnerEncounter = Math.random() < esc.partnerChance;

  let side;
  if (!isPartnerEncounter && lastSpawnSide != null && Math.random() < 0.42) {
    side = lastSpawnSide;
  } else {
    side = Math.random() < 0.5 ? -1 : 1;
  }

  const heardSide = Math.random() < 0.5 ? -1 : 1;

  return {
    stalkDelay: Math.max(1.2, stalkDelay),
    attackTime: Math.max(3, attackTime),
    retreatCooldown: Math.max(4, retreatCooldown),
    spawnAheadMin: aheadMin,
    spawnAheadMax: aheadMax,
    stalkSpeedMult: esc.stalkSpeedMult,
    side,
    isPartnerEncounter,
    heardSide,
    illuminationTime: rollIlluminationTime(),
    partnerIlluminationTime: rollIlluminationTime(),
    silentSpawn: Math.random() < 0.42,
    doubleTension: Math.random() < 0.22,
    passByReappearChance: 0.16,
    baseStalkDelay: STALK_DELAY,
    baseAttackTime: ATTACK_TIME,
    baseIlluminationTime: ILLUMINATION_TIME,
  };
}

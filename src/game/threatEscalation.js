import {
  PARTNER_CHANCE_BASE,
  PARTNER_CHANCE_MAX,
} from "./wolfEncounterConfig.js";

/**
 * Survival-time pressure: tighter timers and faster drain the longer you live.
 */
export function getThreatEscalation(survivalTime) {
  const after30 = smoothstep(survivalTime, 30, 55);
  const after45 = smoothstep(survivalTime, 45, 75);
  const after60 = smoothstep(survivalTime, 60, 90);

  return {
    stalkDelayMult: 1 - after30 * 0.38,
    attackTimeMult: 1 - after30 * 0.28 - after60 * 0.18,
    retreatCooldownMult: 1 - after60 * 0.4,
    batteryDrainMult: 1 + after45 * 0.5,
    stalkSpeedMult: 1 + after30 * 0.12 + after60 * 0.1,
    partnerChance:
      PARTNER_CHANCE_BASE +
      after60 * (PARTNER_CHANCE_MAX - PARTNER_CHANCE_BASE),
  };
}

function smoothstep(t, start, end) {
  if (t <= start) return 0;
  if (t >= end) return 1;
  const x = (t - start) / (end - start);
  return x * x * (3 - 2 * x);
}

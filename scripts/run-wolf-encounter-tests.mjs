import * as THREE from "three";
import {
  ATTACK_RANGE,
  ATTACK_TIME,
  ILLUMINATION_RANGE,
  ILLUMINATION_TIME,
} from "../src/game/wolfEncounterConfig.js";
import {
  PASS_BY_MARGIN,
  STALK_DELAY,
  STALK_CREEP_FLOOR_Z_GAP,
  STALK_MIN_Z_GAP,
  STALK_SPEED,
} from "../src/game/wolfEncounterConfig.js";
import {
  computeStalkPosition,
  hasPlayerPassedWolf,
  horizontalDistanceXZ,
  isWithinAttackRange,
  isWithinIlluminationRange,
  stepActiveEncounter,
} from "../src/game/wolfEncounterLogic.js";
import { isPointInSpotlight } from "../src/utils/spotlightHit.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`expected ${expected}, got ${actual}`);
      }
    },
    toBeCloseTo(expected, digits = 2) {
      if (Math.abs(actual - expected) > 10 ** -digits) {
        throw new Error(`expected ~${expected}, got ${actual}`);
      }
    },
  };
}

function vec(x, y, z) {
  return { x, y, z };
}

console.log("Wolf encounter tests\n");

test("horizontal distance ignores Y (eye height vs ground)", () => {
  const player = vec(0, 1.7, 0);
  const wolf = vec(5, -2.5, -6);
  const xz = horizontalDistanceXZ(player, wolf);
  const dist3d = Math.hypot(5, 1.7 - -2.5, 6);
  expect(xz).toBeCloseTo(7.81, 1);
  expect(isWithinIlluminationRange(player, wolf)).toBe(false);
  expect(xz <= ILLUMINATION_RANGE).toBe(false);
  if (dist3d <= ILLUMINATION_RANGE) {
    throw new Error("3D distance must not be used for range checks");
  }
});

test("within illumination range on XZ at 6m apart", () => {
  const player = vec(0, 1.7, 0);
  const wolf = vec(0, -2, -6);
  expect(horizontalDistanceXZ(player, wolf)).toBeCloseTo(6, 0);
  expect(isWithinIlluminationRange(player, wolf)).toBe(true);
});

test("within attack range on XZ at 8m apart", () => {
  const player = vec(0, 1.7, 0);
  const wolf = vec(0, -2, -8);
  expect(isWithinAttackRange(player, wolf)).toBe(true);
});

test("3s without illumination starts stalking", () => {
  let timers = {
    illuminationTimer: 0,
    attackTimer: 0,
    unilluminatedTimer: 0,
    isStalking: false,
  };
  const stalkDelay = 3;
  const input = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(5, -2, -10),
    wolfVisible: true,
    flashlightOn: false,
    beamLit: false,
    inSpotlight: false,
    stalkDelay,
  };

  for (let i = 0; i < 160; i++) {
    timers = stepActiveEncounter(timers, input, 0.02);
  }

  expect(timers.isStalking).toBe(true);
  if (timers.unilluminatedTimer < stalkDelay) {
    throw new Error(
      `expected unilluminated timer >= ${STALK_DELAY}, got ${timers.unilluminatedTimer}`,
    );
  }
});

test("illuminating wolf stops stalking timer", () => {
  let timers = {
    illuminationTimer: 0,
    attackTimer: 0,
    unilluminatedTimer: STALK_DELAY,
    isStalking: true,
  };
  const lit = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(4, -2, -4),
    wolfVisible: true,
    flashlightOn: true,
    beamLit: true,
    inSpotlight: true,
  };

  timers = stepActiveEncounter(timers, lit, 0.02);
  expect(timers.isStalking).toBe(false);
  expect(timers.unilluminatedTimer).toBe(0);
});

test("stalk moves wolf along corridor Z only", () => {
  const wolf = vec(5, 0, -10);
  const player = vec(0, 0, 0);
  const zGapBefore = player.z - wolf.z;
  const next = computeStalkPosition(wolf, player, 1);
  if (next.x !== wolf.x) {
    throw new Error(`expected X unchanged at ${wolf.x}, got ${next.x}`);
  }
  if (!(next.z > wolf.z)) {
    throw new Error(`expected wolf to advance +Z along path, ${wolf.z} -> ${next.z}`);
  }
  const zGapAfter = player.z - next.z;
  if (!(zGapAfter < zGapBefore)) {
    throw new Error(`expected Z gap to shrink, ${zGapBefore} -> ${zGapAfter}`);
  }
});

test("stalk creeps slowly inside min Z gap", () => {
  const wolf = vec(5, 0, -STALK_MIN_Z_GAP);
  const player = vec(0, 0, 0);
  const next = computeStalkPosition(wolf, player, 1);
  if (!next) {
    throw new Error("expected slow creep inside min gap, got null");
  }
  const fullStep = computeStalkPosition(vec(5, 0, -12), player, 1);
  const creepDelta = next.z - wolf.z;
  const fullDelta = fullStep.z - -12;
  if (!(creepDelta < fullDelta)) {
    throw new Error(
      `creep step ${creepDelta} should be smaller than full stalk ${fullDelta}`,
    );
  }
});

test("stalk stops at creep floor Z gap", () => {
  const wolf = vec(5, 0, -STALK_CREEP_FLOOR_Z_GAP);
  const player = vec(0, 0, 0);
  expect(computeStalkPosition(wolf, player, 1)).toBe(null);
});

test("illumination for 1s triggers retreat", () => {
  let timers = {
    illuminationTimer: 0,
    attackTimer: 0,
    unilluminatedTimer: 0,
    isStalking: false,
  };
  const input = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(4, -2, -4),
    wolfVisible: true,
    flashlightOn: true,
    beamLit: true,
    inSpotlight: true,
    illuminationTime: 0.7,
  };

  let events = [];
  for (let i = 0; i < 55; i++) {
    const step = stepActiveEncounter(timers, input, 0.02);
    timers = step;
    events = events.concat(step.events);
  }

  expect(events.includes("retreat")).toBe(true);
});

test("longer illumination time needs more beam duration", () => {
  let timers = {
    illuminationTimer: 0,
    attackTimer: 0,
    unilluminatedTimer: 0,
    isStalking: false,
  };
  const input = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(4, -2, -4),
    wolfVisible: true,
    flashlightOn: true,
    beamLit: true,
    inSpotlight: true,
    illuminationTime: 2.5,
  };

  let events = [];
  for (let i = 0; i < 100; i++) {
    const step = stepActiveEncounter(timers, input, 0.02);
    timers = step;
    events = events.concat(step.events);
  }

  expect(events.includes("retreat")).toBe(false);

  for (let i = 0; i < 30; i++) {
    const step = stepActiveEncounter(timers, input, 0.02);
    timers = step;
    events = events.concat(step.events);
  }

  expect(events.includes("retreat")).toBe(true);
});

test("5s in attack range without light triggers attack", () => {
  let timers = {
    illuminationTimer: 0,
    attackTimer: 0,
    unilluminatedTimer: 0,
    isStalking: false,
  };
  const input = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(4, -2, -4),
    wolfVisible: true,
    flashlightOn: false,
    beamLit: false,
    inSpotlight: false,
    attackTime: 5,
  };

  let events = [];
  for (let i = 0; i < 260; i++) {
    const step = stepActiveEncounter(timers, input, 0.02);
    timers = step;
    events = events.concat(step.events);
  }

  expect(events.includes("attack")).toBe(true);
});

test("light on wolf resets attack timer", () => {
  let timers = {
    illuminationTimer: 0,
    attackTimer: 3,
    unilluminatedTimer: 0,
    isStalking: false,
  };
  const near = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(4, -2, -4),
    wolfVisible: true,
    flashlightOn: true,
    beamLit: true,
    inSpotlight: true,
  };

  const step = stepActiveEncounter(timers, near, 0.1);
  expect(step.attackTimer).toBe(0);
});

test("malfunctioning beam on wolf only bleeds attack timer", () => {
  let timers = {
    illuminationTimer: 0,
    attackTimer: 4,
    unilluminatedTimer: 0,
    isStalking: false,
  };
  const input = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(4, -2, -4),
    wolfVisible: true,
    flashlightOn: true,
    beamLit: true,
    inSpotlight: true,
    flashlightLowBattery: false,
    flashlightMalfunctioning: true,
  };

  const step = stepActiveEncounter(timers, input, 0.1);
  if (step.attackTimer >= 4) {
    throw new Error(
      `expected attack timer to decrease while malfunctioning, got ${step.attackTimer}`,
    );
  }
  if (step.attackTimer <= 0) {
    throw new Error("expected partial bleed, not full reset");
  }
});

test("low battery beam on wolf only bleeds attack timer", () => {
  let timers = {
    illuminationTimer: 0,
    attackTimer: 4,
    unilluminatedTimer: 0,
    isStalking: false,
  };
  const input = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(4, -2, -4),
    wolfVisible: true,
    flashlightOn: true,
    beamLit: true,
    inSpotlight: true,
    flashlightLowBattery: true,
    flashlightMalfunctioning: false,
  };

  const step = stepActiveEncounter(timers, input, 0.1);
  if (step.attackTimer >= 4) {
    throw new Error(
      `expected attack timer to decrease while low battery, got ${step.attackTimer}`,
    );
  }
  if (step.attackTimer <= 0) {
    throw new Error("expected partial bleed, not full reset");
  }
});

test("switch on but beam out does not illuminate wolf", () => {
  const input = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(4, -2, -4),
    wolfVisible: true,
    flashlightOn: true,
    beamLit: false,
    inSpotlight: false,
  };
  const timers = stepActiveEncounter(
    {
      illuminationTimer: 0,
      attackTimer: 0,
      unilluminatedTimer: 0,
      isStalking: false,
    },
    input,
    0.02,
  );
  expect(timers.illuminationTimer).toBe(0);
});

test("spotlight hits point in front of camera", () => {
  const camera = new THREE.PerspectiveCamera();
  const light = new THREE.SpotLight(0xffffff, 18, 28, Math.PI / 7, 0.35, 1.2);
  const rig = new THREE.Group();
  rig.add(camera);
  rig.add(light);
  light.position.set(0, 0, 0);
  light.target.position.set(0, 0, -1);
  rig.add(light.target);

  camera.position.set(0, 1.7, 0);
  const target = new THREE.Vector3(0, 1.5, -5);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  rig.updateMatrixWorld(true);

  expect(isPointInSpotlight(target, light, camera)).toBe(true);
});

test("spotlight misses point behind camera", () => {
  const camera = new THREE.PerspectiveCamera();
  const light = new THREE.SpotLight(0xffffff, 18, 28, Math.PI / 7, 0.35, 1.2);
  const rig = new THREE.Group();
  rig.add(camera);
  rig.add(light);
  light.target.position.set(0, 0, -1);
  rig.add(light.target);

  camera.position.set(0, 1.7, 0);
  camera.lookAt(0, 1.7, -5);
  camera.updateMatrixWorld(true);
  rig.updateMatrixWorld(true);

  const behind = new THREE.Vector3(0, 1.7, 3);
  expect(isPointInSpotlight(behind, light, camera)).toBe(false);
});

test("player passed wolf when further down -Z corridor", () => {
  const player = vec(0, 1.7, -12);
  const wolf = vec(5, -2, -10);
  expect(hasPlayerPassedWolf(player, wolf)).toBe(true);
});

test("player has not passed wolf when still approaching", () => {
  const player = vec(0, 1.7, -8);
  const wolf = vec(5, -2, -12);
  expect(hasPlayerPassedWolf(player, wolf)).toBe(false);
});

test("pass-by needs clear margin past wolf Z", () => {
  const player = vec(0, 1.7, -10.3);
  const wolf = vec(5, -2, -10);
  expect(hasPlayerPassedWolf(player, wolf)).toBe(false);
  const playerPast = vec(0, 1.7, -10 - PASS_BY_MARGIN - 0.1);
  expect(hasPlayerPassedWolf(playerPast, wolf)).toBe(true);
});

test("attack timer runs with flashlight on but not aimed at wolf", () => {
  let timers = {
    illuminationTimer: 0,
    attackTimer: 0,
    unilluminatedTimer: 0,
    isStalking: false,
  };
  const input = {
    playerPos: vec(0, 1.7, 0),
    wolfPos: vec(4, -2, -4),
    wolfVisible: true,
    flashlightOn: true,
    beamLit: true,
    inSpotlight: false,
    attackTime: 5,
  };

  let events = [];
  for (let i = 0; i < 260; i++) {
    const step = stepActiveEncounter(timers, input, 0.02);
    timers = step;
    events = events.concat(step.events);
  }

  expect(events.includes("attack")).toBe(true);
});

test("stalk speed mult advances wolf faster", () => {
  const wolf = vec(5, 0, -12);
  const player = vec(0, 0, 0);
  const slow = computeStalkPosition(wolf, player, 1, { stalkSpeedMult: 1 });
  const fast = computeStalkPosition(wolf, player, 1, { stalkSpeedMult: 1.75 });
  if (!(fast.z > slow.z)) {
    throw new Error(`expected faster stalk, slow z=${slow.z} fast z=${fast.z}`);
  }
});

test("config ranges are consistent", () => {
  if (ILLUMINATION_RANGE >= ATTACK_RANGE) {
    throw new Error("illumination range should be smaller than attack range");
  }
  if (ILLUMINATION_TIME >= ATTACK_TIME) {
    throw new Error("default illumination should be shorter than attack window");
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

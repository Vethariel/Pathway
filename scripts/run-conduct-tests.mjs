import { PLAYER_SPAWN_Z } from "../src/scene/corridorConfig.js";
import {
  BACKWARD_GRACE_SEC,
  CAMP_GRACE_SEC,
  IDLE_GRACE_SEC,
} from "../src/player/playerConductConfig.js";
import { PlayerConduct } from "../src/player/PlayerConduct.js";

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

console.log("Player conduct tests\n");

test("no pressure when advancing from spawn", () => {
  const c = new PlayerConduct();
  for (let i = 0; i < 120; i++) {
    c.update(0.05, PLAYER_SPAWN_Z - 8, {
      movingForward: true,
      movingBackward: false,
    });
  }
  if (c.pressure > 0.05) {
    throw new Error(`expected low pressure, got ${c.pressure}`);
  }
});

test("pressure builds when idle near spawn", () => {
  const c = new PlayerConduct();
  const steps = Math.ceil((CAMP_GRACE_SEC + 5) / 0.05);
  for (let i = 0; i < steps; i++) {
    c.update(0.05, PLAYER_SPAWN_Z, {
      movingForward: false,
      movingBackward: false,
    });
  }
  if (c.pressure < 0.5) {
    throw new Error(`expected camp pressure, got ${c.pressure}`);
  }
});

test("pressure builds when standing still far from spawn", () => {
  const c = new PlayerConduct();
  const steps = Math.ceil((IDLE_GRACE_SEC + 5) / 0.05);
  for (let i = 0; i < steps; i++) {
    c.update(0.05, PLAYER_SPAWN_Z - 20, {
      movingForward: false,
      movingBackward: false,
    });
  }
  if (c.pressure < 0.5) {
    throw new Error(`expected idle pressure, got ${c.pressure}`);
  }
  if (!c.isIdle) {
    throw new Error("expected isIdle flag");
  }
});

test("pressure builds when walking backward", () => {
  const c = new PlayerConduct();
  const steps = Math.ceil((BACKWARD_GRACE_SEC + 5) / 0.05);
  for (let i = 0; i < steps; i++) {
    c.update(0.05, PLAYER_SPAWN_Z - 12, {
      movingForward: false,
      movingBackward: true,
    });
  }
  if (c.pressure < 0.5) {
    throw new Error(`expected backward pressure, got ${c.pressure}`);
  }
});

test("idle does not build while illuminating wolf in range", () => {
  const c = new PlayerConduct();
  const steps = Math.ceil((IDLE_GRACE_SEC + 5) / 0.05);
  for (let i = 0; i < steps; i++) {
    c.update(0.05, PLAYER_SPAWN_Z - 20, {
      movingForward: false,
      movingBackward: false,
      illuminatingWolf: true,
    });
  }
  if (c.pressure > 0.05) {
    throw new Error(`expected no idle pressure while lit, got ${c.pressure}`);
  }
  if (c.isIdle) {
    throw new Error("expected isIdle false while illuminating");
  }
});

test("survival time scale drops under pressure", () => {
  const c = new PlayerConduct();
  for (let i = 0; i < 200; i++) {
    c.update(0.05, PLAYER_SPAWN_Z, {
      movingForward: false,
      movingBackward: false,
    });
  }
  if (c.survivalTimeScale >= 0.5) {
    throw new Error(`expected slower scoring, got ${c.survivalTimeScale}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

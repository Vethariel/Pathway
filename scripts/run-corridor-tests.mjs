import {
  CHUNK_LENGTH,
  CHUNKS_RADIUS,
  CORRIDOR_HALF_WIDTH,
  TREE_CLEARANCE,
} from "../src/scene/corridorConfig.js";
import {
  getActiveChunkRange,
  getChunkIndex,
  isInsideCorridor,
  shouldSkipTreePlacement,
} from "../src/scene/corridorLogic.js";

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
      if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) throw new Error(`expected ${actual} > ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) throw new Error(`expected ${actual} <= ${expected}`);
    },
  };
}

console.log("Corridor logic tests\n");

test("chunk index", () => {
  expect(getChunkIndex(0)).toBe(0);
  expect(getChunkIndex(-31)).toBe(-2);
});

test("symmetric chunk radius", () => {
  const { min, max } = getActiveChunkRange(0);
  expect(min).toBe(-CHUNKS_RADIUS);
  expect(max).toBe(CHUNKS_RADIUS);
});

test("corridor width", () => {
  expect(isInsideCorridor(0)).toBe(true);
  expect(isInsideCorridor(1.3)).toBe(true);
  expect(isInsideCorridor(1.5)).toBe(false);
});

test("trees kept well outside path (canopy clearance)", () => {
  expect(shouldSkipTreePlacement(3, -50, 0)).toBe(true);
  expect(shouldSkipTreePlacement(4.5, -50, 0)).toBe(false);
  expect(TREE_CLEARANCE).toBeGreaterThan(CORRIDOR_HALF_WIDTH);
});

test("ahead spawn clear only in -Z", () => {
  expect(shouldSkipTreePlacement(5, -10, 0)).toBe(true);
  expect(shouldSkipTreePlacement(5, -30, 0)).toBe(false);
  expect(shouldSkipTreePlacement(5, 20, 0)).toBe(false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

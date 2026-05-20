import {
  CHUNK_LENGTH,
  CHUNKS_RADIUS,
  CORRIDOR_HALF_WIDTH,
  TREE_CLEARANCE,
  TREE_SPAWN_AHEAD,
  TREE_SPAWN_BEHIND,
} from "./corridorConfig.js";

export function getChunkIndex(z) {
  return Math.floor(z / CHUNK_LENGTH);
}

export function getActiveChunkRange(centerChunk) {
  return {
    min: centerChunk - CHUNKS_RADIUS,
    max: centerChunk + CHUNKS_RADIUS,
  };
}

export function getChunkZBounds(index) {
  const zStart = index * CHUNK_LENGTH;
  return { zStart, zEnd: zStart + CHUNK_LENGTH, zCenter: zStart + CHUNK_LENGTH * 0.5 };
}

export function isInsideCorridor(x, halfWidth = CORRIDOR_HALF_WIDTH) {
  return Math.abs(x) < halfWidth;
}

export function shouldSkipTreePlacement(x, z, playerZ) {
  if (Math.abs(x) < TREE_CLEARANCE) return true;

  const dz = z - playerZ;

  if (dz < 0 && -dz < TREE_SPAWN_AHEAD) return true;
  if (dz > 0 && dz < TREE_SPAWN_BEHIND) return true;

  return false;
}

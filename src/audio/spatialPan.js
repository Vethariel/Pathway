/**
 * Stereo pan (-1 left … 1 right) from world positions and player yaw (Y rotation).
 * @param {{ x: number, z: number }} sourceWorld
 * @param {{ x: number, z: number }} listenerWorld
 * @param {number} listenerYaw
 */
export function stereoPanFromWorld(sourceWorld, listenerWorld, listenerYaw) {
  const dx = sourceWorld.x - listenerWorld.x;
  const dz = sourceWorld.z - listenerWorld.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.05) return 0;

  const rightX = Math.cos(listenerYaw);
  const rightZ = -Math.sin(listenerYaw);
  const side = (dx * rightX + dz * rightZ) / dist;

  return Math.max(-1, Math.min(1, side * 1.25));
}

/** Random pan for off-screen / unknown threat. */
export function randomThreatPan() {
  return Math.random() < 0.5 ? -0.65 - Math.random() * 0.3 : 0.65 + Math.random() * 0.3;
}

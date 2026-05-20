import * as THREE from "three";

const _lightPos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _toPoint = new THREE.Vector3();

/**
 * Whether a world-space point is inside the flashlight cone (when intensity > 0).
 * Uses the camera forward axis so aim matches what the player sees.
 */
export function isPointInSpotlight(point, spotlight, camera) {
  if (spotlight.intensity <= 0) return false;

  spotlight.getWorldPosition(_lightPos);
  camera.getWorldDirection(_dir);

  _toPoint.subVectors(point, _lightPos);
  const dist = _toPoint.length();
  if (dist > spotlight.distance || dist < 0.05) return false;

  _toPoint.divideScalar(dist);
  const angle = _toPoint.angleTo(_dir);
  return angle <= spotlight.angle;
}

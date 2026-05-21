import * as THREE from "three";
import { FOG_COLOR, FOG_DENSITY } from "./fogConfig.js";
import {
  applyManualFogToObject,
  removeManualFogFromObject,
  setManualFogParams,
} from "./manualFogShader.js";

/** @typedef {'none' | 'builtin' | 'manual'} FogMode */

/**
 * @param {THREE.Material} material
 * @param {boolean} enabled
 */
function setMaterialFog(material, enabled) {
  if (!material?.isMaterial || material.fog === enabled) return;
  material.fog = enabled;
  material.needsUpdate = true;
}

/**
 * @param {THREE.Object3D} root
 * @param {boolean} enabled
 */
function setFogOnMaterials(root, enabled) {
  root.traverse((node) => {
    if (!node.isMesh) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    for (const material of materials) {
      setMaterialFog(material, enabled);
    }
  });
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {FogMode} [mode='manual']
 */
export function applySceneFog(scene, renderer, mode = "manual") {
  scene.fog = null;

  if (mode === "builtin") {
    const color = new THREE.Color(FOG_COLOR);
    scene.fog = new THREE.FogExp2(color.getHex(), FOG_DENSITY);
    scene.background = color.clone();
    renderer.setClearColor(color);
    return;
  }

  if (mode === "none") {
    const sky = new THREE.Color(FOG_COLOR);
    scene.background = sky.clone();
    renderer.setClearColor(sky);
    return;
  }

  if (mode === "manual") {
    const sky = new THREE.Color(FOG_COLOR);
    setManualFogParams(FOG_COLOR, FOG_DENSITY, renderer);
    scene.background = sky.clone();
    renderer.setClearColor(sky);
  }
}

/**
 * @param {THREE.Object3D} root
 */
export function disableFogOnMaterials(root) {
  setFogOnMaterials(root, false);
}

/**
 * @param {THREE.Object3D} root
 */
export function invalidateMaterialPrograms(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    for (const material of materials) {
      if (material?.isMaterial) {
        material.needsUpdate = true;
      }
    }
  });
}

/**
 * Manual exp2 distance fog on listed roots (game + fog test).
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Object3D[]} fogRoots
 * @returns {number} materials patched
 */
export function applyManualFogEnvironment(scene, renderer, fogRoots) {
  applySceneFog(scene, renderer, "manual");

  let patched = 0;
  for (const root of fogRoots) {
    disableFogOnMaterials(root);
    patched += applyManualFogToObject(root);
    invalidateMaterialPrograms(root);
  }
  return patched;
}

/**
 * Fog-test baseline: no fog (A/B comparison).
 */
export function applyFogTestBaseline(scene, renderer, fogRoots) {
  removeManualFogFromObject(scene);
  applySceneFog(scene, renderer, "none");
  for (const root of fogRoots) {
    disableFogOnMaterials(root);
    invalidateMaterialPrograms(root);
  }
}

/**
 * Fog test — same manual fog as the game.
 */
export function applyFogTestManual(scene, renderer, fogRoots) {
  removeManualFogFromObject(scene);
  return applyManualFogEnvironment(scene, renderer, fogRoots);
}

/**
 * Game fog: manual shader (replaces THREE.FogExp2).
 */
export function applyGameFog(scene, renderer, fogRoots) {
  removeManualFogFromObject(scene);
  applyManualFogEnvironment(scene, renderer, fogRoots);
}

/** @deprecated Use applySceneFog(scene, renderer, 'manual') */
export function applyEnvironmentFog(scene, renderer) {
  applySceneFog(scene, renderer, "manual");
}

export { applyManualFogToObject } from "./manualFogShader.js";

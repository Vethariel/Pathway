import * as THREE from "three";
import { FOG_COLOR, FOG_DENSITY } from "./fogConfig.js";

/**
 * Scene-wide exponential fog + matching background / clear color.
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 */
export function applyEnvironmentFog(scene, renderer) {
  const color = new THREE.Color(FOG_COLOR);

  scene.fog = new THREE.FogExp2(color.getHex(), FOG_DENSITY);
  scene.background = color.clone();
  renderer.setClearColor(color);
}

/**
 * Ensure loaded meshes participate in scene fog (MeshStandardMaterial default is on).
 * @param {THREE.Object3D} root
 */
export function enableFogOnMaterials(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    for (const material of materials) {
      if (material?.isMaterial) {
        material.fog = true;
      }
    }
  });
}

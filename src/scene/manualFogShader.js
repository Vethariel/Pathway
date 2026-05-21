import * as THREE from "three";
import { SRGBColorSpace } from "three";
import { FOG_COLOR, FOG_DENSITY } from "./fogConfig.js";

/** Shared uniforms — same refs on every patched material. */
export const manualFogUniforms = {
  uManualFogColor: { value: new THREE.Color() },
  uManualFogDensity: { value: FOG_DENSITY },
};

const _fogColorScratch = new THREE.Color();

const FOG_MARKER = "MANUAL_DISTANCE_FOG";
const PATCHED_KEY = "manualFogPatched";

const INCLUDE_COMMON = /#include <common>/;
const INCLUDE_PROJECT_VERTEX = /#include <project_vertex>/;
const INCLUDE_FOG_FRAGMENT = /#include <fog_fragment>/;

const MANUAL_FOG_PARS_VERTEX = /* glsl */`
varying vec3 vManualFogViewPosition;
`;

const MANUAL_FOG_VERTEX = /* glsl */`
vManualFogViewPosition = mvPosition.xyz;
`;

const MANUAL_FOG_PARS_FRAGMENT = /* glsl */`
uniform vec3 uManualFogColor;
uniform float uManualFogDensity;
`;

const MANUAL_FOG_PARS_FRAGMENT_BASIC = /* glsl */`
uniform vec3 uManualFogColor;
uniform float uManualFogDensity;
varying vec3 vManualFogViewPosition;
`;

const MANUAL_FOG_APPLY = /* glsl */`
// MANUAL_DISTANCE_FOG
{
	float fogDistance = length( vFogViewPos );
	float fogAmount = 1.0 - exp2(
		-uManualFogDensity * uManualFogDensity * fogDistance * fogDistance * 1.442695
	);
	fogAmount = clamp( fogAmount, 0.0, 1.0 );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, uManualFogColor, fogAmount );
}
`;

const MANUAL_FOG_APPLY_PHYSICAL = MANUAL_FOG_APPLY.replace(
  "vFogViewPos",
  "vViewPosition",
);
const MANUAL_FOG_APPLY_BASIC = MANUAL_FOG_APPLY.replace(
  "vFogViewPos",
  "vManualFogViewPosition",
);

/**
 * Only lit surface materials use the shader graph with fog_fragment.
 * @param {THREE.Material} material
 */
export function supportsManualFog(material) {
  return (
    material?.isMeshStandardMaterial === true ||
    material?.isMeshPhysicalMaterial === true ||
    material?.isMeshBasicMaterial === true ||
    material?.isMeshLambertMaterial === true ||
    material?.isMeshPhongMaterial === true
  );
}

function injectManualFogShader(shader) {
  if (shader.fragmentShader.includes(FOG_MARKER)) {
    return false;
  }

  if (!INCLUDE_FOG_FRAGMENT.test(shader.fragmentShader)) {
    return false;
  }

  shader.uniforms.uManualFogColor = manualFogUniforms.uManualFogColor;
  shader.uniforms.uManualFogDensity = manualFogUniforms.uManualFogDensity;

  const usesViewPosition = shader.vertexShader.includes("vViewPosition");

  if (usesViewPosition) {
    shader.fragmentShader = shader.fragmentShader.replace(
      INCLUDE_COMMON,
      `#include <common>\n${MANUAL_FOG_PARS_FRAGMENT}`,
    );
  } else {
    shader.vertexShader = shader.vertexShader.replace(
      INCLUDE_COMMON,
      `#include <common>\n${MANUAL_FOG_PARS_VERTEX}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      INCLUDE_PROJECT_VERTEX,
      `#include <project_vertex>\n${MANUAL_FOG_VERTEX}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      INCLUDE_COMMON,
      `#include <common>\n${MANUAL_FOG_PARS_FRAGMENT_BASIC}`,
    );
  }

  const fogSnippet = usesViewPosition
    ? MANUAL_FOG_APPLY_PHYSICAL
    : MANUAL_FOG_APPLY_BASIC;

  shader.fragmentShader = shader.fragmentShader.replace(
    INCLUDE_FOG_FRAGMENT,
    fogSnippet,
  );
  return true;
}

/**
 * @param {THREE.Material} material
 * @returns {boolean}
 */
export function applyManualFogToMaterial(material) {
  if (!supportsManualFog(material) || material[PATCHED_KEY]) {
    return false;
  }

  material.fog = false;

  if (!material.userData.manualFogRestore) {
    material.userData.manualFogRestore = {
      onBeforeCompile: material.onBeforeCompile,
      customProgramCacheKey: material.customProgramCacheKey,
    };
  }

  const previousOnBeforeCompile =
    material.userData.manualFogRestore.onBeforeCompile?.bind(material);
  const previousCacheKey =
    material.userData.manualFogRestore.customProgramCacheKey?.bind(material);

  material.customProgramCacheKey = () => {
    const base = previousCacheKey ? previousCacheKey() : material.type;
    return `${base}_manualFog_v6`;
  };

  material.onBeforeCompile = (shader) => {
    previousOnBeforeCompile?.(shader);
    injectManualFogShader(shader);
  };

  material[PATCHED_KEY] = true;
  material.needsUpdate = true;
  return true;
}

/**
 * @param {THREE.Material} material
 */
export function removeManualFogFromMaterial(material) {
  if (!material?.isMaterial || !material[PATCHED_KEY]) return;

  const restore = material.userData.manualFogRestore;
  if (restore) {
    material.onBeforeCompile = restore.onBeforeCompile;
    material.customProgramCacheKey = restore.customProgramCacheKey;
    delete material.userData.manualFogRestore;
  } else {
    delete material.onBeforeCompile;
    delete material.customProgramCacheKey;
  }

  delete material[PATCHED_KEY];
  material.fog = false;
  material.needsUpdate = true;
}

/**
 * @param {THREE.Object3D} root
 * @returns {number}
 */
export function applyManualFogToObject(root) {
  let count = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    for (const material of materials) {
      if (applyManualFogToMaterial(material)) {
        count += 1;
      }
    }
  });
  return count;
}

/**
 * @param {THREE.Object3D} root
 */
export function removeManualFogFromObject(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    for (const material of materials) {
      removeManualFogFromMaterial(material);
    }
  });
}

/**
 * @param {number} colorHex
 * @param {number} density
 * @param {THREE.WebGLRenderer} renderer
 */
export function setManualFogParams(colorHex, density, renderer) {
  _fogColorScratch.setHex(colorHex);
  _fogColorScratch.getRGB(
    manualFogUniforms.uManualFogColor.value,
    renderer?.outputColorSpace ?? SRGBColorSpace,
  );
  manualFogUniforms.uManualFogDensity.value = density;
}

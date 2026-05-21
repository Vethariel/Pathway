import * as THREE from "three";

const FOLIAGE_MATERIAL_NAMES = [
  "Background_Tree_Atlas",
  "Tree_Branches_01",
  "Tree_Branches_02",
];

function isFoliageMaterial(material) {
  const name = material.name || "";
  return FOLIAGE_MATERIAL_NAMES.some((n) => name.includes(n));
}

/**
 * Fix GLTF foliage: use diffuse alpha for cutout (not color as alphaMap),
 * and correct texture color space.
 */
export function fixTreeMaterials(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;

    if (Array.isArray(node.material)) {
      node.material = node.material.map((mat) => fixMaterial(mat));
    } else {
      node.material = fixMaterial(node.material);
    }
  });
}

function fixMaterial(material) {
  if (!material || !material.isMeshStandardMaterial) return material;

  const mat = material.clone();
  applyTextureColorSpace(mat);

  if (isFoliageMaterial(material)) {
    configureFoliageMaterial(mat);
  } else {
    mat.side = THREE.DoubleSide;
    mat.metalness = 0;
    mat.roughness = Math.min(mat.roughness ?? 0.9, 0.95);
  }

  return mat;
}

function applyTextureColorSpace(material) {
  if (material.map) {
    material.map.colorSpace = THREE.SRGBColorSpace;
  }
  if (material.emissiveMap) {
    material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  }
}

function configureFoliageMaterial(material) {
  material.side = THREE.DoubleSide;
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.alphaMap = null;
  // Use the PNG alpha channel from .map — do NOT set alphaMap = .map (uses red, kills green leaves).
  material.alphaTest = 0.35;
  material.metalness = 0;
  material.roughness = 0.92;
}

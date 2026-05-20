import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  BG_TREE_X,
  CHUNK_LENGTH,
  CHUNKS_RADIUS,
  CORRIDOR_HALF_WIDTH,
  SIDE_FAR,
  SIDE_MID,
  TREE_CLEARANCE,
} from "./corridorConfig.js";
import {
  getActiveChunkRange,
  getChunkIndex,
  shouldSkipTreePlacement,
} from "./corridorLogic.js";
import { fixTreeMaterials } from "./fixTreeMaterials.js";

const TREE_PACK_URL = "/assets/tree_pack.glb";

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function chunkSeed(index) {
  return (index * 374761393) >>> 0;
}

/**
 * Infinite corridor along Z with dense forest on both sides.
 */
export class ForestEnvironment {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "forest";
    this._templates = null;
    this._chunks = new Map();
    this._groundGroup = new THREE.Group();
    this._groundGroup.name = "ground";
    this.group.add(this._groundGroup);
    this._groundCenterChunk = null;
    this._groundLength =
      CHUNK_LENGTH * (CHUNKS_RADIUS * 2 + 3);
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(TREE_PACK_URL);
    fixTreeMaterials(gltf.scene);
    this._templates = extractTemplates(gltf.scene);
    this._buildGround();
    return this;
  }

  update(playerPosition) {
    if (!this._templates) return;

    this._updateGroundPosition(playerPosition.z);

    const centerChunk = getChunkIndex(playerPosition.z);
    const { min, max } = getActiveChunkRange(centerChunk);

    for (let i = min; i <= max; i++) {
      if (!this._chunks.has(i)) {
        const chunk = this._buildChunk(i, playerPosition);
        this._chunks.set(i, chunk);
        this.group.add(chunk);
      }
    }

    for (const [index, chunk] of this._chunks) {
      if (index < min || index > max) {
        this.group.remove(chunk);
        chunk.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            const mats = Array.isArray(child.material)
              ? child.material
              : [child.material];
            mats.forEach((m) => m.dispose());
          }
        });
        this._chunks.delete(index);
      }
    }
  }

  _buildChunk(index, playerPosition) {
    const chunk = new THREE.Group();
    chunk.name = `chunk_${index}`;

    const zStart = index * CHUNK_LENGTH;
    const zCenter = zStart + CHUNK_LENGTH * 0.5;
    const rng = mulberry32(chunkSeed(index));
    const { backgroundTrees, trunks, branches, rocks } = this._templates;
    const playerZ = playerPosition.z;

    this._fillSide(chunk, rng, trunks, branches, rocks, backgroundTrees, zStart, -1, playerZ);
    this._fillSide(chunk, rng, trunks, branches, rocks, backgroundTrees, zStart, 1, playerZ);

    return chunk;
  }

  _buildGround() {
    const forestWidth = SIDE_FAR * 2 + 6;

    this._forestFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(forestWidth, this._groundLength),
      new THREE.MeshStandardMaterial({
        color: 0x111610,
        roughness: 0.95,
        metalness: 0,
        fog: true,
      }),
    );
    this._forestFloor.rotation.x = -Math.PI / 2;
    this._forestFloor.receiveShadow = true;
    this._groundGroup.add(this._forestFloor);

    this._pathFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(CORRIDOR_HALF_WIDTH * 2, this._groundLength),
      new THREE.MeshStandardMaterial({
        color: 0x181410,
        roughness: 0.9,
        metalness: 0,
        fog: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    this._pathFloor.rotation.x = -Math.PI / 2;
    this._pathFloor.position.y = 0.02;
    this._pathFloor.receiveShadow = true;
    this._groundGroup.add(this._pathFloor);
  }

  _updateGroundPosition(playerZ) {
    const centerChunk = getChunkIndex(playerZ);
    if (this._groundCenterChunk === centerChunk) return;

    this._groundCenterChunk = centerChunk;
    const zCenter = centerChunk * CHUNK_LENGTH + CHUNK_LENGTH * 0.5;
    this._forestFloor.position.z = zCenter;
    this._pathFloor.position.z = zCenter;
  }

  _fillSide(chunk, rng, trunks, branches, rocks, backgroundTrees, zStart, side, playerZ) {
    const sign = side;

    for (let i = 0; i < 16; i++) {
      const x = sign * (TREE_CLEARANCE + rng() * (SIDE_MID - TREE_CLEARANCE));
      const z = zStart + 1 + rng() * (CHUNK_LENGTH - 2);
      this._placeTree(chunk, rng, trunks, branches, x, z, playerZ);
    }

    for (let i = 0; i < 12; i++) {
      const x = sign * (SIDE_MID + rng() * (SIDE_FAR - SIDE_MID - 2));
      const z = zStart + rng() * CHUNK_LENGTH;
      this._placeTree(chunk, rng, trunks, branches, x, z, playerZ);
    }

    for (let i = 0; i < 4; i++) {
      const x = sign * (BG_TREE_X + rng() * 2);
      const z = zStart + rng() * CHUNK_LENGTH;
      this._placeBackgroundTree(chunk, rng, backgroundTrees, x, z, playerZ);
    }

    for (let i = 0; i < 3; i++) {
      const x = sign * (TREE_CLEARANCE + 0.5 + rng() * (SIDE_FAR - TREE_CLEARANCE - 1));
      const z = zStart + rng() * CHUNK_LENGTH;
      this._placeRock(chunk, rng, rocks, x, z, playerZ);
    }
  }

  _placeTree(chunk, rng, trunks, branches, x, z, playerZ) {
    if (shouldSkipTreePlacement(x, z, playerZ)) return;

    const tree = new THREE.Group();
    tree.userData.isTree = true;
    tree.add(pick(rng, trunks).clone(), pick(rng, branches).clone());
    tree.position.set(x, 0, z);
    tree.rotation.y = rng() * Math.PI * 2;
    tree.scale.setScalar(0.8 + rng() * 0.45);
    chunk.add(tree);
  }

  _placeBackgroundTree(chunk, rng, templates, x, z, playerZ) {
    if (shouldSkipTreePlacement(x, z, playerZ)) return;

    const tree = pick(rng, templates).clone();
    tree.userData.isTree = true;
    tree.position.set(x, 0, z);
    tree.scale.setScalar(2.2 + rng() * 0.8);

    const yaw = Math.atan2(-x, -z) + (rng() - 0.5) * 0.3;
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yaw,
    );
    tree.quaternion.premultiply(yawQuat);
    chunk.add(tree);
  }

  /**
   * Whether (x, z) is far enough from placed tree trunks in loaded chunks.
   */
  isClearOfTrees(x, z, clearance) {
    const minSq = clearance * clearance;

    for (const chunk of this.group.children) {
      for (const child of chunk.children) {
        if (!child.userData?.isTree) continue;

        const dx = child.position.x - x;
        const dz = child.position.z - z;
        if (dx * dx + dz * dz < minSq) return false;
      }
    }

    return true;
  }

  _placeRock(chunk, rng, templates, x, z, playerZ) {
    if (shouldSkipTreePlacement(x, z, playerZ)) return;

    const rock = pick(rng, templates).clone();
    rock.position.set(x, 0, z);
    rock.rotation.y = rng() * Math.PI * 2;
    rock.scale.setScalar(0.55 + rng() * 0.4);
    chunk.add(rock);
  }
}

function extractTemplates(root) {
  const rootNode = root.getObjectByName("RootNode");
  if (!rootNode) {
    throw new Error("tree_pack.glb: expected RootNode");
  }

  const backgroundTrees = [];
  const trunks = [];
  const branches = [];
  const rocks = [];

  for (const child of rootNode.children) {
    const name = child.name;
    const template = prepareTemplate(child);
    fixTreeMaterials(template);
    enableShadows(template);

    if (name.startsWith("Background_Tree_Atlas")) {
      backgroundTrees.push(template);
    } else if (name.startsWith("Tree_Trunk")) {
      trunks.push(template);
    } else if (name.startsWith("Tree_Branches")) {
      branches.push(template);
    } else if (name.startsWith("Rocks")) {
      rocks.push(template);
    }
  }

  return { backgroundTrees, trunks, branches, rocks };
}

function prepareTemplate(object) {
  const template = object.clone(true);

  template.matrix.decompose(
    template.position,
    template.quaternion,
    template.scale,
  );
  template.matrixAutoUpdate = true;

  template.position.set(0, 0, 0);
  template.scale.set(1, 1, 1);
  template.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(template);
  template.position.y -= bounds.min.y;

  return template;
}

function enableShadows(object) {
  object.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

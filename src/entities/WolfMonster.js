import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const WOLF_URL = "/assets/wolf_monster.glb";

const SCALE = 1.5;
const GROUND_DROP = 2.7;

/** Scales how far Wolf_MoveBack root motion deviates from its end pose (0–1). */
const MOVE_BACK_MOTION_SCALE = 0.2;

/** World units the wolf group slides backward during Wolf_MoveBack. */
const MOVE_BACK_DISTANCE = 4.5;

/** Normalized clip time where Wolf_Jump reaches its apex. */
const JUMP_PEAK_PROGRESS = 0.42;

/** Extra world-units of height at the middle of the jump arc. */
const JUMP_ARC_HEIGHT = 1.0;

/** Local offset from model origin to wolf "face" bite point. */
const JUMP_FACE_LOCAL = new THREE.Vector3(0, 1.35, 0.45);

const CLIP = {
  idle: "Wolf_PatrolIdle",
  walk: "Wolf_Walk",
  jump: "Wolf_Jump",
  moveBack: "Wolf_MoveBack",
};

export class WolfMonster {
  constructor() {
    this.model = new THREE.Group();
    this.model.name = "wolf";
    this.mixer = null;
    this.actions = {};
    this._currentAction = null;
    this._mesh = null;
    this._moveBackOrigin = new THREE.Vector3();
    this._moveBackAction = null;
    this._backDir = new THREE.Vector3();
    this._groundY = 0;
    this.onMoveBackFinished = null;
    this.onJumpScareBegin = null;
    this.onJumpScarePeak = null;
    this.onJumpScareComplete = null;
    this._jumpScare = null;
    this._camPos = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._faceOffset = new THREE.Vector3();
  }

  get isRetreating() {
    return Boolean(this._moveBackAction?.isRunning());
  }

  get isJumpScaring() {
    return Boolean(this._jumpScare);
  }

  facePlayer(playerPosition) {
    const dx = playerPosition.x - this.model.position.x;
    const dz = playerPosition.z - this.model.position.z;
    this.model.rotation.y = Math.atan2(dx, dz);
  }

  playJumpScare(playerPosition, camera) {
    this._moveBackAction = null;
    this.facePlayer(playerPosition);

    camera.getWorldPosition(this._camPos);
    camera.getWorldDirection(this._camDir);
    this._camPos.addScaledVector(this._camDir, 0.4);

    this._faceOffset.copy(JUMP_FACE_LOCAL).applyQuaternion(this.model.quaternion);
    const peakRootPos = this._camPos.clone().sub(this._faceOffset);

    this._jumpScare = {
      startPos: this.model.position.clone(),
      peakRootPos,
      peakHit: false,
    };

    this.onJumpScareBegin?.();

    this._playOnce(CLIP.jump);
  }

  getJumpScareFaceWorld(target = new THREE.Vector3()) {
    this.model.getWorldPosition(target);
    target.add(JUMP_FACE_LOCAL.clone().applyQuaternion(this.model.quaternion));
    return target;
  }

  playMoveBack() {
    this._moveBackOrigin.copy(this.model.position);
    this._moveBackAction = this._playOnce(CLIP.moveBack);
  }

  /**
   * @param {boolean} [creep] slower gait for final approach (no root-motion snap)
   */
  playWalk(creep = false) {
    if (this.isJumpScaring || this.isRetreating) return;

    const walk = this.actions[CLIP.walk];
    if (!walk) return;

    const timeScale = creep ? 0.52 : 1;

    if (this._currentAction === walk) {
      walk.timeScale = timeScale;
      return;
    }

    this._playLoop(CLIP.walk);
    walk.timeScale = timeScale;
  }

  playIdle() {
    if (this.isJumpScaring || this.isRetreating) return;
    if (this._currentAction === this.actions[CLIP.idle]) return;
    this._playLoop(CLIP.idle);
  }

  update(delta, playerPosition, camera) {
    this.mixer?.update(delta);

    if (
      this.model.visible &&
      playerPosition &&
      !this._jumpScare?.peakHit
    ) {
      this.facePlayer(playerPosition);
    }

    if (this._jumpScare) {
      this._updateJumpScare(playerPosition, camera);
    }

    const action = this._moveBackAction;
    if (!action?.isRunning()) return;

    const clip = action.getClip();
    const progress = clip.duration > 0 ? action.time / clip.duration : 0;

    this._getBackDir(this._backDir);
    this.model.position
      .copy(this._moveBackOrigin)
      .addScaledVector(this._backDir, MOVE_BACK_DISTANCE * progress);
  }

  _updateJumpScare(playerPosition, camera) {
    if (!this._jumpScare || this._jumpScare.peakHit) return;

    const action = this.actions[CLIP.jump];
    if (!action) return;

    const clip = action.getClip();
    if (!clip?.duration) return;

    const progress = Math.min(action.time / clip.duration, 1);

    if (playerPosition) {
      this.facePlayer(playerPosition);
    }

    const { startPos, peakRootPos } = this._jumpScare;
    const approach = Math.min(progress / JUMP_PEAK_PROGRESS, 1);
    const blend = Math.sin(approach * Math.PI * 0.5);
    this.model.position.lerpVectors(startPos, peakRootPos, blend);
    this.model.position.y +=
      JUMP_ARC_HEIGHT * Math.sin(approach * Math.PI);

    const jumpEnded = !action.isRunning() && !action.paused;
    if (progress >= JUMP_PEAK_PROGRESS || (jumpEnded && progress > 0.08)) {
      this._hitJumpScarePeak(camera, action);
    }
  }

  _hitJumpScarePeak(camera, action) {
    if (!this._jumpScare || this._jumpScare.peakHit) return;

    this._jumpScare.peakHit = true;

    if (camera) {
      camera.getWorldPosition(this._camPos);
      camera.getWorldDirection(this._camDir);
      this.facePlayer(this._camPos);
      this._camPos.addScaledVector(this._camDir, 0.4);
      this._faceOffset.copy(JUMP_FACE_LOCAL).applyQuaternion(this.model.quaternion);
      this.model.position.copy(this._camPos).sub(this._faceOffset);
    }

    if (action) {
      action.paused = true;
    }

    this.onJumpScarePeak?.();
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(WOLF_URL);
    this._mesh = gltf.scene;

    this.model.scale.setScalar(SCALE);
    this.model.visible = false;
    this.model.add(this._mesh);

    prepareMeshes(this._mesh);
    this._setupAnimations(gltf.animations);

    this.mixer.update(0);
    alignToGround(this.model);
    this.model.position.y -= GROUND_DROP;
    this._groundY = this.model.position.y;

    return this.model;
  }

  spawnAt(x, z) {
    this.model.position.set(x, this._groundY, z);
    this.model.visible = true;
    this._moveBackAction = null;
    this._jumpScare = null;
    this._playLoop(CLIP.idle);
  }

  hide() {
    this.model.visible = false;
    this._moveBackAction = null;
    this._jumpScare = null;

    const jump = this.actions[CLIP.jump];
    if (jump) {
      jump.paused = false;
      jump.stop();
    }
  }

  _getBackDir(target) {
    target.set(0, 0, -1).applyQuaternion(this.model.quaternion);
    target.y = 0;
    if (target.lengthSq() > 0) {
      target.normalize();
    } else {
      target.set(0, 0, -1);
    }
    return target;
  }

  _setupAnimations(clips) {
    this.mixer = new THREE.AnimationMixer(this._mesh);

    for (const name of Object.values(CLIP)) {
      let clip = THREE.AnimationClip.findByName(clips, name);
      if (!clip) continue;

      if (name === CLIP.moveBack) {
        clip = clip.clone();
        scaleClipPositionTracksFromEnd(clip, MOVE_BACK_MOTION_SCALE);
      }

      if (name === CLIP.walk || name === CLIP.idle) {
        clip = clip.clone();
        zeroClipPositionTracks(clip);
      }

      this.actions[name] = this.mixer.clipAction(clip);
    }

    this.mixer.addEventListener("finished", (event) => {
      if (event.action !== this._currentAction) return;

      if (event.action === this.actions[CLIP.moveBack]) {
        this.model.position.copy(this._moveBackOrigin);
        this._moveBackAction = null;
        this.onMoveBackFinished?.();
        return;
      }

      if (event.action === this.actions[CLIP.jump] && this._jumpScare) {
        if (!this._jumpScare.peakHit) {
          this.onJumpScarePeak?.();
        }
        this._jumpScare = null;
        this.onJumpScareComplete?.();
        return;
      }

      this._playLoop(CLIP.idle);
    });

    this._playLoop(CLIP.idle);
  }

  _playLoop(name) {
    const next = this.actions[name];
    if (!next) return;

    if (this._currentAction && this._currentAction !== next) {
      this._currentAction.fadeOut(0.25);
    }

    next.reset();
    next.timeScale = 1;
    next.setLoop(THREE.LoopRepeat).fadeIn(0.25).play();
    this._currentAction = next;
  }

  _playOnce(name) {
    const next = this.actions[name];
    if (!next) return;

    if (this._currentAction) {
      this._currentAction.fadeOut(0.15);
    }

    next.reset();
    next.timeScale = 1;
    next.setLoop(THREE.LoopOnce);
    next.clampWhenFinished = true;
    next.fadeIn(0.15).play();
    this._currentAction = next;
    return next;
  }
}

/** Removes root motion — world movement is driven by the wolf group position. */
function zeroClipPositionTracks(clip) {
  for (const track of clip.tracks) {
    if (!track.name.endsWith(".position")) continue;

    const values = track.values;
    const x0 = values[0];
    const y0 = values[1];
    const z0 = values[2];

    for (let i = 0; i < values.length; i += 3) {
      values[i] = x0;
      values[i + 1] = y0;
      values[i + 2] = z0;
    }
  }
}

/** Keeps the clip's end pose; scales earlier root motion toward it. */
function scaleClipPositionTracksFromEnd(clip, scale) {
  for (const track of clip.tracks) {
    if (!track.name.endsWith(".position")) continue;

    const values = track.values;
    const n = values.length;
    const ex = values[n - 3];
    const ey = values[n - 2];
    const ez = values[n - 1];

    for (let i = 0; i < n; i += 3) {
      values[i] = ex + (values[i] - ex) * scale;
      values[i + 1] = ey + (values[i + 1] - ey) * scale;
      values[i + 2] = ez + (values[i + 2] - ez) * scale;
    }
  }
}

function alignToGround(model) {
  const box = new THREE.Box3();
  const part = new THREE.Box3();

  model.updateMatrixWorld(true);

  model.traverse((node) => {
    if (node.isSkinnedMesh) {
      node.computeBoundingBox();
      part.copy(node.boundingBox).applyMatrix4(node.matrixWorld);
      box.union(part);
      return;
    }

    if (node.isMesh) {
      part.setFromObject(node);
      box.union(part);
    }
  });

  if (!box.isEmpty()) {
    model.position.y -= box.min.y;
  }
}

function prepareMeshes(object) {
  object.traverse((node) => {
    if (!node.isMesh) return;

    node.castShadow = true;
    node.receiveShadow = true;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    for (const mat of materials) {
      if (!mat?.isMeshStandardMaterial) continue;

      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;

      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.alphaTest = 0;
      mat.alphaMap = null;
      mat.side = THREE.FrontSide;
      mat.metalness = 0;
      mat.roughness = Math.min(mat.roughness ?? 0.85, 0.9);
      mat.needsUpdate = true;
    }
  });
}

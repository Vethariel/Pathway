import * as THREE from "three";
import {
  applyFogTestManual,
  applyGameFog,
  applyManualFogToObject,
} from "./applyEnvironmentFog.js";
import {
  CORRIDOR_HALF_WIDTH,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Y,
  PLAYER_SPAWN_Z,
} from "./corridorConfig.js";

const FORWARD_SPEED = 4.5;
const BACKWARD_SPEED = 1.5;

/**
 * Forest corridor with manual shader fog (fog test only).
 */
export class FogTestMode {
  /**
   * @param {object} deps
   * @param {THREE.Scene} deps.scene
   * @param {THREE.WebGLRenderer} deps.renderer
   * @param {THREE.Group} deps.player
   * @param {THREE.PerspectiveCamera} deps.camera
   * @param {import('./ForestEnvironment.js').ForestEnvironment} deps.forest
   * @param {THREE.Object3D[]} deps.fogRoots
   * @param {THREE.DirectionalLight} deps.moon
   * @param {THREE.Object3D[]} deps.hideInTest
   * @param {HTMLElement} deps.overlayEl
   * @param {HTMLElement} deps.statusEl
   * @param {HTMLCanvasElement} deps.canvas
   * @param {() => void} deps.onExit
   * @param {() => THREE.Object3D[]} deps.getGameFogRoots
   */
  constructor(deps) {
    this._deps = deps;
    this.active = false;
    this._keys = new Set();
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
  }

  get isActive() {
    return this.active;
  }

  enter() {
    const {
      scene,
      renderer,
      camera,
      player,
      forest,
      hideInTest,
      overlayEl,
      canvas,
    } = this._deps;

    this.active = true;

    for (const obj of hideInTest) {
      obj.visible = false;
    }

    player.position.set(PLAYER_SPAWN_X, PLAYER_SPAWN_Y, PLAYER_SPAWN_Z);
    camera.rotation.x = 0;
    player.rotation.y = 0;

    forest.update(player.position);
    const patched = applyFogTestManual(scene, renderer, this._deps.fogRoots);
    this._updateLighting();

    overlayEl.hidden = false;
    this._deps.statusEl.textContent =
      patched > 0
        ? `Fog: manual shader (${patched} mats) — same as game — walk forward`
        : "Fog: ERROR — no materials patched (check console)";

    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);

    canvas.requestPointerLock();
  }

  exit() {
    if (!this.active) return;

    const { scene, renderer, hideInTest, overlayEl, canvas } = this._deps;

    document.exitPointerLock();
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    this._keys.clear();

    applyGameFog(scene, renderer, this._deps.getGameFogRoots());

    for (const obj of hideInTest) {
      obj.visible = true;
    }

    overlayEl.hidden = true;
    this.active = false;
  }

  /**
   * @param {number} delta
   */
  update(delta) {
    if (!this.active) return;

    this._updateMovement(delta);
    this._updateLighting();
    this._deps.forest.update(this._deps.player.position);
    for (const root of this._deps.fogRoots) {
      applyManualFogToObject(root);
    }
  }

  _updateMovement(delta) {
    const { player, canvas } = this._deps;

    if (document.pointerLockElement !== canvas) return;

    if (this._keys.has("KeyW") || this._keys.has("ArrowUp")) {
      player.position.z -= FORWARD_SPEED * delta;
    }
    if (this._keys.has("KeyS") || this._keys.has("ArrowDown")) {
      player.position.z += BACKWARD_SPEED * delta;
    }

    player.position.x = THREE.MathUtils.clamp(
      player.position.x,
      -CORRIDOR_HALF_WIDTH + 0.15,
      CORRIDOR_HALF_WIDTH - 0.15,
    );
  }

  _updateLighting() {
    const { player, moon } = this._deps;
    const { x, y, z } = player.position;
    moon.position.set(x - 25, y + 48, z - 18);
    moon.target.position.set(x, 0, z);
    moon.target.updateMatrixWorld();
  }

  _onKeyDown(e) {
    if (!this.active) return;

    this._keys.add(e.code);

    if (e.code === "Escape") {
      e.preventDefault();
      this._deps.onExit();
    }
  }

  _onKeyUp(e) {
    this._keys.delete(e.code);
  }
}

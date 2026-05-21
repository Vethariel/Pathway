import * as THREE from "three";
import { isPointInSpotlight } from "../utils/spotlightHit.js";

const SILHOUETTE_DISTANCE = 19;
const SHOW_CHANCE_PER_CHECK = 0.12;
const CHECK_INTERVAL_MIN = 8;
const CHECK_INTERVAL_MAX = 22;
const VISIBLE_MIN = 0.75;
const VISIBLE_MAX = 1.9;

const _aim = new THREE.Vector3();

/**
 * Brief dark shape at the fog wall; vanishes when the beam sweeps over it.
 */
export class FogSilhouette {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = "fog-silhouette";
    this.group.visible = false;

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.1, 4, 8),
      new THREE.MeshBasicMaterial({
        color: 0x020304,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
    );
    body.position.y = 1.05;
    this.group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      body.material,
    );
    head.position.y = 1.85;
    this.group.add(head);

    scene.add(this.group);

    this._checkTimer = 6;
    this._visibleTimer = 0;
    this._active = false;
  }

  reset() {
    this.group.visible = false;
    this._active = false;
    this._checkTimer = 6;
    this._visibleTimer = 0;
  }

  /**
   * @param {boolean} wolfBlocks — skip while wolf is visible
   */
  update(delta, playerPosition, playerYaw, camera, flashlight, wolfBlocks) {
    if (wolfBlocks) {
      this.group.visible = false;
      this._active = false;
      this._checkTimer = Math.min(this._checkTimer, 4);
      return;
    }

    if (this._active) {
      this._visibleTimer -= delta;
      this.group.visible = this._visibleTimer > 0;

      if (flashlight?.isOn && flashlight.isBeamLit && camera) {
        _aim.set(
          this.group.position.x,
          playerPosition.y - 0.1,
          this.group.position.z,
        );
        if (isPointInSpotlight(_aim, flashlight.light, camera)) {
          this._visibleTimer = 0;
          this.group.visible = false;
          this._active = false;
        }
      }

      if (this._visibleTimer <= 0) {
        this._active = false;
        this.group.visible = false;
      }
      return;
    }

    this._checkTimer -= delta;
    if (this._checkTimer > 0) return;

    this._scheduleCheck();

    if (Math.random() < SHOW_CHANCE_PER_CHECK) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * (3.8 + Math.random() * 2.2);
      const z = playerPosition.z - SILHOUETTE_DISTANCE;
      this.group.position.set(x, playerPosition.y - 1.7, z);
      this.group.rotation.y = Math.atan2(
        playerPosition.x - x,
        playerPosition.z - z,
      );
      this._visibleTimer =
        VISIBLE_MIN + Math.random() * (VISIBLE_MAX - VISIBLE_MIN);
      this._active = true;
      this.group.visible = true;
    }
  }

  _scheduleCheck() {
    this._checkTimer =
      CHECK_INTERVAL_MIN +
      Math.random() * (CHECK_INTERVAL_MAX - CHECK_INTERVAL_MIN);
  }
}

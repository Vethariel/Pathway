import * as THREE from "three";

const _face = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _lookMatrix = new THREE.Matrix4();
const _lookEuler = new THREE.Euler(0, 0, 0, "YXZ");

/**
 * Pulls the FPS view toward the wolf during a jump scare, then locks look input.
 */
export class JumpScareCamera {
  constructor({ maxPitch = Math.PI / 2 - 0.08 } = {}) {
    this.maxPitch = maxPitch;
    this.active = false;
    this.locked = false;
    this._player = null;
    this._camera = null;
    this._getFaceWorld = null;
    this._startYaw = 0;
    this._startPitch = 0;
    this._startCamLocalZ = 0;
    this._targetYaw = 0;
    this._targetPitch = 0;
    this._targetCamLocalZ = 0;
    this._blend = 0;
  }

  blocksInput() {
    return this.active;
  }

  begin(player, camera, getFaceWorld) {
    this._player = player;
    this._camera = camera;
    this._getFaceWorld = getFaceWorld;
    this.active = true;
    this.locked = false;
    this._blend = 0;

    this._startYaw = player.rotation.y;
    this._startPitch = camera.rotation.x;
    this._startCamLocalZ = camera.position.z;

    this._computeAim();
    this._targetCamLocalZ = -0.42;
  }

  lock() {
    if (!this.active) return;
    this.locked = true;
    this._blend = 1;
    this._applyAim(1);
  }

  reset() {
    this.active = false;
    this.locked = false;
    this._blend = 0;

    if (this._camera) {
      this._camera.position.z = 0;
    }

    this._player = null;
    this._camera = null;
    this._getFaceWorld = null;
  }

  /**
   * @returns {{ pitch: number } | null} synced camera pitch for main loop
   */
  update(delta) {
    if (!this.active || !this._player || !this._camera) return null;

    this._computeAim();

    const speed = this.locked ? 10 : 5.5;
    this._blend = Math.min(1, this._blend + delta * speed);
    this._applyAim(this._blend);

    return { pitch: this._camera.rotation.x };
  }

  _computeAim() {
    if (!this._getFaceWorld || !this._player?.position) return;

    this._getFaceWorld(_face);
    _eye.copy(this._player.position);

    _lookMatrix.lookAt(_eye, _face, THREE.Object3D.DEFAULT_UP);
    _lookEuler.setFromRotationMatrix(_lookMatrix, "YXZ");

    this._targetYaw = _lookEuler.y;
    this._targetPitch = THREE.MathUtils.clamp(
      _lookEuler.x,
      -this.maxPitch,
      this.maxPitch,
    );
  }

  _applyAim(t) {
    const yaw = THREE.MathUtils.lerp(this._startYaw, this._targetYaw, t);
    const pitch = THREE.MathUtils.lerp(
      this._startPitch,
      this._targetPitch,
      t,
    );

    this._player.rotation.y = yaw;
    this._camera.rotation.x = THREE.MathUtils.clamp(
      pitch,
      -this.maxPitch,
      this.maxPitch,
    );
    this._camera.position.z = THREE.MathUtils.lerp(
      this._startCamLocalZ,
      this._targetCamLocalZ,
      t,
    );
  }
}

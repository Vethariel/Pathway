import * as THREE from "three";
import {
  BATTERY_LIFETIME,
  BATTERY_LOW_THRESHOLD,
  BEAM_ANGLE_MAX,
  BEAM_ANGLE_MIN,
  BEAM_DISTANCE_MAX,
  BEAM_DISTANCE_MIN,
  BEAM_INTENSITY_MAX,
  BEAM_INTENSITY_MIN,
  LENS_EMISSIVE,
  LENS_EMISSIVE_MAX,
  OFF_TIME_TO_RECOVER,
  ON_TIME_BEFORE_BLINK_MAX,
  ON_TIME_BEFORE_BLINK_MIN,
} from "./flashlightConfig.js";
import { assetUrl } from "../assetUrl.js";

const SWITCH_SOUND_URL = assetUrl("assets/switch.mp3");

/**
 * Flashlight: draining battery (brightness + cone shrink) and late malfunction blinking.
 * `isOn` is the switch only; beam may strobe while malfunctioning.
 */
export class Flashlight {
  constructor(camera) {
    this.isOn = false;
    this.isBeamLit = false;
    this.isDepleted = false;
    this.isMalfunctioning = false;
    this.battery = 1;

    this.group = new THREE.Group();
    this.group.position.set(0.28, -0.38, -0.45);
    camera.add(this.group);

    this._buildMesh();

    this.light = new THREE.SpotLight(
      0xfff0d4,
      0,
      BEAM_DISTANCE_MAX,
      BEAM_ANGLE_MAX,
      0.35,
      1.2,
    );
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.camera.near = 0.2;
    this.light.shadow.camera.far = BEAM_DISTANCE_MAX + 2;
    this.light.shadow.bias = -0.0003;
    this.light.position.set(0, 0.02, 0);
    this.light.target.position.set(0, 0, -1);
    this.group.add(this.light);
    this.group.add(this.light.target);

    this._switchSound = new Audio(SWITCH_SOUND_URL);
    this._switchSound.volume = 0.55;

    this._flickerPhase = 0;
    this._drainRate = 1 / BATTERY_LIFETIME;
    this._threatDrainMult = 1;
    this._malfunctionOnset = this._rollMalfunctionOnset();
    this._onTimer = 0;
    this._offTimer = 0;
    this._blinkSegmentLeft = 0;
    this._blinkSeed = Math.random() * 1000;
  }

  _rollMalfunctionOnset() {
    return (
      ON_TIME_BEFORE_BLINK_MIN +
      Math.random() * (ON_TIME_BEFORE_BLINK_MAX - ON_TIME_BEFORE_BLINK_MIN)
    );
  }

  setThreatDrainMultiplier(mult) {
    this._threatDrainMult = Math.max(1, mult);
  }

  /** Called when the wolf begins stalking — sudden beam failure. */
  triggerStalkMalfunction() {
    if (this.isDepleted || !this.isOn || this.isMalfunctioning) return;
    this.isMalfunctioning = true;
    this._blinkSeed += 31.7;
    this._blinkSegmentLeft = 0;
    this._setBeam(false);
  }

  get isBatteryLow() {
    return !this.isDepleted && this.battery < BATTERY_LOW_THRESHOLD;
  }

  _buildMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1c1c1c,
      roughness: 0.45,
      metalness: 0.5,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.16), bodyMat);
    body.position.set(0, 0, 0.02);
    this.group.add(body);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.06, 10), bodyMat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0, -0.1);
    this.group.add(head);

    this.lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.028, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.2,
      }),
    );
    this.lens.rotation.y = Math.PI;
    this.lens.position.set(0, 0, -0.13);
    this.group.add(this.lens);
  }

  toggle() {
    if (this.isDepleted) {
      this._switchSound.currentTime = 0;
      this._switchSound.play().catch(() => {});
      return;
    }

    this.isOn = !this.isOn;
    if (this.isOn) {
      this._offTimer = 0;
    } else {
      this._onTimer = 0;
      this._blinkSegmentLeft = 0;
      this._setBeam(false);
    }

    this._switchSound.currentTime = 0;
    this._switchSound.play().catch(() => {});
  }

  reset() {
    this.isOn = false;
    this.isDepleted = false;
    this.isMalfunctioning = false;
    this.battery = 1;
    this._flickerPhase = 0;
    this._onTimer = 0;
    this._offTimer = 0;
    this._blinkSegmentLeft = 0;
    this._threatDrainMult = 1;
    this._malfunctionOnset = this._rollMalfunctionOnset();
    this._applyBeamShape(1);
    this._setBeam(false);
  }

  update(delta) {
    this.light.target.updateMatrixWorld(true);

    if (this.isDepleted) {
      this._setBeam(false);
      return;
    }

    if (!this.isOn) {
      this._onTimer = 0;
      this._blinkSegmentLeft = 0;
      this._setBeam(false);

      if (this.isMalfunctioning) {
        this._offTimer += delta;
        if (this._offTimer >= OFF_TIME_TO_RECOVER) {
          this.isMalfunctioning = false;
          this._offTimer = 0;
        }
      }

      return;
    }

    this._offTimer = 0;
    this._onTimer += delta;

    this.battery = Math.max(
      0,
      this.battery - this._drainRate * this._threatDrainMult * delta,
    );
    if (this.battery <= 0) {
      this._deplete();
      return;
    }

    if (!this.isMalfunctioning && this._onTimer >= this._malfunctionOnset) {
      this.isMalfunctioning = true;
      this._blinkSeed += 17.3;
      this._blinkSegmentLeft = 0;
    }

    if (this.isMalfunctioning) {
      this._updateMalfunctionBlink(delta);
      return;
    }

    this._flickerPhase += delta;
    let flicker = 1;
    if (this.battery < 0.12) {
      flicker =
        0.55 +
        Math.sin(this._flickerPhase * 28) * 0.22 +
        Math.sin(this._flickerPhase * 41) * 0.15;
    } else if (this.battery < 0.3) {
      flicker =
        0.9 +
        Math.sin(this._flickerPhase * 14) * 0.06 +
        Math.sin(this._flickerPhase * 23) * 0.04;
    }

    this._setBeam(true, flicker);
  }

  _updateMalfunctionBlink(delta) {
    this._blinkSegmentLeft -= delta;

    let guard = 0;
    while (this._blinkSegmentLeft <= 0 && guard++ < 8) {
      const nextLit = !this.isBeamLit;
      const scale = nextLit ? 0.45 + Math.random() * 0.55 : 1;
      this._setBeam(nextLit, scale);
      this._blinkSegmentLeft += this._nextBlinkDuration(nextLit);
    }
  }

  _nextBlinkDuration(willBeLit) {
    const t = this._blinkSeed + this._onTimer * 19.7;
    const n1 = 0.5 + 0.5 * Math.sin(t * 23.1);
    const n2 = 0.5 + 0.5 * Math.sin(t * 41.3 + 2.1);
    const n3 = 0.5 + 0.5 * Math.sin(t * 67.9 + 5.7);

    if (willBeLit) {
      return 0.03 + n1 * 0.05 + n2 * 0.04;
    }

    const stutter = n3 > 0.72 ? 0.02 + n1 * 0.03 : 0;
    return 0.05 + n2 * 0.09 + n1 * 0.06 + stutter;
  }

  _deplete() {
    this.battery = 0;
    this.isDepleted = true;
    this.isOn = false;
    this.isMalfunctioning = false;
    this._setBeam(false);
  }

  _applyBeamShape(charge) {
    const t = THREE.MathUtils.clamp(charge, 0, 1);
    this.light.angle = THREE.MathUtils.lerp(BEAM_ANGLE_MIN, BEAM_ANGLE_MAX, t);
    this.light.distance = THREE.MathUtils.lerp(
      BEAM_DISTANCE_MIN,
      BEAM_DISTANCE_MAX,
      t,
    );
    this.light.shadow.camera.far = this.light.distance + 2;
  }

  _setBeam(lit, intensityScale = 1) {
    this.isBeamLit = lit && this.battery > 0 && !this.isDepleted;

    if (!this.isBeamLit) {
      this.light.intensity = 0;
      this.lens.material.emissive.setHex(0x000000);
      this.lens.material.emissiveIntensity = 0;
      return;
    }

    const t = this.battery;
    this._applyBeamShape(t);

    const baseIntensity = THREE.MathUtils.lerp(
      BEAM_INTENSITY_MIN,
      BEAM_INTENSITY_MAX,
      t,
    );
    const lensIntensity = THREE.MathUtils.lerp(0.08, LENS_EMISSIVE_MAX, t);

    this.light.intensity = baseIntensity * intensityScale;
    this.lens.material.emissive.setHex(LENS_EMISSIVE);
    this.lens.material.emissiveIntensity = lensIntensity * intensityScale;
  }
}

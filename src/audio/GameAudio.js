import {
  AMBIENT_VOLUME,
  FALSE_LURK_CHANCE,
  FALSE_LURK_INTERVAL_MAX,
  FALSE_LURK_INTERVAL_MIN,
  GROWL_FLUKE_CHANCE,
  HEARTBEAT_VOLUME,
  HORROR_WARNING_CHANCE_PER_SEC,
  HORROR_WARNING_COOLDOWN,
  HORROR_WARNING_VOLUME,
  JUMPSCARE_GROWL_ONLY_CHANCE,
  JUMPSCARE_STING_ONLY_CHANCE,
  JUMPSCARE_VOLUME,
  LURK_SILENCE_CHANCE,
  LURK_SILENCE_MAX,
  LURK_SILENCE_MIN,
  LURKING_INTERVAL_MAX,
  LURKING_INTERVAL_MIN,
  LURKING_VOLUME,
  MONSTER_ATTACK_VOLUME,
  MONSTER_GROWL_VOLUME,
  SOUNDS,
  SPAWN_DOUBLE_GROWL_DELAY,
  STALK_STEP_INTERVAL,
  STALK_STEP_VOLUME,
  WALK_STEP_INTERVAL,
  WALK_VOLUME,
  WOLF_UNFOCUSED_GROWL_CHANCE,
  WOLF_UNFOCUSED_GROWL_INTERVAL_MAX,
  WOLF_UNFOCUSED_GROWL_INTERVAL_MIN,
} from "./audioConfig.js";
import { randomThreatPan, stereoPanFromWorld } from "./spatialPan.js";

/**
 * Horror soundscape with stereo positioning (Web Audio API).
 */
export class GameAudio {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._buffers = new Map();
    this._loops = new Map();

    this._unlocked = false;
    this._ambientPlaying = false;

    this._footstepTimer = 0;
    this._stalkStepTimer = 0;
    this._lurkingTimer = 4;
    this._unfocusedGrowlTimer = 5;
    this._falseLurkTimer = 12;
    this._horrorWarningCooldown = 0;
    this._horrorWarningUsedThisRun = false;
    this._silenceHold = 0;

    this._heartbeatGain = null;
    this._heartbeatSource = null;
    this._heartbeatPlaying = false;
    this._doubleGrowlTimeout = null;
  }

  async unlock() {
    await this._ensureContext();
    this._unlocked = true;
    await this._preloadAll();
  }

  async startAmbient() {
    await this._ensureContext();
    if (this._ambientPlaying) return;
    await this._startLoop("ambient", SOUNDS.ambient, AMBIENT_VOLUME, 0);
    this._ambientPlaying = true;
  }

  stopAmbient() {
    this._stopLoop("ambient");
    this._ambientPlaying = false;
  }

  reset() {
    this.stopAmbient();
    this._stopHeartbeat();
    this._clearDoubleGrowl();
    this._footstepTimer = 0;
    this._stalkStepTimer = 0;
    this._lurkingTimer = 4;
    this._unfocusedGrowlTimer = 5;
    this._falseLurkTimer = 12;
    this._horrorWarningCooldown = 0;
    this._horrorWarningUsedThisRun = false;
    this._silenceHold = 0;
  }

  onJumpScare(wolfPos, playerPos, playerYaw) {
    const pan =
      wolfPos != null
        ? stereoPanFromWorld(wolfPos, playerPos, playerYaw)
        : 0;

    const roll = Math.random();
    const growlOnly = roll < JUMPSCARE_GROWL_ONLY_CHANCE;
    const stingOnly =
      !growlOnly &&
      roll < JUMPSCARE_GROWL_ONLY_CHANCE + JUMPSCARE_STING_ONLY_CHANCE;

    if (!growlOnly) {
      this._playOneShot(SOUNDS.jumpscare, { volume: JUMPSCARE_VOLUME, pan: 0 });
    }
    if (!stingOnly) {
      this._playOneShot(SOUNDS.monsterGrowl, {
        volume: MONSTER_GROWL_VOLUME,
        pan,
      });
    }
  }

  onWolfSpawn(wolfPos, playerPos, playerYaw, options = {}) {
    if (!options.silent) {
      const pan = stereoPanFromWorld(wolfPos, playerPos, playerYaw);
      this._playOneShot(SOUNDS.monsterGrowl, {
        volume: MONSTER_GROWL_VOLUME,
        pan,
      });
    }

    if (options.doubleTension) {
      this._scheduleDoubleGrowl(wolfPos, playerPos, playerYaw);
    }
  }

  onWolfReappear(wolfPos, playerPos, playerYaw) {
    const pan = stereoPanFromWorld(wolfPos, playerPos, playerYaw);
    this._playOneShot(SOUNDS.monsterGrowl, {
      volume: MONSTER_GROWL_VOLUME * 1.05,
      pan,
    });
    this._playOneShot(SOUNDS.horrorWarning, {
      volume: HORROR_WARNING_VOLUME * 0.85,
      pan,
    });
  }

  onWolfRetreat(wolfPos, playerPos, playerYaw) {
    const pan = stereoPanFromWorld(wolfPos, playerPos, playerYaw);
    this._playOneShot(SOUNDS.monsterAttack, {
      volume: MONSTER_ATTACK_VOLUME,
      pan,
    });
  }

  tryHorrorWarning(wolfPos, playerPos, playerYaw) {
    if (this._horrorWarningUsedThisRun) return;
    if (this._horrorWarningCooldown > 0) return;
    if (Math.random() > HORROR_WARNING_CHANCE_PER_SEC * 0.2) return;

    this._horrorWarningUsedThisRun = true;
    this._horrorWarningCooldown = HORROR_WARNING_COOLDOWN;
    const pan = stereoPanFromWorld(wolfPos, playerPos, playerYaw);
    this._playOneShot(SOUNDS.horrorWarning, {
      volume: HORROR_WARNING_VOLUME,
      pan,
    });
  }

  /**
   * @param {number} delta
   * @param {{
   *   isPlaying: boolean,
   *   playerPos: { x: number, y: number, z: number },
   *   playerYaw: number,
   *   isMoving: boolean,
   *   wolfPresent: boolean,
   *   wolfPos: { x: number, z: number } | null,
   *   wolfNearby: boolean,
   *   wolfInSpotlight: boolean,
   *   wolfIdentified: boolean,
   *   wolfIlluminatedInRange: boolean,
   *   wolfStalking: boolean,
   *   wolfAtStalkLimit: boolean,
   *   flashlightOn: boolean,
   *   flashlightMalfunctioning: boolean,
   * }} state
   */
  update(delta, state) {
    if (!this._unlocked || !state.isPlaying) return;

    this._horrorWarningCooldown = Math.max(
      0,
      this._horrorWarningCooldown - delta,
    );

    if (this._silenceHold > 0) {
      this._silenceHold -= delta;
    }

    if (state.isMoving) {
      this._footstepTimer -= delta;
      if (this._footstepTimer <= 0) {
        this._footstepTimer = WALK_STEP_INTERVAL;
        this._playOneShot(SOUNDS.walk, {
          volume: WALK_VOLUME * (0.85 + Math.random() * 0.25),
          pan: (Math.random() - 0.5) * 0.15,
        });
      }
    } else {
      this._footstepTimer = 0;
    }

    if (
      state.wolfStalking &&
      state.wolfPos &&
      !state.wolfInSpotlight &&
      this._silenceHold <= 0
    ) {
      this._stalkStepTimer -= delta;
      if (this._stalkStepTimer <= 0) {
        this._stalkStepTimer = STALK_STEP_INTERVAL * (0.75 + Math.random() * 0.5);
        const pan = stereoPanFromWorld(
          state.wolfPos,
          state.playerPos,
          state.playerYaw,
        );
        this._playOneShot(SOUNDS.walk, {
          volume: STALK_STEP_VOLUME * (0.8 + Math.random() * 0.35),
          pan: pan * 0.9,
        });
      }
    } else {
      this._stalkStepTimer = STALK_STEP_INTERVAL * 0.5;
    }

    if (
      state.wolfIlluminatedInRange &&
      state.wolfPos &&
      !state.wolfIdentified
    ) {
      this.tryHorrorWarning(
        state.wolfPos,
        state.playerPos,
        state.playerYaw,
      );
    }

    if (
      state.wolfPresent &&
      state.wolfPos &&
      !state.wolfInSpotlight &&
      this._silenceHold <= 0
    ) {
      this._unfocusedGrowlTimer -= delta;
      if (this._unfocusedGrowlTimer <= 0) {
        this._scheduleUnfocusedGrowl();
        if (Math.random() < WOLF_UNFOCUSED_GROWL_CHANCE) {
          this._playOneShot(SOUNDS.monsterGrowl, {
            volume: MONSTER_GROWL_VOLUME * 0.9,
            pan: stereoPanFromWorld(
              state.wolfPos,
              state.playerPos,
              state.playerYaw,
            ),
          });
        }
      }

      this._falseLurkTimer -= delta;
      if (this._falseLurkTimer <= 0) {
        this._scheduleFalseLurk();
        if (Math.random() < FALSE_LURK_CHANCE) {
          const wrongPan = -stereoPanFromWorld(
            state.wolfPos,
            state.playerPos,
            state.playerYaw,
          );
          this._playOneShot(SOUNDS.monsterGrowl, {
            volume: MONSTER_GROWL_VOLUME * 0.75,
            pan: wrongPan * 0.85 + (Math.random() - 0.5) * 0.2,
          });
        }
      }
    } else if (state.wolfPresent) {
      this._unfocusedGrowlTimer = Math.min(this._unfocusedGrowlTimer, 4);
    }

    const wantHeartbeat =
      state.wolfPresent &&
      state.wolfNearby &&
      (!state.flashlightOn || !state.wolfInSpotlight);

    if (wantHeartbeat) {
      void this._startHeartbeat();
    } else if (
      state.wolfNearby &&
      state.flashlightMalfunctioning &&
      state.wolfPresent
    ) {
      void this._startHeartbeat();
    } else {
      this._stopHeartbeat();
    }

    if (!state.wolfPresent && this._silenceHold <= 0) {
      this._lurkingTimer -= delta;
      if (this._lurkingTimer <= 0) {
        this._scheduleLurking();
        if (Math.random() < GROWL_FLUKE_CHANCE) {
          this._playOneShot(SOUNDS.monsterGrowl, {
            volume: MONSTER_GROWL_VOLUME * 0.85,
            pan: randomThreatPan(),
          });
        } else {
          this._playOneShot(SOUNDS.lurking, {
            volume: LURKING_VOLUME,
            pan: randomThreatPan(),
          });
        }
        if (Math.random() < LURK_SILENCE_CHANCE) {
          this._silenceHold =
            LURK_SILENCE_MIN +
            Math.random() * (LURK_SILENCE_MAX - LURK_SILENCE_MIN);
        }
      }
    } else if (!state.wolfPresent) {
      this._lurkingTimer = Math.min(this._lurkingTimer, 6);
    }
  }

  _scheduleLurking() {
    this._lurkingTimer =
      LURKING_INTERVAL_MIN +
      Math.random() * (LURKING_INTERVAL_MAX - LURKING_INTERVAL_MIN);
  }

  _scheduleUnfocusedGrowl() {
    this._unfocusedGrowlTimer =
      WOLF_UNFOCUSED_GROWL_INTERVAL_MIN +
      Math.random() *
        (WOLF_UNFOCUSED_GROWL_INTERVAL_MAX - WOLF_UNFOCUSED_GROWL_INTERVAL_MIN);
  }

  _scheduleFalseLurk() {
    this._falseLurkTimer =
      FALSE_LURK_INTERVAL_MIN +
      Math.random() * (FALSE_LURK_INTERVAL_MAX - FALSE_LURK_INTERVAL_MIN);
  }

  _scheduleDoubleGrowl(wolfPos, playerPos, playerYaw) {
    this._clearDoubleGrowl();
    this._doubleGrowlTimeout = setTimeout(() => {
      if (!this._unlocked) return;
      const pan = stereoPanFromWorld(wolfPos, playerPos, playerYaw);
      this._playOneShot(SOUNDS.monsterGrowl, {
        volume: MONSTER_GROWL_VOLUME * 0.82,
        pan: pan * 0.7,
      });
    }, SPAWN_DOUBLE_GROWL_DELAY * 1000);
  }

  _clearDoubleGrowl() {
    if (this._doubleGrowlTimeout != null) {
      clearTimeout(this._doubleGrowlTimeout);
      this._doubleGrowlTimeout = null;
    }
  }

  async _ensureContext() {
    if (!this._ctx) {
      this._ctx = new AudioContext();
      this._master = this._ctx.createGain();
      this._master.gain.value = 1;
      this._master.connect(this._ctx.destination);
    }

    if (this._ctx.state === "suspended") {
      await this._ctx.resume();
    }
  }

  async _preloadAll() {
    const urls = [...new Set(Object.values(SOUNDS))];
    await Promise.all(urls.map((url) => this._loadBuffer(url)));
  }

  async _loadBuffer(url) {
    if (this._buffers.has(url)) return this._buffers.get(url);

    const response = await fetch(url);
    const data = await response.arrayBuffer();
    const buffer = await this._ctx.decodeAudioData(data);
    this._buffers.set(url, buffer);
    return buffer;
  }

  _playOneShot(url, { volume = 1, pan = 0 }) {
    if (!this._ctx || !this._unlocked) return;

    const buffer = this._buffers.get(url);
    if (!buffer) {
      void this._loadBuffer(url).then(() =>
        this._playOneShot(url, { volume, pan }),
      );
      return;
    }

    const source = this._ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this._ctx.createGain();
    gain.gain.value = volume;

    const panner = this._ctx.createStereoPanner();
    panner.pan.value = pan;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(this._master);
    source.start(0);
  }

  async _startLoop(key, url, volume, pan) {
    await this._ensureContext();
    this._stopLoop(key);

    const buffer = await this._loadBuffer(url);
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this._ctx.createGain();
    gain.gain.value = volume;

    const panner = this._ctx.createStereoPanner();
    panner.pan.value = pan;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(this._master);
    source.start(0);

    this._loops.set(key, { source, gain, panner });
  }

  _stopLoop(key) {
    const loop = this._loops.get(key);
    if (!loop) return;
    try {
      loop.source.stop();
    } catch {
      /* already stopped */
    }
    this._loops.delete(key);
  }

  async _startHeartbeat() {
    if (this._heartbeatPlaying) return;
    await this._ensureContext();

    const buffer = await this._loadBuffer(SOUNDS.heartbeat);
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this._ctx.createGain();
    gain.gain.value = HEARTBEAT_VOLUME;

    const panner = this._ctx.createStereoPanner();
    panner.pan.value = 0;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(this._master);
    source.start(0);

    this._heartbeatSource = source;
    this._heartbeatGain = gain;
    this._heartbeatPlaying = true;
  }

  _stopHeartbeat() {
    if (!this._heartbeatPlaying || !this._heartbeatSource) return;
    try {
      this._heartbeatSource.stop();
    } catch {
      /* already stopped */
    }
    this._heartbeatSource = null;
    this._heartbeatGain = null;
    this._heartbeatPlaying = false;
  }
}

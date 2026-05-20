import * as THREE from "three";
import {
  PARTNER_Z_JITTER,
  RETREAT_COOLDOWN,
  SPAWN_OFFSET_MAX,
  SPAWN_OFFSET_MIN,
  STALK_MALFUNCTION_CHANCE,
  STALK_MIN_Z_GAP,
  WOLF_TREE_CLEARANCE,
} from "./wolfEncounterConfig.js";
import { rollEncounterParams } from "./encounterRoll.js";
import { getThreatEscalation } from "./threatEscalation.js";
import {
  computeStalkPosition,
  ENCOUNTER_STATE,
  hasPlayerPassedWolf,
  horizontalDistanceXZ,
  isWithinAttackRange,
  isWithinIlluminationRange,
  isWolfIlluminated,
  SLOT_STATE,
  stepActiveEncounter,
} from "./wolfEncounterLogic.js";
import { isPointInSpotlight } from "../utils/spotlightHit.js";

const _wolfPoint = new THREE.Vector3();
const _aimPoint = new THREE.Vector3();

function createSlot(monster) {
  return {
    monster,
    state: SLOT_STATE.hidden,
    illuminationTimer: 0,
    attackTimer: 0,
    unilluminatedTimer: 0,
    isStalking: false,
    identified: false,
    illuminationTime: 0.7,
    stalkMalfunctionTriggered: false,
    atStalkLimit: false,
  };
}

/**
 * Wolf encounter(s) beside the path — supports solo or partner (dual flank) spawns.
 */
export class WolfEncounter {
  /**
   * @param {import("../entities/WolfMonster.js").WolfMonster} wolf
   * @param {import("../entities/WolfMonster.js").WolfMonster} partnerWolf
   */
  constructor(wolf, partnerWolf, flashlight, forest, gameState, audio = null) {
    this.slots = [createSlot(wolf), createSlot(partnerWolf)];
    this.flashlight = flashlight;
    this.forest = forest;
    this.gameState = gameState;
    this.audio = audio;

    this.state = ENCOUNTER_STATE.cooldown;
    this._cooldownTimer = 1;
    this._params = null;
    this._lastSpawnSide = null;
    this._attackingSlot = null;

    /** @type {((monster: import("../entities/WolfMonster.js").WolfMonster) => void) | null} */
    this.onJumpScareBegin = null;
    /** @type {((monster: import("../entities/WolfMonster.js").WolfMonster) => void) | null} */
    this.onJumpScarePeak = null;

    for (const slot of this.slots) {
      slot.monster.onMoveBackFinished = () =>
        this._onSlotRetreatFinished(slot);
      slot.monster.onJumpScareBegin = () =>
        this.onJumpScareBegin?.(slot.monster);
      slot.monster.onJumpScareComplete = () => this._onJumpScareComplete();
      slot.monster.onJumpScarePeak = () => this._onJumpScarePeak(slot);
    }
  }

  /** @param {import("../entities/WolfMonster.js").WolfMonster} monster */
  isAttackingMonster(monster) {
    return this._attackingSlot?.monster === monster;
  }

  _onJumpScarePeak(slot) {
    if (this.state !== ENCOUNTER_STATE.attacking) return;
    if (this._attackingSlot !== slot) return;
    if (this.gameState.isGameOver || !this.gameState.isPlaying) return;
    this.onJumpScarePeak?.(slot.monster);
  }

  get isWolfActive() {
    return this.slots.some((s) => s.state === SLOT_STATE.active);
  }

  get blocksSilhouette() {
    return (
      this.isWolfActive ||
      this.slots.some((s) => s.state === SLOT_STATE.retreating) ||
      this.state === ENCOUNTER_STATE.attacking
    );
  }

  _activeSlots() {
    return this.slots.filter((s) => s.state === SLOT_STATE.active);
  }

  _slotSide(slot) {
    const x = slot.monster.model.position.x;
    return x < 0 ? -1 : 1;
  }

  _getHeardSlot() {
    if (!this._params?.heardSide) {
      return this._nearestActiveSlot();
    }
    const heard = this._activeSlots().find(
      (s) => this._slotSide(s) === this._params.heardSide,
    );
    return heard ?? this._nearestActiveSlot() ?? this.slots[0];
  }

  _nearestActiveSlot() {
    const active = this._activeSlots();
    if (active.length === 0) return null;
    if (active.length === 1) return active[0];

    let best = active[0];
    let bestDist = Infinity;
    const playerPos = this._lastPlayerPos;
    if (!playerPos) return active[0];

    for (const slot of active) {
      const d = horizontalDistanceXZ(playerPos, slot.monster.model.position);
      if (d < bestDist) {
        bestDist = d;
        best = slot;
      }
    }
    return best;
  }

  getAudioSnapshot(playerPosition, camera) {
    this._lastPlayerPos = playerPosition;

    const active = this._activeSlots();
    if (active.length === 0) {
      return {
        wolfPresent: false,
        wolfPos: null,
        wolfNearby: false,
        wolfInSpotlight: false,
        wolfIdentified: false,
        wolfIlluminatedInRange: false,
        wolfStalking: false,
        wolfAtStalkLimit: false,
        isPartnerEncounter: false,
      };
    }

    const heard = this._getHeardSlot();
    const heardPos = heard.monster.model.position;
    const heardInSpotlight = this._isMonsterInSpotlight(
      heard.monster,
      playerPosition,
      camera,
    );
    const heardInRange = isWithinIlluminationRange(playerPosition, heardPos);

    const anyInSpotlight = active.some((s) =>
      this._isMonsterInSpotlight(s.monster, playerPosition, camera),
    );
    const anyStalking = active.some((s) => s.isStalking);
    const anyAtLimit = active.some((s) => s.atStalkLimit);
    const anyNearby = active.some((s) =>
      isWithinAttackRange(playerPosition, s.monster.model.position),
    );
    const anyIdentified = active.some((s) => s.identified);

    const heardIlluminated = isWolfIlluminated({
      playerPos: playerPosition,
      wolfPos: heardPos,
      wolfVisible: true,
      flashlightOn: this.flashlight.isOn,
      beamLit: this.flashlight.isBeamLit,
      inSpotlight: heardInSpotlight,
    });

    return {
      wolfPresent: true,
      wolfPos: { x: heardPos.x, z: heardPos.z },
      wolfNearby: anyNearby,
      wolfInSpotlight: anyInSpotlight,
      wolfIdentified: anyIdentified,
      wolfIlluminatedInRange: heardIlluminated && heardInRange,
      wolfStalking: anyStalking,
      wolfAtStalkLimit: anyAtLimit,
      isPartnerEncounter: Boolean(this._params?.isPartnerEncounter),
    };
  }

  reset() {
    this.state = ENCOUNTER_STATE.cooldown;
    this._cooldownTimer = 1;
    this._params = null;
    this._lastSpawnSide = null;
    this._attackingSlot = null;

    for (const slot of this.slots) {
      slot.state = SLOT_STATE.hidden;
      slot.illuminationTimer = 0;
      slot.attackTimer = 0;
      slot.unilluminatedTimer = 0;
      slot.isStalking = false;
      slot.identified = false;
      slot.stalkMalfunctionTriggered = false;
      slot.atStalkLimit = false;
      slot.monster.hide();
    }

    this.flashlight?.setThreatDrainMultiplier(1);
  }

  update(delta, playerPosition, camera, playerYaw = 0, conductPressure = 0) {
    if (this.gameState.isGameOver || !this.gameState.isPlaying) return;

    this._lastPlayerPos = playerPosition;
    const escalation = getThreatEscalation(this.gameState.survivalTime);
    const threatDelta = delta * (1 + conductPressure * 1.85);

    if (this.state === ENCOUNTER_STATE.cooldown) {
      this._cooldownTimer -= threatDelta;
      if (this._cooldownTimer <= 0) {
        this._spawnAhead(playerPosition, playerYaw, conductPressure);
      }
      return;
    }

    if (this.state === ENCOUNTER_STATE.attacking) {
      return;
    }

    const active = this._activeSlots();
    if (active.length === 0) {
      this.state = ENCOUNTER_STATE.cooldown;
      this._cooldownTimer = this._params?.retreatCooldown ?? RETREAT_COOLDOWN;
      return;
    }

    let anyNearby = false;

    for (const slot of active) {
      const wolfPos = slot.monster.model.position;

      if (hasPlayerPassedWolf(playerPosition, wolfPos)) {
        if (
          this._params?.passByReappearChance != null &&
          Math.random() < this._params.passByReappearChance
        ) {
          this._reappearAhead(playerPosition, playerYaw, camera);
        } else {
          this._triggerJumpScare(slot, playerPosition, camera);
        }
        return;
      }

      const inSpotlight = this._isMonsterInSpotlight(
        slot.monster,
        playerPosition,
        camera,
      );

      const step = stepActiveEncounter(
        {
          illuminationTimer: slot.illuminationTimer,
          attackTimer: slot.attackTimer,
          unilluminatedTimer: slot.unilluminatedTimer,
          isStalking: slot.isStalking,
        },
        {
          playerPos: playerPosition,
          wolfPos,
          wolfVisible: true,
          flashlightOn: this.flashlight.isOn,
          beamLit: this.flashlight.isBeamLit,
          inSpotlight,
          flashlightLowBattery: this.flashlight.isBatteryLow,
          flashlightMalfunctioning: this.flashlight.isMalfunctioning,
          stalkDelay: this._params?.stalkDelay,
          attackTime: this._params?.attackTime,
          illuminationTime: slot.illuminationTime,
        },
        threatDelta,
      );

      const wasStalking = slot.isStalking;
      slot.illuminationTimer = step.illuminationTimer;
      slot.attackTimer = step.attackTimer;
      slot.unilluminatedTimer = step.unilluminatedTimer;
      slot.isStalking = step.isStalking;

      if (slot.illuminationTimer > 0) {
        slot.identified = true;
      }

      if (step.isStalking && !slot.stalkMalfunctionTriggered) {
        slot.stalkMalfunctionTriggered = true;
        if (Math.random() < STALK_MALFUNCTION_CHANCE) {
          this.flashlight.triggerStalkMalfunction();
        }
      }

      if (step.isStalking) {
        const moved = this._moveSlotStalk(slot, playerPosition, delta);
        const zGap = playerPosition.z - slot.monster.model.position.z;
        const creeping = moved && zGap <= STALK_MIN_Z_GAP;
        slot.atStalkLimit = !moved;
        if (moved) {
          slot.monster.playWalk(creeping);
        } else {
          slot.monster.playIdle();
        }
      } else {
        slot.atStalkLimit = false;
        if (wasStalking) {
          slot.monster.playIdle();
        }
      }

      if (isWithinAttackRange(playerPosition, wolfPos)) {
        anyNearby = true;
      }

      if (step.events.includes("retreat")) {
        this._triggerSlotRetreat(slot, playerPosition, playerYaw);
      } else if (step.events.includes("attack")) {
        this._triggerJumpScare(slot, playerPosition, camera);
        return;
      }
    }

    const conductDrain = 1 + conductPressure * 0.65;
    const threatDrain = anyNearby
      ? escalation.batteryDrainMult * 1.35 * conductDrain
      : escalation.batteryDrainMult * conductDrain;
    this.flashlight?.setThreatDrainMultiplier(threatDrain);
  }

  _isMonsterInSpotlight(monster, playerPosition, camera) {
    if (!this.flashlight.isOn || !monster.model.visible || !camera) {
      return false;
    }

    monster.model.getWorldPosition(_wolfPoint);
    _aimPoint.set(
      _wolfPoint.x,
      playerPosition.y - 0.15,
      _wolfPoint.z,
    );

    return isPointInSpotlight(_aimPoint, this.flashlight.light, camera);
  }

  _triggerJumpScare(slot, playerPosition, camera) {
    if (this.state === ENCOUNTER_STATE.attacking) return;
    if (this.gameState.isGameOver || !this.gameState.isPlaying) return;

    this.state = ENCOUNTER_STATE.attacking;
    this._attackingSlot = slot;

    for (const s of this.slots) {
      if (s !== slot && s.state === SLOT_STATE.active) {
        s.state = SLOT_STATE.hidden;
        s.monster.hide();
        s.isStalking = false;
      }
    }

    slot.isStalking = false;
    slot.monster.playJumpScare(playerPosition, camera);
  }

  _onJumpScareComplete() {
    if (this.state !== ENCOUNTER_STATE.attacking) return;

    if (!this.gameState.isGameOver) {
      this.gameState.triggerGameOver();
    }

    this.state = ENCOUNTER_STATE.cooldown;
    this._cooldownTimer = this._params?.retreatCooldown ?? RETREAT_COOLDOWN;
    this._attackingSlot = null;

    for (const slot of this.slots) {
      slot.state = SLOT_STATE.hidden;
      slot.monster.hide();
    }
  }

  _spawnAhead(playerPosition, playerYaw, conductPressure = 0) {
    this._params = rollEncounterParams(
      this.gameState.survivalTime,
      this._lastSpawnSide,
    );

    if (conductPressure > 0.55) {
      this._params.spawnAheadMin *= 0.55 + (1 - conductPressure) * 0.35;
      this._params.spawnAheadMax *= 0.65 + (1 - conductPressure) * 0.25;
    }

    if (this._params.isPartnerEncounter) {
      if (this._trySpawnPartners(playerPosition, playerYaw)) {
        return;
      }
    }

    this._trySpawnSolo(playerPosition, playerYaw);
  }

  _trySpawnPartners(playerPosition, playerYaw) {
    const aheadMin = this._params.spawnAheadMin;
    const aheadMax = this._params.spawnAheadMax;
    const ahead = aheadMin + Math.random() * (aheadMax - aheadMin);
    const zBase = playerPosition.z - ahead;

    for (let attempt = 0; attempt < 20; attempt++) {
      const zJitter = (Math.random() - 0.5) * PARTNER_Z_JITTER;
      const z = zBase + zJitter;
      const offsetL =
        SPAWN_OFFSET_MIN +
        Math.random() * (SPAWN_OFFSET_MAX - SPAWN_OFFSET_MIN);
      const offsetR =
        SPAWN_OFFSET_MIN +
        Math.random() * (SPAWN_OFFSET_MAX - SPAWN_OFFSET_MIN);

      const xL = -offsetL;
      const xR = offsetR;

      if (
        this.forest.isClearOfTrees(xL, z, WOLF_TREE_CLEARANCE) &&
        this.forest.isClearOfTrees(xR, z, WOLF_TREE_CLEARANCE)
      ) {
        this._activatePartnerEncounter(xL, xR, z, playerPosition, playerYaw);
        return true;
      }
    }

    return false;
  }

  _activatePartnerEncounter(xL, xR, z, playerPosition, playerYaw) {
    const [leftSlot, rightSlot] = this.slots;

    leftSlot.monster.spawnAt(xL, z);
    rightSlot.monster.spawnAt(xR, z);

    leftSlot.state = SLOT_STATE.active;
    rightSlot.state = SLOT_STATE.active;

    leftSlot.illuminationTime = this._params.illuminationTime;
    rightSlot.illuminationTime = this._params.partnerIlluminationTime;

    this._resetSlotTimers(leftSlot);
    this._resetSlotTimers(rightSlot);

    this.state = ENCOUNTER_STATE.active;
    this._lastSpawnSide = null;

    const heardPos =
      this._params.heardSide < 0
        ? leftSlot.monster.model.position
        : rightSlot.monster.model.position;

    this.audio?.onWolfSpawn(heardPos, playerPosition, playerYaw, {
      silent: this._params.silentSpawn,
      doubleTension: this._params.doubleTension,
      partnerEncounter: true,
    });
  }

  _trySpawnSolo(playerPosition, playerYaw) {
    const aheadMin = this._params.spawnAheadMin;
    const aheadMax = this._params.spawnAheadMax;
    const maxAttempts = 24;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const side = this._params.side ?? (Math.random() < 0.5 ? -1 : 1);
      const offset =
        SPAWN_OFFSET_MIN +
        Math.random() * (SPAWN_OFFSET_MAX - SPAWN_OFFSET_MIN);
      const ahead = aheadMin + Math.random() * (aheadMax - aheadMin);
      const zJitter = attempt > 12 ? (attempt - 12) * 1.5 : 0;

      const x = side * offset;
      const z = playerPosition.z - ahead - zJitter;

      if (this.forest.isClearOfTrees(x, z, WOLF_TREE_CLEARANCE)) {
        this._activateSoloEncounter(x, z, side, playerPosition, playerYaw);
        return;
      }
    }

    const zBase = playerPosition.z - (aheadMin + aheadMax) * 0.5;
    const side = this._params.side ?? -1;

    for (const trySide of [side, -side]) {
      for (let j = 0; j < 6; j++) {
        const x = trySide * SPAWN_OFFSET_MAX;
        const z = zBase - j * 2;
        if (this.forest.isClearOfTrees(x, z, WOLF_TREE_CLEARANCE)) {
          this._activateSoloEncounter(x, z, trySide, playerPosition, playerYaw);
          return;
        }
      }
    }

    this._cooldownTimer = 0.75;
  }

  _activateSoloEncounter(x, z, side, playerPosition, playerYaw) {
    const [primary, partner] = this.slots;

    primary.monster.spawnAt(x, z);
    primary.state = SLOT_STATE.active;
    primary.illuminationTime = this._params.illuminationTime;
    this._resetSlotTimers(primary);

    partner.state = SLOT_STATE.hidden;
    partner.monster.hide();
    this._resetSlotTimers(partner);

    this.state = ENCOUNTER_STATE.active;
    this._lastSpawnSide = side;

    this.audio?.onWolfSpawn(
      primary.monster.model.position,
      playerPosition,
      playerYaw,
      {
        silent: this._params.silentSpawn,
        doubleTension: this._params.doubleTension,
        partnerEncounter: false,
      },
    );
  }

  _resetSlotTimers(slot) {
    slot.illuminationTimer = 0;
    slot.attackTimer = 0;
    slot.unilluminatedTimer = 0;
    slot.isStalking = false;
    slot.identified = false;
    slot.stalkMalfunctionTriggered = false;
    slot.atStalkLimit = false;
  }

  _reappearAhead(playerPosition, playerYaw, camera) {
    for (const slot of this.slots) {
      if (slot.state === SLOT_STATE.active) {
        slot.state = SLOT_STATE.hidden;
        slot.monster.hide();
      }
    }

    const side = this._lastSpawnSide ?? (Math.random() < 0.5 ? -1 : 1);
    const offset =
      SPAWN_OFFSET_MIN + Math.random() * (SPAWN_OFFSET_MAX - SPAWN_OFFSET_MIN);
    const ahead = 10 + Math.random() * 6;
    const x = side * offset;
    const z = playerPosition.z - ahead;

    if (!this.forest.isClearOfTrees(x, z, WOLF_TREE_CLEARANCE)) {
      const slot = this.slots[0];
      slot.monster.spawnAt(x, z);
      slot.state = SLOT_STATE.active;
      this._triggerJumpScare(slot, playerPosition, camera);
      return;
    }

    this._activateSoloEncounter(x, z, side, playerPosition, playerYaw);
    const slot = this.slots[0];
    slot.attackTimer = 2.5;
    slot.identified = true;

    this.audio?.onWolfReappear(
      slot.monster.model.position,
      playerPosition,
      playerYaw,
    );
  }

  _moveSlotStalk(slot, playerPosition, delta) {
    const wolf = slot.monster.model;
    const stalkSpeedMult = this._params?.stalkSpeedMult ?? 1;

    const next = computeStalkPosition(wolf.position, playerPosition, delta, {
      stalkSpeedMult,
    });
    if (!next) return false;

    wolf.position.z = next.z;
    slot.monster.facePlayer(playerPosition);
    return true;
  }

  _triggerSlotRetreat(slot, playerPosition, playerYaw) {
    if (slot.state !== SLOT_STATE.active) return;

    slot.state = SLOT_STATE.retreating;
    slot.illuminationTimer = 0;
    slot.attackTimer = 0;
    slot.unilluminatedTimer = 0;
    slot.isStalking = false;

    this.audio?.onWolfRetreat(
      slot.monster.model.position,
      playerPosition,
      playerYaw,
    );
    slot.monster.playMoveBack();
  }

  _onSlotRetreatFinished(slot) {
    if (slot.state !== SLOT_STATE.retreating) return;

    slot.monster.hide();
    slot.state = SLOT_STATE.hidden;

    if (this._activeSlots().length === 0) {
      this.state = ENCOUNTER_STATE.cooldown;
      this._cooldownTimer =
        this._params?.retreatCooldown ?? RETREAT_COOLDOWN;
    }
  }

}

/** @param {THREE.Vector3} playerPosition @param {THREE.Vector3} wolfPosition */
export function debugEncounterDistance(playerPosition, wolfPosition) {
  return horizontalDistanceXZ(playerPosition, wolfPosition);
}

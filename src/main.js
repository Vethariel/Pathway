import * as THREE from "three";
import { WolfMonster } from "./entities/WolfMonster.js";
import { formatSurvivalTime, GameState } from "./game/GameState.js";
import { WolfEncounter } from "./game/WolfEncounter.js";
import { Flashlight } from "./player/Flashlight.js";
import { JumpScareCamera } from "./player/JumpScareCamera.js";
import { PlayerConduct } from "./player/PlayerConduct.js";
import {
  CORRIDOR_HALF_WIDTH,
  PLAYER_BACKWARD_LIMIT_Z,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Y,
  PLAYER_SPAWN_Z,
} from "./scene/corridorConfig.js";
import { GameAudio } from "./audio/GameAudio.js";
import { applyEnvironmentFog, enableFogOnMaterials } from "./scene/applyEnvironmentFog.js";
import { ForestEnvironment } from "./scene/ForestEnvironment.js";
import { FogSilhouette } from "./scene/FogSilhouette.js";

const app = document.getElementById("app");
const menuEl = document.getElementById("menu");
const hudEl = document.getElementById("hud");
const hudTimeEl = document.getElementById("hud-time");
const gameOverEl = document.getElementById("game-over");
const finalTimeEl = document.getElementById("final-time");
const finalBestEl = document.getElementById("final-best");
const menuBestEl = document.getElementById("menu-best");
const menuBestValueEl = document.getElementById("menu-best-value");
const btnStart = document.getElementById("btn-start");
const btnRetry = document.getElementById("btn-retry");
const btnCredits = document.getElementById("btn-credits");
const btnCreditsClose = document.getElementById("btn-credits-close");
const creditsEl = document.getElementById("credits");
const loadErrorEl = document.getElementById("load-error");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.58;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
applyEnvironmentFog(scene, renderer);

const player = new THREE.Group();
player.position.set(PLAYER_SPAWN_X, PLAYER_SPAWN_Y, PLAYER_SPAWN_Z);
scene.add(player);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  500,
);
player.add(camera);

let pitch = 0;
const mouseSensitivity = 0.002;
const maxPitch = Math.PI / 2 - 0.08;

const flashlight = new Flashlight(camera);
const jumpScareCamera = new JumpScareCamera({ maxPitch });
const gameState = new GameState();
const gameAudio = new GameAudio();
const playerConduct = new PlayerConduct();

function updateBestTimeDisplays() {
  if (gameState.bestTime > 0) {
    menuBestEl.hidden = false;
    menuBestValueEl.textContent = formatSurvivalTime(gameState.bestTime);
  } else {
    menuBestEl.hidden = true;
  }
}

function showMenu() {
  gameAudio.stopAmbient();
  menuEl.hidden = false;
  creditsEl.hidden = true;
  hudEl.hidden = true;
  gameOverEl.hidden = true;
  updateBestTimeDisplays();
}

function showCredits() {
  creditsEl.hidden = false;
  menuEl.hidden = true;
}

async function beginRun() {
  await gameAudio.unlock();
  gameState.startRun();
  resetPlayer();
  wolfEncounter?.reset();
  fogSilhouette?.reset();
  playerConduct.reset();
  flashlight.reset();
  jumpScareCamera.reset();
  gameAudio.reset();
  menuEl.hidden = true;
  gameOverEl.hidden = true;
  hudEl.hidden = false;
  hudTimeEl.textContent = formatSurvivalTime(0);
  await gameAudio.startAmbient();
  renderer.domElement.requestPointerLock();
}

function resetPlayer() {
  player.position.set(PLAYER_SPAWN_X, PLAYER_SPAWN_Y, PLAYER_SPAWN_Z);
  pitch = 0;
  camera.rotation.x = 0;
  player.rotation.y = 0;
}

showMenu();
updateBestTimeDisplays();

btnStart.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!assetsReady) return;
  void beginRun();
});

btnCredits.addEventListener("click", (e) => {
  e.stopPropagation();
  showCredits();
});

btnCreditsClose.addEventListener("click", (e) => {
  e.stopPropagation();
  showMenu();
});

btnRetry.addEventListener("click", () => {
  gameState.reset();
  forest.update(player.position);
  void beginRun();
});

renderer.domElement.addEventListener("click", () => {
  if (gameState.isGameOver || !gameState.isPlaying) return;
  renderer.domElement.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  if (!gameState.isPlaying || gameState.isGameOver) return;

  if (document.pointerLockElement === renderer.domElement) {
    gameState.resumeTimer();
  } else {
    gameState.pauseTimer();
  }
});

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (gameState.isGameOver || jumpScareCamera.blocksInput()) return;

  player.rotateY(-e.movementX * mouseSensitivity);
  pitch = THREE.MathUtils.clamp(
    pitch - e.movementY * mouseSensitivity,
    -maxPitch,
    maxPitch,
  );
  camera.rotation.x = pitch;
});

const ambient = new THREE.HemisphereLight(0x283038, 0x0a0c0a, 0.18);
scene.add(ambient);

const moon = new THREE.DirectionalLight(0x7a8a9a, 0.4);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 0.5;
moon.shadow.camera.far = 160;
moon.shadow.camera.left = -45;
moon.shadow.camera.right = 45;
moon.shadow.camera.top = 45;
moon.shadow.camera.bottom = -45;
moon.shadow.bias = -0.0002;
scene.add(moon);
scene.add(moon.target);

const forest = new ForestEnvironment();
const wolf = new WolfMonster();
const partnerWolf = new WolfMonster();
const fogSilhouette = new FogSilhouette(scene);
let wolfEncounter = null;
let assetsReady = false;

const loading = Promise.all([
  forest.load(),
  wolf.load(),
  partnerWolf.load(),
]).then(() => {
  enableFogOnMaterials(forest.group);
  enableFogOnMaterials(wolf.model);
  enableFogOnMaterials(partnerWolf.model);
  scene.add(forest.group);
  scene.add(wolf.model);
  scene.add(partnerWolf.model);
  forest.update(player.position);
  wolfEncounter = new WolfEncounter(
    wolf,
    partnerWolf,
    flashlight,
    forest,
    gameState,
    gameAudio,
  );
  wolfEncounter.reset();
  assetsReady = true;

  wolfEncounter.onJumpScareBegin = (monster) => {
    if (!gameState.isPlaying || gameState.isGameOver) return;
    const pos = monster.model.visible
      ? { x: monster.model.position.x, z: monster.model.position.z }
      : null;
    gameAudio.onJumpScare(pos, player.position, player.rotation.y);
    document.exitPointerLock();
    jumpScareCamera.begin(player, camera, (face) =>
      monster.getJumpScareFaceWorld(face),
    );
  };

  wolfEncounter.onJumpScarePeak = () => {
    if (!gameState.isPlaying || gameState.isGameOver) return;
    jumpScareCamera.lock();
    gameState.triggerGameOver();
  };
});

gameState.onGameOver(() => {
  gameAudio.stopAmbient();
  document.exitPointerLock();
  hudEl.hidden = true;

  finalTimeEl.textContent = formatSurvivalTime(gameState.survivalTime);
  if (gameState.bestTime > 0) {
    finalBestEl.textContent = `Best — ${formatSurvivalTime(gameState.bestTime)}`;
    finalBestEl.hidden = false;
  } else {
    finalBestEl.hidden = true;
  }

  gameOverEl.hidden = false;
});

const keys = new Set();
const forwardSpeed = 4.5;
const backwardSpeed = 1.5;
let playerIsMoving = false;
let playerMovingForward = false;
let playerMovingBackward = false;

document.addEventListener("keydown", (e) => {
  keys.add(e.code);

  if (gameState.isGameOver || jumpScareCamera.blocksInput()) return;
  if (!gameState.isPlaying) return;

  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    flashlight.toggle();
  }
});

document.addEventListener("keyup", (e) => keys.delete(e.code));

const clock = new THREE.Clock();

function updateMovement(delta) {
  playerIsMoving = false;
  playerMovingForward = false;
  playerMovingBackward = false;

  if (gameState.isGameOver || jumpScareCamera.blocksInput()) return;
  if (!gameState.isPlaying) return;
  if (document.pointerLockElement !== renderer.domElement) return;

  if (keys.has("KeyW") || keys.has("ArrowUp")) {
    player.position.z -= forwardSpeed * delta;
    playerIsMoving = true;
    playerMovingForward = true;
  }
  if (keys.has("KeyS") || keys.has("ArrowDown")) {
    player.position.z = Math.min(
      player.position.z + backwardSpeed * delta,
      PLAYER_BACKWARD_LIMIT_Z,
    );
    playerIsMoving = true;
    playerMovingBackward = true;
  }

  player.position.x = THREE.MathUtils.clamp(
    player.position.x,
    -CORRIDOR_HALF_WIDTH + 0.15,
    CORRIDOR_HALF_WIDTH - 0.15,
  );
}

function updateLighting() {
  const { x, y, z } = player.position;
  moon.position.set(x - 25, y + 48, z - 18);
  moon.target.position.set(x, 0, z);
  moon.target.updateMatrixWorld();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  updateMovement(delta);
  updateLighting();
  forest.update(player.position);

  const wolfAudioSnapshot =
    gameState.isPlaying && !gameState.isGameOver
      ? (wolfEncounter?.getAudioSnapshot(player.position, camera) ?? {
          wolfIlluminatedInRange: false,
        })
      : { wolfIlluminatedInRange: false };

  let conductPressure = 0;
  if (
    gameState.isPlaying &&
    !gameState.isGameOver &&
    document.pointerLockElement === renderer.domElement
  ) {
    conductPressure = playerConduct.update(delta, player.position.z, {
      movingForward: playerMovingForward,
      movingBackward: playerMovingBackward,
      illuminatingWolf: wolfAudioSnapshot.wolfIlluminatedInRange,
    });
  }

  const survivalScale =
    gameState.isPlaying && !gameState.isGameOver
      ? playerConduct.survivalTimeScale
      : 1;
  gameState.update(delta, survivalScale);

  if (gameState.isPlaying && !gameState.isGameOver) {
    hudTimeEl.textContent = formatSurvivalTime(gameState.survivalTime);
  }

  if (gameState.isPlaying && !gameState.isGameOver) {
    flashlight.update(delta);
    wolfEncounter?.update(
      delta,
      player.position,
      camera,
      player.rotation.y,
      conductPressure,
    );
    wolf.update(delta, player.position, camera);
    partnerWolf.update(delta, player.position, camera);

    fogSilhouette.update(
      delta,
      player.position,
      player.rotation.y,
      camera,
      flashlight,
      wolfEncounter?.blocksSilhouette ?? false,
    );

    const wolfAudio = wolfEncounter?.getAudioSnapshot(
      player.position,
      camera,
    ) ?? {
      wolfPresent: false,
      wolfPos: null,
      wolfNearby: false,
      wolfInSpotlight: false,
      wolfIdentified: false,
      wolfIlluminatedInRange: false,
    };

    gameAudio.update(delta, {
      isPlaying: true,
      playerPos: player.position,
      playerYaw: player.rotation.y,
      isMoving: playerIsMoving,
      wolfPresent: wolfAudio.wolfPresent,
      wolfPos: wolfAudio.wolfPos,
      wolfNearby: wolfAudio.wolfNearby,
      wolfInSpotlight: wolfAudio.wolfInSpotlight,
      wolfIdentified: wolfAudio.wolfIdentified,
      wolfIlluminatedInRange: wolfAudio.wolfIlluminatedInRange,
      wolfStalking: wolfAudio.wolfStalking ?? false,
      wolfAtStalkLimit: wolfAudio.wolfAtStalkLimit ?? false,
      flashlightOn: flashlight.isOn,
      flashlightMalfunctioning: flashlight.isMalfunctioning,
    });
  }

  if (gameState.isPlaying && !gameState.isGameOver) {
    const scareCam = jumpScareCamera.update(delta);
    if (scareCam) {
      pitch = scareCam.pitch;
    }
  }

  renderer.render(scene, camera);
}

animate();

loading.catch((err) => {
  console.error(err);
  loadErrorEl.hidden = false;
  btnStart.disabled = true;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const BEST_TIME_KEY = "pathway-best-survival";
const RUN_COUNT_KEY = "pathway-run-count";

/**
 * Run / game-over state and survival time scoring.
 */
export class GameState {
  constructor() {
    this.isGameOver = false;
    this.isPlaying = false;
    this.isTimerPaused = false;
    this.survivalTime = 0;
    this.bestTime = GameState.loadBestTime();
    this.runCount = GameState.loadRunCount();
    this._listeners = new Set();
  }

  static loadBestTime() {
    const raw = localStorage.getItem(BEST_TIME_KEY);
    const value = raw ? parseFloat(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  }

  static loadRunCount() {
    const raw = localStorage.getItem(RUN_COUNT_KEY);
    const value = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(value) ? value : 0;
  }

  get isVeteranPlayer() {
    return this.runCount >= 2;
  }

  startRun() {
    this.isGameOver = false;
    this.isPlaying = true;
    this.isTimerPaused = false;
    this.survivalTime = 0;
    this.runCount += 1;
    localStorage.setItem(RUN_COUNT_KEY, String(this.runCount));
  }

  pauseTimer() {
    this.isTimerPaused = true;
  }

  resumeTimer() {
    if (this.isPlaying && !this.isGameOver) {
      this.isTimerPaused = false;
    }
  }

  /**
   * @param {number} delta
   * @param {number} [timeScale] 0–1 slows survival gain when stalling (default 1)
   */
  update(delta, timeScale = 1) {
    if (!this.isPlaying || this.isGameOver || this.isTimerPaused) return;
    this.survivalTime += delta * Math.max(0, timeScale);
  }

  onGameOver(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isPlaying = false;
    this.isTimerPaused = false;

    if (this.survivalTime > this.bestTime) {
      this.bestTime = this.survivalTime;
      localStorage.setItem(BEST_TIME_KEY, String(this.bestTime));
    }

    for (const listener of this._listeners) {
      listener();
    }
  }

  reset() {
    this.isGameOver = false;
    this.isPlaying = false;
    this.isTimerPaused = false;
    this.survivalTime = 0;
  }
}

/** @param {number} seconds */
export function formatSurvivalTime(seconds) {
  const total = Math.max(0, seconds);
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  const tenths = Math.floor((total % 1) * 10);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${secs}.${tenths}s`;
}

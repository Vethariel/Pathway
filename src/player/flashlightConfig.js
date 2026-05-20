/** Seconds of continuous use from full charge to dead. */
export const BATTERY_LIFETIME = 80;

/** Full charge beam (intensity, cone half-angle radians, range). */
export const BEAM_INTENSITY_MAX = 22;
export const BEAM_ANGLE_MAX = Math.PI / 5.2;
export const BEAM_DISTANCE_MAX = 34;

/** Nearly dead beam before shutoff. */
export const BEAM_INTENSITY_MIN = 0.35;
export const BEAM_ANGLE_MIN = Math.PI / 14;
export const BEAM_DISTANCE_MIN = 9;

export const LENS_EMISSIVE = 0xfff2cc;
export const LENS_EMISSIVE_MAX = 1.5;

/** Below this charge, wolf attack timer only bleeds (not full reset) while lit. */
export const BATTERY_LOW_THRESHOLD = 0.22;

/** Continuous on-time before internal blink malfunction starts (rolled per run). */
export const ON_TIME_BEFORE_BLINK = 5;
export const ON_TIME_BEFORE_BLINK_MIN = 4;
export const ON_TIME_BEFORE_BLINK_MAX = 8;

/** Continuous off-time to clear malfunction (battery unchanged). */
export const OFF_TIME_TO_RECOVER = 10;

/** Extra drain multiplier when wolf is in attack range (set by encounter). */
export const THREAT_BATTERY_DRAIN_MAX = 2.2;

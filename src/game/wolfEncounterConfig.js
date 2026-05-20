/** Lateral distance from corridor centerline (world X). */
export const SPAWN_OFFSET_MIN = 4.5;
export const SPAWN_OFFSET_MAX = 5.5;

/** Min distance from a tree trunk center when spawning the wolf. */
export const WOLF_TREE_CLEARANCE = 2.4;

/** Flashlight only counts inside this range from the player (world units). */
export const ILLUMINATION_RANGE = 7;

/** How far ahead of the player (-Z) the wolf appears. */
export const SPAWN_AHEAD_MIN = 8;
export const SPAWN_AHEAD_MAX = 16;

/** Occasional close spawn (still in fog). */
export const SPAWN_CLOSE_CHANCE = 0.26;
export const SPAWN_CLOSE_AHEAD_MIN = 5.5;
export const SPAWN_CLOSE_AHEAD_MAX = 8;

/** Beam must stay on a wolf this long to drive it back (rolled per wolf). */
export const ILLUMINATION_TIME = 0.7;
export const ILLUMINATION_TIME_MIN = 0.7;
export const ILLUMINATION_TIME_MAX = 3;

/**
 * While the flashlight battery is low, how fast the attack timer drains per second
 * when the beam actually hits the wolf (cannot fully hold the wolf at bay by aiming).
 */
export const LOW_BATTERY_ATTACK_BLEED = 2.5;

/** Same bleed rate while malfunctioning with beam on the wolf. */
export const MALFUNCTION_ATTACK_BLEED = LOW_BATTERY_ATTACK_BLEED;

/** Default / midpoint retreat cooldown (rolled per encounter). */
export const RETREAT_COOLDOWN = 10;
export const RETREAT_COOLDOWN_MIN = 6;
export const RETREAT_COOLDOWN_MAX = 16;

/** Within this range, failing to illuminate starts the attack timer. */
export const ATTACK_RANGE = 9;

/** Default attack window (rolled per encounter). */
export const ATTACK_TIME = 5;
export const ATTACK_TIME_MIN = 3.5;
export const ATTACK_TIME_MAX = 6.2;

/** How far past the wolf along -Z before "ignored" pass-by (walk direction). */
export const PASS_BY_MARGIN = 0.5;

/** Default stalk delay (rolled per encounter). */
export const STALK_DELAY = 3;
export const STALK_DELAY_MIN = 1.5;
export const STALK_DELAY_MAX = 4.2;

/**
 * Wolf creep along the corridor after stalk delay (faster than player S walk ~1.5).
 */
export const STALK_SPEED = 2.2;

/** Beyond this Z gap the wolf stalks at full speed. */
export const STALK_MIN_Z_GAP = 7;

/** Final slow creep stops at this Z gap (no snap steps). */
export const STALK_CREEP_FLOOR_Z_GAP = 4;

/** Speed multiplier while creeping inside STALK_MIN_Z_GAP. */
export const STALK_CREEP_SPEED_MULT = 0.32;

/** Chance to force flashlight malfunction when stalk begins. */
export const STALK_MALFUNCTION_CHANCE = 0.26;

/** Partner pair spawn (one wolf each flank); chance scales with survival time. */
export const PARTNER_CHANCE_BASE = 0.1;
export const PARTNER_CHANCE_MAX = 0.4;

/** Z offset between partner wolves along the path. */
export const PARTNER_Z_JITTER = 1.8;

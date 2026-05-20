export const SOUNDS = {
  ambient: "/assets/ambient_sound.mp3",
  walk: "/assets/walking_grass.mp3",
  jumpscare: "/assets/jumpscare.mp3",
  lurking: "/assets/lurking_monster.mp3",
  horrorWarning: "/assets/horror_warning.mp3",
  monsterAttack: "/assets/monster_attack.mp3",
  monsterGrowl: "/assets/monster_growl.mp3",
  heartbeat: "/assets/hearthbeat.mp3",
};

export const AMBIENT_VOLUME = 0.58;

export const WALK_VOLUME = 0.42;
export const WALK_STEP_INTERVAL = 0.44;

export const JUMPSCARE_VOLUME = 0.95;
export const JUMPSCARE_GROWL_ONLY_CHANCE = 0.14;
export const JUMPSCARE_STING_ONLY_CHANCE = 0.12;

export const LURKING_VOLUME = 0.5;
export const LURKING_INTERVAL_MIN = 16;
export const LURKING_INTERVAL_MAX = 38;
export const GROWL_FLUKE_CHANCE = 0.28;

/** After a lurk/growl, sometimes stay silent longer. */
export const LURK_SILENCE_MIN = 5;
export const LURK_SILENCE_MAX = 9;
export const LURK_SILENCE_CHANCE = 0.38;

export const HORROR_WARNING_VOLUME = 0.62;
export const HORROR_WARNING_COOLDOWN = 8;
export const HORROR_WARNING_CHANCE_PER_SEC = 0.45;

/** Growls while wolf is active but beam is not on it (panned to wolf). */
export const WOLF_UNFOCUSED_GROWL_INTERVAL_MIN = 7;
export const WOLF_UNFOCUSED_GROWL_INTERVAL_MAX = 16;
export const WOLF_UNFOCUSED_GROWL_CHANCE = 0.55;

/** False growl from wrong side while wolf is real. */
export const FALSE_LURK_CHANCE = 0.32;
export const FALSE_LURK_INTERVAL_MIN = 11;
export const FALSE_LURK_INTERVAL_MAX = 24;

/** Brush steps while wolf stalks off-axis. */
export const STALK_STEP_INTERVAL = 0.62;
export const STALK_STEP_VOLUME = 0.38;

export const MONSTER_ATTACK_VOLUME = 0.7;
export const MONSTER_GROWL_VOLUME = 0.75;

export const HEARTBEAT_VOLUME = 0.55;
export const HEARTBEAT_NEAR_RANGE = 9;

export const SPAWN_DOUBLE_GROWL_DELAY = 2.1;

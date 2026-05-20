/** Half-width of walkable path (full width ≈ 2.8 m). */
export const CORRIDOR_HALF_WIDTH = 1.4;

/** Player start along the corridor (forward is −Z). */
export const PLAYER_SPAWN_X = 0;
export const PLAYER_SPAWN_Y = 1.7;
export const PLAYER_SPAWN_Z = 0;

/** Furthest +Z the player can walk (no backing up past the start line). */
export const PLAYER_BACKWARD_LIMIT_Z = PLAYER_SPAWN_Z;

/**
 * Tree centers must be at least this far from the corridor centerline
 * (accounts for trunk + canopy overhang into the path).
 */
export const TREE_CLEARANCE = 4.2;

export const SIDE_MID = 7;
export const SIDE_FAR = 13;
export const BG_TREE_X = 17;

export const CHUNK_LENGTH = 30;
export const CHUNKS_RADIUS = 8;

/** Clear trees this far ahead along -Z (forward). */
export const TREE_SPAWN_AHEAD = 22;

/** Small band behind player when walking backward (+Z). */
export const TREE_SPAWN_BEHIND = 8;

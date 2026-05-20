/**
 * Exponential fog: exp(-density² × distance²).
 * ~0.1 density → very heavy mist by ~18–20 m from the camera.
 */

/** Fog tint — cool dark mist (horizon + clear color). */
export const FOG_COLOR = 0x080b10;

/** Higher = thicker fog; 0.1 is strong by ~20 world units. */
export const FOG_DENSITY = 0.1;

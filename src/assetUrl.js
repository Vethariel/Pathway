/**
 * Resolve public asset paths for dev (/) and GitHub Pages (/Pathway/).
 * @param {string} path e.g. "assets/wolf_monster.glb" or "/assets/wolf_monster.glb"
 */
export function assetUrl(path) {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${clean}`;
}

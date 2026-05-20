# Pathway

A first-person horror walking game built with [Three.js](https://threejs.org/). You move down an endless foggy forest corridor with a draining flashlight while something hunts you from the tree line.

**Author:** Daniel Gracia · **License:** [MIT](LICENSE) (source code)

## Play locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (Vite defaults to port 5173). Click **Enter the pathway**, then use pointer lock to play.

```bash
npm run build    # production build → dist/
npm run preview  # serve dist/
npm test         # logic unit tests
```

## Controls

| Input | Action |
|--------|--------|
| **W / S** | Move forward / back |
| **Mouse** | Look |
| **Space** | Flashlight |

## Project layout

| Path | Description |
|------|-------------|
| `src/` | Game source (scene, wolf encounter, audio, UI) |
| `assets/` | Models and sounds (served at `/assets/` via `public/assets`) |
| `scripts/` | Node test runners |
| `index.html` | Menu, HUD, game-over overlays |

## Third-party assets

Game **source code** is licensed under the [MIT License](LICENSE). **Assets** remain under their respective licenses — see [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

| Kind | Source |
|------|--------|
| Sound effects | [Pixabay](https://pixabay.com/) |
| Forest trees | [Low Poly Forest Tree Pack](https://sketchfab.com/3d-models/low-poly-forest-tree-pack-5ff5a51e74324845a4e4905f182dfb2b) by [99.Miles](https://sketchfab.com/99.Miles) (CC Attribution) |
| Wolf model | [The Elder Scrolls Blades Normal Wolf](https://sketchfab.com/3d-models/the-elder-scrolls-blades-normal-wolf-4ac11a2f3daa456f910588e99e284fef) by [OrangeSauceu](https://sketchfab.com/OrangeSauceu) (CC Attribution) |

UI fonts ([Cinzel](https://fonts.google.com/specimen/Cinzel), [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)) are loaded from Google Fonts.

## Tech

- **Vite** — dev server and bundler  
- **three** ^0.176 — WebGL rendering, GLTF loader, audio  

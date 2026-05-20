# Attributions and third-party licenses

This file covers **assets and libraries** used by Pathway. The game’s **source code** is © 2026 Daniel Gracia and licensed under the [MIT License](LICENSE); that license does not cover the assets below.

---

## Sound effects — Pixabay

All `.mp3` files in `assets/` were sourced from [Pixabay](https://pixabay.com/) under the [Pixabay Content License](https://pixabay.com/service/license/), which allows use without mandatory attribution. Attribution is provided here as a courtesy.

| File | Used for |
|------|-----------|
| `ambient_sound.mp3` | Ambient loop |
| `walking_grass.mp3` | Footsteps |
| `jumpscare.mp3` | Jump scare sting |
| `lurking_monster.mp3` | Distant threat / lurk |
| `horror_warning.mp3` | Horror sting |
| `monster_attack.mp3` | Wolf retreat |
| `monster_growl.mp3` | Growls |
| `hearthbeat.mp3` | Heartbeat loop |
| `switch.mp3` | Flashlight switch |

If you redistribute this project, verify each sound’s license on Pixabay matches your use case.

---

## 3D models — Sketchfab (CC Attribution)

Both models are published under **[Creative Commons Attribution](https://creativecommons.org/licenses/by/4.0/)** (CC BY). You must credit the authors, link to the license, and note any modifications.

### Low Poly Forest Tree Pack

- **Author:** [99.Miles](https://sketchfab.com/99.Miles)
- **Model:** [Low Poly Forest Tree Pack](https://sketchfab.com/3d-models/low-poly-forest-tree-pack-5ff5a51e74324845a4e4905f182dfb2b)
- **License:** [CC Attribution](https://creativecommons.org/licenses/by/4.0/)
- **In this project:** `assets/tree_pack.glb` — instanced trees and ground cover in the procedural forest corridor (materials adjusted in code).

### The Elder Scrolls Blades Normal Wolf

- **Author:** [OrangeSauceu](https://sketchfab.com/OrangeSauceu)
- **Model:** [The Elder Scrolls Blades Normal Wolf](https://sketchfab.com/3d-models/the-elder-scrolls-blades-normal-wolf-4ac11a2f3daa456f910588e99e284fef)
- **License:** [CC Attribution](https://creativecommons.org/licenses/by/4.0/)
- **In this project:** `assets/wolf_monster.glb` — scaled, positioned, and animated for encounter / jump-scare gameplay (root motion reduced in code for walk/idle).

*The wolf model is a fan recreation from a game asset; Pathway is not affiliated with or endorsed by Bethesda Softworks.*

**Suggested credit line (e.g. in-game credits or README):**

> Forest trees by [99.Miles](https://sketchfab.com/99.Miles) ([CC BY](https://creativecommons.org/licenses/by/4.0/)). Wolf by [OrangeSauceu](https://sketchfab.com/OrangeSauceu) ([CC BY](https://creativecommons.org/licenses/by/4.0/)). Sounds from [Pixabay](https://pixabay.com/).

---

## Software dependencies

| Package | License | Notes |
|---------|---------|--------|
| [three](https://github.com/mrdoob/three.js) | MIT | 3D engine |
| [vite](https://github.com/vitejs/vite) | MIT | Dev/build tool (devDependency) |

See each package’s repository for full license text.

---

## Fonts

- **[Cinzel](https://fonts.google.com/specimen/Cinzel)** — UI titles (Google Fonts)
- **[IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)** — UI body (Google Fonts)

Subject to the [Google Fonts license terms](https://developers.google.com/fonts/faq).

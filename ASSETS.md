# Assets

All 3D assets in POSE are CC0.

| Asset | Source | Licence |
| --- | --- | --- |
| Mannequin (`src/assets/mannequin-ual.glb`) | [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) by [Quaternius](https://quaternius.com), free edition, via the [J-Ponzo/gltf-universal-animation-library](https://github.com/J-Ponzo/gltf-universal-animation-library) glTF mirror. Source files in `assets-src/ual/` | CC0 1.0 |
| Stand-in mannequin (`src/three/mannequin.js`), shown while the model loads | Built procedurally from three.js primitives in this repo | CC0 (original work) |
| Event Engineering "Powered by" logo (`src/assets/ee-powered-by.svg`) | Event Engineering | All rights reserved; not covered by the MIT licence |
| Oxanium font (`src/assets/fonts/oxanium-regular.woff2`) | [Oxanium](https://fonts.google.com/specimen/Oxanium) by Severin Meyer, via Event Engineering internal apps | SIL Open Font License 1.1 |

## Rebuilding the mannequin

`src/assets/mannequin-ual.glb` is generated from the source by `npm run build:mannequin`, which keeps the mesh, the skin and only the animation clips that `src/three/poses.js` references, then quantises it (~380 KB).

Poses are frames from those clips plus bone tweaks. To add or tune one:

1. Edit `src/three/poses.js`, and add its id and label to `src/lib/poses.js`.
2. Open `/tools/pose-lab.html` on the dev server to see every pose (`?sweep=1` browses all source clips, `?axes=DEF-upper_arm.L` shows a bone's rotation axes).
3. Run `npm run build:mannequin`, then open `/tools/pose-lab.html?glb=1` and copy the measured extents into `src/lib/poses.js`.

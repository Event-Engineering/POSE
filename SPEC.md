# POSE — Photo Optics and Spatial Estimator

An Event Engineering internal tool for planning photo booth setups. You set the backdrop, the crowd, the floor graphic and the camera, and POSE shows a live 3D render of what the camera sees. It exists to help a human weigh up the compromises: backdrop size, floor footprint, camera choice (mostly 4K webcams and full-frame DSLRs), camera distance, height and tilt.

This is deliberately not an optimiser. The answer is always a trade-off between budget, space and aesthetics, so the tool visualises and a person decides.

## Stack

- Vue 3 with Vite, plain JavaScript (no TypeScript).
- Raw three.js inside Vue components (no TresJS for v1; one scene with several views is simpler done imperatively).
- No backend, no persistence, no localStorage. All state lives in the URL.
- Public GitHub repo, deployed as a static site via AWS Amplify (`amplify.yml` running `npm ci && npm run build`, artifacts from `dist`).
- MIT licence for code. All 3D assets must be CC0 (Quaternius or Kenney mannequins preferred) and credited in `ASSETS.md`.
- Styling with CSS custom properties in one theme file (`src/styles/theme.css`) holding Event Engineering fonts and colours, lifted from our existing internal apps. Light and dark mode follow `prefers-color-scheme`.

## World conventions

- Internal units are metres. The UI has a units toggle for display and input only: millimetres, or feet and inches (e.g. 6′ 6″). No decimal feet.
- Y is up. The backdrop is a flat wall in the plane z = 0, centred on x = 0, bottom edge at y = 0. People and camera sit at positive z.
- The camera is always centred on x = 0 with no pan or roll. Positive tilt means tilting down.
- Everything outside the backdrop and floor graphic is a light grey infinity space (seamless floor and horizon), so any spill past the set is obvious.

## Layout

A left sidebar with accordion sections, and the remainder of the window is the viewport. A small toolbar over the viewport holds the view switcher and export buttons. A readouts panel (bottom of sidebar or overlay in the viewport corner) shows the numbers listed under Readouts.

## Sidebar sections

URL keys in brackets. Defaults shown.

### Backdrop
- Width [bw] 2.4 m, range 1–8 m.
- Height [bh] 2.4 m, range 1–4 m.
- Colour [bc] light blue.
- Roadmap: upload a texture image.

### Crowd
- Number of people [n] 3, range 1–10.
- Height mode [hm]: "Average" (everyone 1.75 m) or "Mixed".
- Height range [hmin, hmax], a two-handle slider, default 1.55–1.98 m, range 1.00–2.10 m (the low end allows children). Only active in Mixed mode.
- Grouping [gap]: the gap between shoulders, from roughly −0.05 m (shoulders overlapping, social/wedding) to 0.6 m (formal corporate). Label the ends "Social" and "Corporate". Default 0.1 m.
- Distance from backdrop to people [pz] 0.5 m, range 0.2–3 m. Longer values are common for green screen to push shadows off the wall.
- Mannequin colour [mc] default white. Never skin tones.
- Reseed button [seed].
- Poses [po]: which poses are in the pool (comma-separated ids; default `stand`). Each person gets one from the pool at random by seed. Pool: Standing, T-pose, Arms up, Wave, Hands on hips, Arm around shoulder. The pose stream is separate from the height stream, so changing the pool never changes heights or order.

### Floor graphic
- Width [fw] defaults to backdrop width.
- Depth [fd] 2.0 m, measured forward from the backdrop.
- Colour [fc] light blue.
- Roadmap: texture upload.

### Camera
- Lens, entered as either focal length in mm (35 mm full-frame equivalent) [f] or field of view in degrees [fov]. Editing one updates the other. Default 90° FOV (AnkerWork C200), which works out at about 21.6 mm equivalent.
- FOV type [fovt]: Diagonal, Horizontal or Vertical. Default Diagonal, because webcam spec sheets almost always quote diagonal FOV.
- Sensor aspect ratio [ar]: 3:2 (DSLR), 16:9 (webcam), 4:3. Default 16:9.
- Orientation [or]: landscape or portrait. Portrait rotates the sensor 90° and the viewport aspect follows.
- Height from floor [ch] 1.6 m, range 0.6–2.5 m.
- Tilt [ct] 0°, range −10° to +30° (positive is down).
- Distance from backdrop [cz] 2.4 m, range 0.5–8 m. Always measured from the wall, never from the people.
- Post-crop [crop]: none, 1:1, 4:5, 4:3, 9:16. Always a centred crop.
- Roadmap: dropdown of cameras from a JSON list (ship a handful of generic samples only, not the real rental inventory).

## Crowd generation

1. Use a seeded PRNG (e.g. mulberry32) with the seed stored in the URL, so a shared link reproduces the exact same crowd.
2. In Mixed mode with n ≥ 2, one person is exactly hmin and one is exactly hmax. The rest are drawn uniformly between them. With n = 1, use hmax (the worst case).
3. Shuffle left-to-right order using the same seed, so the extremes can land at the edges or the centre. Reseed rerolls both heights and order.
4. One row only for v1. Centre the row on x = 0. Centre-to-centre spacing between neighbours = half of each person's shoulder width + gap, where shoulder width scales with height (about 0.26 × height).
5. Mannequins are the Quaternius Universal Animation Library mannequin (CC0), frozen in their assigned pose and uniformly scaled to each person's height. Real meshes, not billboards; real depth matters for occlusion.

## Lens maths

- Treat focal length as a full-frame lens (36 × 24 mm, diagonal 43.27 mm).
- Diagonal FOV = 2·atan(43.27 / 2f). Derive horizontal and vertical FOV from the diagonal using the chosen sensor aspect ratio, so equivalence stays consistent across 3:2 and 16:9 bodies.
- When the user types an FOV with a given type (H, V or D), convert through the aspect ratio to diagonal, then to focal length.
- Portrait swaps horizontal and vertical.
- Sanity check for tests: 50 mm, 3:2, landscape gives ~39.6° horizontal, so at 2.4 m the frame is ~1.73 m wide at the wall.

## Viewport

### Camera view (default)
- Render with overscan: the three.js camera's FOV is widened so the true frame occupies about 85% of the viewport (overscan amount [os], fixed at 15%; no UI control, but `?os=` still overrides it in the URL). This shows what is just outside the shot.
- Draw the true sensor frame as a solid red outline. Dim the overscan area slightly outside it.
- If a post-crop is set, draw it as a second outline (dashed, different colour) inside the sensor frame, both visible together.

### Plan view
- Orthographic top-down view of the scene showing the backdrop, floor graphic, people, camera position and the horizontal frustum lines projected on the floor. Include a scale grid in the current units.

### Side view
- Orthographic side elevation (wall on the left, camera on the right) showing the frame's top and bottom edges and the optical axis out to where each meets the backdrop plane or floor, with the crop's edges when it trims height, over a 0.5 m grid. This is where camera height, tilt, headroom and backdrop-top spill are easiest to judge.

### Orbit view
- Free orbit camera (OrbitControls) to look around the set, with a visible camera gizmo and frustum. A button snaps back to the camera view.

Switch between views (Camera, Plan, Side, Orbit) with a button group. Nice to have: plan view as a small inset over the camera view.

## Readouts

Computed analytically from the frustum and the set, not from pixels:

- Backdrop spill warning: whether any edge of the frame sees past the top, left or right of the backdrop, with the margin remaining in mm per edge. Amber when the margin is under 100 mm, red when negative. When a crop is set, report the sensor frame and the crop separately, since guests may see the uncropped live feed on the booth screen.
- Floor visibility: whether the bottom of the frame hits the floor, how far forward from the wall the visible floor reaches, and whether it extends beyond the floor graphic.
- Coverage at the people plane: frame width and height at the people's distance.
- Headroom above the highest point of any posed figure (head, or hands for arms up) and clearance either side of the outermost people.
- Footprint: overall width and depth of space needed, from the backdrop to the camera lens. There is no operator. The plinth that houses the camera, touchscreen, laptop and printer is not included in v1.

## Sharing and export

- Every setting syncs to URL query parameters (short keys above) via `history.replaceState`, debounced. Loading a URL restores the full state including the crowd seed. This covers sharing with colleagues and A/B comparison by duplicating tabs.
- Copy link button.
- Save image: download the camera view as PNG. Offer a choice of true frame, cropped frame, or full overscan with overlays.
- Copy image to clipboard using `ClipboardItem` with `image/png`.
- Enable `preserveDrawingBuffer` or render once into a separate canvas for capture.

## Out of scope for v1

Camera pan or roll, the camera plinth/monolith (touchscreen, laptop, printer housing), multiple rows, freely posable mannequins, lighting simulation, textures, any database or saved setups, auth, curved or L-shaped backdrops.

## Roadmap

1. Texture upload for backdrop and floor.
2. Camera and backdrop lookup lists (JSON first, light database later).
3. Crowd presets (for example: three people, formal corporate; eight people, social close-up).
4. ~~Selectable poses~~ (done in v1). Next: poses that pair with a neighbour, e.g. a real arm around the next person's shoulder.
5. Camera plinth/monolith as a 3D object, with its depth added to the footprint.
6. Lighting: ring light at the camera plus two soft lights.
7. Saved setups via a light persistence layer.

# POSE — Photo Optics and Spatial Estimator

An Event Engineering tool for planning photo booth setups. Set the backdrop, crowd, floor graphic and camera, and POSE renders what the camera sees in 3D, with spill, floor and headroom readouts. It shows you the trade-offs and leaves the decision to you. See [SPEC.md](SPEC.md).

## Develop

```bash
npm install
npm run dev
npm test
```

All state lives in the URL, so copy the link to share a setup.

The mannequin model and its poses are built from CC0 source files; see [ASSETS.md](ASSETS.md) for `npm run build:mannequin` and the pose lab (`/tools/pose-lab.html`).

## Deploy

AWS Amplify builds with `amplify.yml` (`npm ci && npm run build`, artifacts from `dist`).

## Licence

Code: [MIT](LICENSE). 3D assets are CC0 (the Quaternius source keeps its own licence in `assets-src/ual/LICENSE`); see [ASSETS.md](ASSETS.md). The Event Engineering logo and brand are not covered by the MIT licence.

// Builds src/assets/mannequin.glb from the Quaternius Universal Animation Library source
// (assets-src/ual, CC0): keeps the mesh, skin and only the clips that POSES reference.
// Run with `npm run build:mannequin` after changing src/three/poses.js.
import { NodeIO } from '@gltf-transform/core'
import { prune, dedup, weld, quantize } from '@gltf-transform/functions'

const POSES_SRC = new URL('../src/three/poses.js', import.meta.url)
const SOURCE = new URL('../assets-src/ual/AnimationLibrary_Godot_Standard.gltf', import.meta.url)
const OUT = new URL('../src/assets/mannequin.glb', import.meta.url)

// poses.js imports three, so read the clip names from its source rather than importing it.
const text = await (await import('node:fs/promises')).readFile(POSES_SRC, 'utf8')
const clips = new Set([...text.matchAll(/clip:\s*'([^']+)'/g)].map((m) => m[1]))

const io = new NodeIO()
const doc = await io.read(SOURCE.pathname)
for (const anim of doc.getRoot().listAnimations()) {
	if (clips.has(anim.getName())) continue
	// Samplers outlive their animation and would keep its keyframe accessors alive.
	for (const sampler of anim.listSamplers()) sampler.dispose()
	for (const channel of anim.listChannels()) channel.dispose()
	anim.dispose()
}
await doc.transform(dedup(), weld(), prune(), quantize())
await io.write(OUT.pathname, doc)

const { size } = await (await import('node:fs/promises')).stat(OUT)
console.log(`Wrote ${OUT.pathname} (${(size / 1024).toFixed(0)} KB) with clips: ${[...clips].join(', ')}`)

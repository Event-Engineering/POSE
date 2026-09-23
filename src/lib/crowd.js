// Deterministic crowd generation from a seeded PRNG.
import { AVERAGE_HEIGHT } from './state.js'
import { enabledPoses, poseMeta, YMCA, YMCA_META } from './poses.js'

/** mulberry32 seeded PRNG. Returns a function that yields floats in [0, 1). */
export function mulberry32(seed) {
	let a = seed >>> 0
	return function () {
		a |= 0
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const SHOULDER_RATIO = 0.26

/**
 * Generate the crowd for the current state. Returns an array of
 * { x, z, height, shoulderWidth, pose, top, left, right } ordered left to right
 * (increasing x). `top`, `left` and `right` are the posed figure's extents in metres (world y, x).
 */
export function generateCrowd(s) {
	const rng = mulberry32(s.seed)
	const n = Math.max(1, Math.round(s.n))

	let heights
	if (s.hm === 'mix') {
		let hmin = s.hmin
		let hmax = s.hmax
		if (hmin > hmax) {
			const t = hmin
			hmin = hmax
			hmax = t
		}
		if (n === 1) {
			heights = [hmax]
		} else {
			heights = new Array(n)
			heights[0] = hmin
			heights[1] = hmax
			for (let i = 2; i < n; i++) heights[i] = hmin + rng() * (hmax - hmin)
		}
	} else {
		heights = new Array(n).fill(AVERAGE_HEIGHT)
	}

	// Shuffle order (Fisher-Yates) using the same PRNG stream, so extremes can land anywhere.
	for (let i = heights.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		const tmp = heights[i]
		heights[i] = heights[j]
		heights[j] = tmp
	}

	const shoulders = heights.map((h) => h * SHOULDER_RATIO)

	// Centre-to-centre spacing between neighbours = half of each shoulder width + gap.
	const positions = new Array(n)
	positions[0] = 0
	for (let i = 1; i < n; i++) {
		positions[i] = positions[i - 1] + shoulders[i - 1] / 2 + shoulders[i] / 2 + s.gap
	}
	const offset = positions[n - 1] / 2
	const xs = positions.map((p) => p - offset)

	// Poses use their own stream so enabling poses never changes heights or order.
	const poseRng = mulberry32((s.seed ^ 0x9e3779b9) >>> 0)
	const pool = enabledPoses(s.po)

	return heights.map((h, i) => {
		// YMCA mode spells the letters in order; otherwise draw from the pool.
		const pose = s.po === YMCA ? YMCA_META[i % YMCA_META.length].id : pool[Math.floor(poseRng() * pool.length)]
		const meta = poseMeta(pose)
		return {
			x: xs[i],
			z: s.pz,
			height: h,
			shoulderWidth: shoulders[i],
			pose,
			top: h * meta.top,
			left: xs[i] - Math.max(shoulders[i] / 2, h * meta.left),
			right: xs[i] + Math.max(shoulders[i] / 2, h * meta.right),
		}
	})
}

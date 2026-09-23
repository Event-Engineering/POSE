// Analytic readouts computed from the frustum and the set. All lengths in metres.
import { halfTans, cropFraction } from './lens.js'
import { floorWidth } from './state.js'

const rad = (d) => (d * Math.PI) / 180

/** 'ok' | 'warn' | 'bad' for a margin in metres. */
export function marginStatus(m) {
	if (m < 0) return 'bad'
	if (m < 0.1) return 'warn'
	return 'ok'
}

/**
 * Build the camera ray-direction helpers for the current state.
 * Camera sits at (0, ch, cz) looking toward -z, tilted down by ct degrees.
 * A ray at camera-space offset (u, v) (u = horizontal tangent, v = vertical tangent)
 * has direction forward + right*u + up*v, where:
 *   dir.y(v) = -sin(ct) + v*cos(ct)
 *   dir.z(v) = -cos(ct) - v*sin(ct)
 * (independent of u — no pan/roll — which keeps top/bottom frame edges as flat, horizontal
 * lines when they land on a fixed z or y plane).
 */
function rayHelpers(s) {
	const ctRad = rad(s.ct)
	const sinCt = Math.sin(ctRad)
	const cosCt = Math.cos(ctRad)
	const diry = (v) => -sinCt + v * cosCt
	const dirz = (v) => -cosCt - v * sinCt
	return { diry, dirz }
}

/** Compute spill margins + floor visibility for a given pair of half-tans (sensor or crop). */
function computeSpillAndFloor(s, tanH, tanV) {
	const { diry, dirz } = rayHelpers(s)
	const vTop = tanV
	const vBottom = -tanV

	const wallAt = (v) => {
		const dz = dirz(v)
		if (dz >= 0) return null
		const t = -s.cz / dz
		if (t <= 0) return null
		const y = s.ch + t * diry(v)
		return { t, y, halfWidth: t * tanH }
	}

	const floorAt = (v) => {
		const dy = diry(v)
		if (dy >= 0) return null
		const t = -s.ch / dy
		if (t <= 0) return null
		const z = s.cz + t * dirz(v)
		return { t, z }
	}

	const top = wallAt(vTop)
	const bottom = wallAt(vBottom)

	const topMargin = top ? s.bh - top.y : -Infinity
	// Side spill: frame half-width on the wall, taken at the widest visible wall height. Only the
	// wall between the floor (y=0) and the frame top counts, so clamp before measuring. A wall point
	// at height y sits at depth (ch - y)·sin(ct) + cz·cos(ct) along the optical axis.
	const ctRad = rad(s.ct)
	const depthAt = (y) => (s.ch - y) * Math.sin(ctRad) + s.cz * Math.cos(ctRad)
	const lo = Math.max(0, bottom ? bottom.y : 0)
	const hi = Math.min(s.bh, top ? top.y : s.bh)
	const maxHalfWidth = hi > lo
		? Math.max(depthAt(lo), depthAt(hi)) * tanH
		: Math.max(top ? top.halfWidth : 0, bottom ? bottom.halfWidth : 0)
	const sideMargin = s.bw / 2 - maxHalfWidth

	const bottomFloor = floorAt(vBottom)
	const topFloor = floorAt(vTop)

	const farthestZ = bottomFloor ? bottomFloor.z : null
	const hitsFloor = farthestZ != null && farthestZ > 0
	const nearestZ = topFloor && topFloor.z > 0 && (farthestZ == null || topFloor.z < farthestZ) ? topFloor.z : 0
	const beyondGraphic = hitsFloor && farthestZ > s.fd
	const widthAtReach = bottomFloor ? bottomFloor.t * tanH * 2 : null

	return {
		spill: { top: topMargin, left: sideMargin, right: sideMargin },
		floor: {
			hitsFloor,
			nearestZ,
			farthestZ,
			beyondGraphic,
			widthAtReach,
		},
	}
}

export function computeReadouts(s, crowd) {
	const { h: tanH, v: tanV } = halfTans(s.f, s.ar, s.or)
	const { diry, dirz } = rayHelpers(s)

	const sensor = computeSpillAndFloor(s, tanH, tanV)

	const crop = cropFraction(s)
	const cropReadout = crop ? computeSpillAndFloor(s, tanH * crop.w, tanV * crop.h) : null

	// Coverage at the people plane (simple depth * tan model, per SPEC sanity check).
	const depthAtPeople = s.cz - s.pz
	const coverageWidth = 2 * depthAtPeople * tanH
	const coverageHeight = 2 * depthAtPeople * tanV
	const coverage = { width: coverageWidth, height: coverageHeight }
	if (crop) coverage.crop = { width: coverageWidth * crop.w, height: coverageHeight * crop.h }

	// Headroom: y of the top frame edge at the people plane z=pz, minus the highest point of any
	// posed figure (head, or hands in an arms-up pose).
	const vTop = tanV
	let headroom = -Infinity
	const dz = dirz(vTop)
	if (dz < 0) {
		const t = (s.pz - s.cz) / dz
		const yTop = s.ch + t * diry(vTop)
		const tallest = crowd.length ? Math.max(...crowd.map((p) => p.top ?? p.height)) : 0
		headroom = yTop - tallest
	}

	// Side clearance at the people plane, using the same simple half-width as coverage.
	const halfWidthAtPeople = coverageWidth / 2
	let sideClearance = { left: -Infinity, right: -Infinity }
	if (crowd.length) {
		// Outer edges of the posed figures (arms out), falling back to shoulders.
		const left = Math.min(...crowd.map((p) => p.left ?? p.x - p.shoulderWidth / 2))
		const right = Math.max(...crowd.map((p) => p.right ?? p.x + p.shoulderWidth / 2))
		sideClearance = {
			left: left + halfWidthAtPeople,
			right: halfWidthAtPeople - right,
		}
	}

	const footprint = {
		width: Math.max(s.bw, floorWidth(s)),
		depth: s.cz,
	}

	return {
		sensor,
		crop: cropReadout,
		coverage,
		headroom,
		sideClearance,
		footprint,
	}
}

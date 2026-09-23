// Dimension lines that explain a readout card, in world space (metres). The viewport projects
// them onto the current view while that card is hovered. Each entry: { a, b, label, status }
// where a and b are [x, y, z], label is the value in metres (formatted by the caller) or a
// string, and status is 'ok' | 'warn' | 'bad' | null (neutral).
import { floorWidth } from './state.js'
import { marginStatus } from './readouts.js'

const margin = (a, b, value) => ({ a, b, value, status: marginStatus(value) })
const measure = (a, b, value) => ({ a, b, value, status: null })

/** Spill margins on the wall plane: frame edge to backdrop edge. */
function spillDims(s, spill) {
	const dims = []
	if (spill.topAt != null) {
		const x = spill.topX ?? 0
		const z = spill.topZ ?? 0
		dims.push(margin([x, s.bh, z], [x, spill.topAt, z], spill.top))
	}
	// On the back wall, or at the side walls' front edges when they're on.
	const y = spill.sideAt
	const z = spill.sideZ ?? 0
	const edge = s.bw / 2
	const frame = spill.halfWidth
	dims.push(margin([-edge, y, z], [-frame, y, z], spill.left))
	dims.push(margin([edge, y, z], [frame, y, z], spill.right))
	return dims
}

export function buildDimensions(key, s, r, crowd) {
	switch (key) {
		case 'spill':
			return spillDims(s, r.sensor.spill)
		case 'cropSpill':
			return r.crop ? spillDims(s, r.crop.spill) : []
		case 'floor': {
			const f = r.sensor.floor
			const dims = [measure([0, 0, 0], [0, 0, s.fd], s.fd)]
			dims[0].label = 'Graphic'
			if (f.hitsFloor) {
				// Offset sideways so it doesn't sit on top of the graphic's depth line.
				const x = floorWidth(s) / 2 + 0.25
				dims.push({ a: [x, 0, 0], b: [x, 0, f.farthestZ], value: f.farthestZ, status: f.beyondGraphic ? 'warn' : 'ok', label: 'Reach' })
			}
			return dims
		}
		case 'coverage': {
			const w = r.coverage.width / 2
			const h = r.coverage.height / 2
			const dims = [
				measure([-w, s.ch, s.pz], [w, s.ch, s.pz], r.coverage.width),
				measure([w, s.ch - h, s.pz], [w, s.ch + h, s.pz], r.coverage.height),
			]
			if (r.coverage.crop) {
				const cw = r.coverage.crop.width / 2
				const ch = r.coverage.crop.height / 2
				dims.push(measure([-cw, s.ch - ch + 0.05, s.pz], [cw, s.ch - ch + 0.05, s.pz], r.coverage.crop.width))
				dims.push(measure([-cw, s.ch - ch, s.pz], [-cw, s.ch + ch, s.pz], r.coverage.crop.height))
			}
			return dims
		}
		case 'headroom': {
			if (!crowd.length) return []
			const tallest = crowd.reduce((a, p) => ((p.top ?? p.height) > (a.top ?? a.height) ? p : a))
			const top = tallest.top ?? tallest.height
			const dims = []
			if (Number.isFinite(r.headroom)) dims.push(margin([tallest.x, top, s.pz], [tallest.x, top + r.headroom, s.pz], r.headroom))
			const frame = r.coverage.width / 2
			const left = Math.min(...crowd.map((p) => p.left ?? p.x - p.shoulderWidth / 2))
			const right = Math.max(...crowd.map((p) => p.right ?? p.x + p.shoulderWidth / 2))
			const y = 0.75 * Math.min(...crowd.map((p) => p.height))
			dims.push(margin([-frame, y, s.pz], [left, y, s.pz], r.sideClearance.left))
			dims.push(margin([right, y, s.pz], [frame, y, s.pz], r.sideClearance.right))
			return dims
		}
		case 'footprint': {
			const w = r.footprint.width / 2
			return [
				measure([-w, 0, -0.15], [w, 0, -0.15], r.footprint.width),
				measure([w + 0.25, 0, 0], [w + 0.25, 0, r.footprint.depth], r.footprint.depth),
			]
		}
		default:
			return []
	}
}

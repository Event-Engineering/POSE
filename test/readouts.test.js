import { describe, it, expect } from 'vitest'
import { computeReadouts, marginStatus } from '../src/lib/readouts.js'
import { halfTans } from '../src/lib/lens.js'
import { generateCrowd } from '../src/lib/crowd.js'
import { DEFAULTS } from '../src/lib/state.js'

const base = (overrides = {}) => ({ ...DEFAULTS, ...overrides })

describe('SPEC sanity check (50 mm, 3:2, landscape)', () => {
	it('gives ~39.6deg horizontal FOV and ~1.73 m width at 2.4 m', () => {
		const { h: tanH } = halfTans(50, '3:2', 'land')
		const hFov = 2 * Math.atan(tanH) * (180 / Math.PI)
		expect(hFov).toBeCloseTo(39.6, 1)
		const widthAt2_4 = 2 * 2.4 * tanH
		expect(widthAt2_4).toBeCloseTo(1.73, 2)
	})
})

describe('computeReadouts — spill, tilt = 0 (hand-computed)', () => {
	// tanH = 0.359979..., tanV = 0.240041... for f=50, 3:2, landscape.
	const { h: tanH, v: tanV } = halfTans(50, '3:2', 'land')

	it('computes the top spill margin on the wall', () => {
		const s = base({ f: 50, ar: '3:2', or: 'land', ct: 0, ch: 1.6, cz: 2.4, bw: 2.4, bh: 2.4 })
		const r = computeReadouts(s, [])
		const expected = s.bh - (s.ch + s.cz * tanV)
		expect(r.sensor.spill.top).toBeCloseTo(expected, 6)
		expect(r.sensor.spill.top).toBeCloseTo(0.2239, 3)
	})

	it('computes symmetric left/right spill margins on the wall', () => {
		const s = base({ f: 50, ar: '3:2', or: 'land', ct: 0, ch: 1.6, cz: 2.4, bw: 2.4, bh: 2.4 })
		const r = computeReadouts(s, [])
		const expected = s.bw / 2 - s.cz * tanH
		expect(r.sensor.spill.left).toBeCloseTo(expected, 6)
		expect(r.sensor.spill.right).toBeCloseTo(expected, 6)
		expect(r.sensor.spill.left).toBeCloseTo(0.336, 2)
	})

	it('reports spill as negative (bad) once the frame is wider than the backdrop', () => {
		const s = base({ f: 50, ar: '3:2', or: 'land', ct: 0, ch: 1.6, cz: 2.4, bw: 1, bh: 1 })
		const r = computeReadouts(s, [])
		expect(r.sensor.spill.left).toBeLessThan(0)
		expect(r.sensor.spill.top).toBeLessThan(0)
	})

	it('does not see the floor when the camera is level and high (bottom ray hits the wall, not the floor)', () => {
		const s = base({ f: 50, ar: '3:2', or: 'land', ct: 0, ch: 1.6, cz: 2.4 })
		const r = computeReadouts(s, [])
		expect(r.sensor.floor.hitsFloor).toBe(false)
	})

	it('sees the floor once tilted down enough, and matches the hand-computed reach', () => {
		// With tilt, dir.y and dir.z depend on ct; use a modest tilt and verify against the
		// same ray formulas directly (not just re-deriving the implementation).
		const s = base({ f: 50, ar: '3:2', or: 'land', ct: 30, ch: 1.6, cz: 2.4, fd: 2.0 })
		const ctRad = (30 * Math.PI) / 180
		const vBottom = -tanV
		const diry = -Math.sin(ctRad) + vBottom * Math.cos(ctRad)
		const dirz = -Math.cos(ctRad) - vBottom * Math.sin(ctRad)
		const t = -s.ch / diry
		const expectedZ = s.cz + t * dirz
		const r = computeReadouts(s, [])
		expect(r.sensor.floor.hitsFloor).toBe(true)
		expect(r.sensor.floor.farthestZ).toBeCloseTo(expectedZ, 6)
	})
})

describe('computeReadouts — crop', () => {
	it('is null when no crop is set', () => {
		const s = base({ crop: 'none' })
		const r = computeReadouts(s, [])
		expect(r.crop).toBeNull()
	})

	it('narrows the frame and increases side margin for a square crop of a 16:9 sensor', () => {
		const s = base({ f: 50, ar: '16:9', or: 'land', crop: '1:1', bw: 6 })
		const r = computeReadouts(s, [])
		expect(r.crop).not.toBeNull()
		expect(r.crop.spill.left).toBeGreaterThan(r.sensor.spill.left)
		// Vertical margin is unchanged by a 1:1 crop of a wider-than-tall sensor (h fraction = 1).
		expect(r.crop.spill.top).toBeCloseTo(r.sensor.spill.top, 6)
	})
})

describe('computeReadouts — coverage', () => {
	it('matches the simple depth * tan model at the people plane', () => {
		const s = base({ f: 50, ar: '3:2', or: 'land', cz: 2.4, pz: 0.8 })
		const { h: tH, v: tV } = halfTans(s.f, s.ar, s.or)
		const depth = s.cz - s.pz
		const r = computeReadouts(s, [])
		expect(r.coverage.width).toBeCloseTo(2 * depth * tH, 6)
		expect(r.coverage.height).toBeCloseTo(2 * depth * tV, 6)
	})
})

describe('computeReadouts — headroom and side clearance', () => {
	it('gives positive headroom for a short crowd well inside a generous frame', () => {
		const s = base({ f: 21.635, ar: '16:9', or: 'land', ch: 1.6, ct: 5, cz: 2.4, pz: 0.8, n: 3, hm: 'avg', bw: 4 })
		const crowd = generateCrowd(s)
		const r = computeReadouts(s, crowd)
		expect(r.headroom).toBeGreaterThan(0)
	})

	it('gives positive side clearance when the crowd is narrower than the frame', () => {
		const s = base({ f: 21.635, ar: '16:9', or: 'land', n: 3, hm: 'avg', gap: 0.1, cz: 2.4, pz: 0.8 })
		const crowd = generateCrowd(s)
		const r = computeReadouts(s, crowd)
		expect(r.sideClearance.left).toBeGreaterThan(0)
		expect(r.sideClearance.right).toBeGreaterThan(0)
	})
})

describe('computeReadouts — footprint', () => {
	it('is the max of backdrop/floor width, and depth equals cz', () => {
		const s = base({ bw: 2.4, fw: 3.5, cz: 2.7 })
		const r = computeReadouts(s, [])
		expect(r.footprint.width).toBe(3.5)
		expect(r.footprint.depth).toBe(2.7)
	})

	it('follows the backdrop width when fw is null', () => {
		const s = base({ bw: 2.4, fw: null, cz: 2.7 })
		const r = computeReadouts(s, [])
		expect(r.footprint.width).toBe(2.4)
	})
})

describe('marginStatus', () => {
	it('classifies bad, warn and ok', () => {
		expect(marginStatus(-0.05)).toBe('bad')
		expect(marginStatus(0)).toBe('warn')
		expect(marginStatus(0.05)).toBe('warn')
		expect(marginStatus(0.2)).toBe('ok')
	})
})

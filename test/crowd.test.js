import { describe, it, expect } from 'vitest'
import { mulberry32, generateCrowd } from '../src/lib/crowd.js'
import { DEFAULTS, AVERAGE_HEIGHT } from '../src/lib/state.js'

const base = () => ({ ...DEFAULTS })

describe('mulberry32', () => {
	it('is deterministic for a given seed', () => {
		const a = mulberry32(42)
		const b = mulberry32(42)
		const seqA = [a(), a(), a()]
		const seqB = [b(), b(), b()]
		expect(seqA).toEqual(seqB)
	})

	it('produces values in [0, 1)', () => {
		const rng = mulberry32(1)
		for (let i = 0; i < 100; i++) {
			const v = rng()
			expect(v).toBeGreaterThanOrEqual(0)
			expect(v).toBeLessThan(1)
		}
	})

	it('differs across seeds', () => {
		const a = mulberry32(1)()
		const b = mulberry32(2)()
		expect(a).not.toBe(b)
	})
})

describe('generateCrowd', () => {
	it('is deterministic for a given seed and state', () => {
		const s = { ...base(), n: 5, hm: 'mix', seed: 7 }
		const c1 = generateCrowd(s)
		const c2 = generateCrowd(s)
		expect(c1).toEqual(c2)
	})

	it('changes with the seed', () => {
		const s1 = { ...base(), n: 5, hm: 'mix', seed: 7 }
		const s2 = { ...base(), n: 5, hm: 'mix', seed: 8 }
		const c1 = generateCrowd(s1)
		const c2 = generateCrowd(s2)
		expect(c1).not.toEqual(c2)
	})

	it('returns everyone at AVERAGE_HEIGHT in avg mode', () => {
		const s = { ...base(), n: 4, hm: 'avg' }
		const c = generateCrowd(s)
		expect(c).toHaveLength(4)
		for (const p of c) expect(p.height).toBe(AVERAGE_HEIGHT)
	})

	it('includes exactly hmin and hmax in mixed mode with n >= 2', () => {
		const s = { ...base(), n: 6, hm: 'mix', hmin: 1.55, hmax: 1.98, seed: 3 }
		const c = generateCrowd(s)
		const heights = c.map((p) => p.height)
		expect(heights).toContain(1.55)
		expect(heights).toContain(1.98)
		expect(heights.filter((h) => h === 1.55)).toHaveLength(1)
		expect(heights.filter((h) => h === 1.98)).toHaveLength(1)
		for (const h of heights) {
			expect(h).toBeGreaterThanOrEqual(1.55)
			expect(h).toBeLessThanOrEqual(1.98)
		}
	})

	it('uses hmax for a single person in mixed mode', () => {
		const s = { ...base(), n: 1, hm: 'mix', hmin: 1.55, hmax: 1.98 }
		const c = generateCrowd(s)
		expect(c).toHaveLength(1)
		expect(c[0].height).toBe(1.98)
	})

	it('swaps hmin/hmax if given reversed', () => {
		const s = { ...base(), n: 2, hm: 'mix', hmin: 1.98, hmax: 1.55, seed: 1 }
		const c = generateCrowd(s)
		const heights = c.map((p) => p.height).sort((a, b) => a - b)
		expect(heights[0]).toBe(1.55)
		expect(heights[1]).toBe(1.98)
	})

	it('orders people left to right by increasing x', () => {
		const s = { ...base(), n: 5, hm: 'mix', seed: 9 }
		const c = generateCrowd(s)
		for (let i = 1; i < c.length; i++) expect(c[i].x).toBeGreaterThan(c[i - 1].x)
	})

	it('centres the row on x = 0', () => {
		const s = { ...base(), n: 4, hm: 'avg', gap: 0.2 }
		const c = generateCrowd(s)
		const min = c[0].x
		const max = c[c.length - 1].x
		expect(min + max).toBeCloseTo(0, 9)
	})

	it('spaces neighbours by half shoulders + gap', () => {
		const s = { ...base(), n: 3, hm: 'avg', gap: 0.15 }
		const c = generateCrowd(s)
		for (let i = 1; i < c.length; i++) {
			const expected = c[i - 1].shoulderWidth / 2 + c[i].shoulderWidth / 2 + s.gap
			expect(c[i].x - c[i - 1].x).toBeCloseTo(expected, 9)
		}
	})

	it('derives shoulderWidth from height', () => {
		const s = { ...base(), n: 3, hm: 'avg' }
		const c = generateCrowd(s)
		for (const p of c) {
			expect(p.shoulderWidth).toBeCloseTo(p.height * 0.26, 9)
		}
	})

	it('places everyone at z = pz', () => {
		const s = { ...base(), n: 3, hm: 'avg', pz: 1.2 }
		const c = generateCrowd(s)
		for (const p of c) expect(p.z).toBe(1.2)
	})
})

describe('poses', () => {
	const base = { n: 6, hm: 'mix', hmin: 1.55, hmax: 1.98, gap: 0.1, pz: 0.5, seed: 42 }

	it('defaults everyone to standing', () => {
		const crowd = generateCrowd({ ...base, po: 'stand' })
		expect(crowd.every((p) => p.pose === 'stand')).toBe(true)
	})

	it('assigns only enabled poses, reproducibly by seed', () => {
		const s = { ...base, po: 'up,wave' }
		const a = generateCrowd(s)
		expect(a.every((p) => ['up', 'wave'].includes(p.pose))).toBe(true)
		expect(generateCrowd(s).map((p) => p.pose)).toEqual(a.map((p) => p.pose))
	})

	it('does not change heights or order when poses change', () => {
		const heights = (po) => generateCrowd({ ...base, po }).map((p) => p.height)
		expect(heights('stand,tpose,up')).toEqual(heights('stand'))
	})

	it('raises the top for arms up', () => {
		const [p] = generateCrowd({ ...base, n: 1, po: 'up' })
		expect(p.top).toBeGreaterThan(p.height * 1.2)
	})

	it('reaches further right than left for arm around shoulder', () => {
		const [p] = generateCrowd({ ...base, n: 1, po: 'arm' })
		expect(p.right - p.x).toBeGreaterThan(p.x - p.left + 0.3)
	})
})

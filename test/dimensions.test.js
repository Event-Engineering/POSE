import { describe, it, expect } from 'vitest'
import { DEFAULTS } from '../src/lib/state.js'
import { generateCrowd } from '../src/lib/crowd.js'
import { computeReadouts } from '../src/lib/readouts.js'
import { buildDimensions } from '../src/lib/dimensions.js'

const setup = (over = {}) => {
	const s = { ...DEFAULTS, ...over }
	const crowd = generateCrowd(s)
	return { s, crowd, r: computeReadouts(s, crowd) }
}
const len = (d) => Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1], d.b[2] - d.a[2])

describe('buildDimensions', () => {
	it('draws each spill margin on the wall at its own length', () => {
		const { s, crowd, r } = setup({ ct: 8, cz: 3 })
		const dims = buildDimensions('spill', s, r, crowd)
		expect(dims).toHaveLength(3)
		for (const d of dims) {
			expect(d.a[2]).toBe(0)
			expect(d.b[2]).toBe(0)
			expect(len(d)).toBeCloseTo(Math.abs(d.value), 9)
		}
		expect(dims[0].value).toBe(r.sensor.spill.top)
	})

	it('measures headroom up from the highest posed point', () => {
		const { s, crowd, r } = setup({ po: 'up', n: 3 })
		const [head] = buildDimensions('headroom', s, r, crowd)
		const top = Math.max(...crowd.map((p) => p.top))
		expect(head.a[1]).toBeCloseTo(top, 9)
		expect(head.b[1] - head.a[1]).toBeCloseTo(r.headroom, 9)
	})

	it('only shows floor reach when the floor is in shot', () => {
		const level = setup({ ct: 0 })
		expect(buildDimensions('floor', level.s, level.r, level.crowd)).toHaveLength(1)
		const tilted = setup({ ct: 12 })
		const dims = buildDimensions('floor', tilted.s, tilted.r, tilted.crowd)
		expect(dims).toHaveLength(2)
		expect(dims[1].b[2]).toBeCloseTo(tilted.r.sensor.floor.farthestZ, 9)
	})
})

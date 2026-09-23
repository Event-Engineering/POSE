import { describe, it, expect } from 'vitest'
import { formatLength, parseLength, formatAngle } from '../src/lib/units.js'

describe('formatLength', () => {
	it('formats mm as an integer with unit suffix', () => {
		expect(formatLength(2.4, 'mm')).toBe('2400 mm')
		expect(formatLength(0.05, 'mm')).toBe('50 mm')
	})

	it('formats ft-in with whole or half inches', () => {
		expect(formatLength(1.9812, 'ftin')).toBe('6′ 6″') // 6'6" exactly
		expect(formatLength(0, 'ftin')).toBe('0″')
		expect(formatLength(-0.1778, 'ftin')).toBe('−7″')
	})

	it('formats a half-inch value in ft-in', () => {
		// 6'6.5" = 78.5 in = 1.9939 m
		const m = 78.5 * 0.0254
		expect(formatLength(m, 'ftin')).toBe('6′ 6.5″')
	})
})

describe('parseLength', () => {
	it('parses plain millimetre numbers', () => {
		expect(parseLength('2400')).toBeCloseTo(2.4, 6)
		expect(parseLength('2400mm')).toBeCloseTo(2.4, 6)
	})

	it('parses metres', () => {
		expect(parseLength('2.4m')).toBeCloseTo(2.4, 6)
	})

	it('parses feet and inches', () => {
		expect(parseLength("6'6")).toBeCloseTo(1.9812, 4)
		expect(parseLength('6′ 6″')).toBeCloseTo(1.9812, 4)
		expect(parseLength('6ft')).toBeCloseTo(1.8288, 4)
	})

	it('parses inches', () => {
		expect(parseLength('78in')).toBeCloseTo(1.9812, 4)
	})

	it('interprets a bare number per the requested display unit', () => {
		expect(parseLength('6', 'ftin')).toBeCloseTo(1.8288, 4)
		expect(parseLength('2400', 'mm')).toBeCloseTo(2.4, 6)
	})

	it('returns NaN for garbage', () => {
		expect(parseLength('banana')).toBeNaN()
		expect(parseLength('')).toBeNaN()
	})
})

describe('formatAngle', () => {
	it('formats degrees with a degree sign', () => {
		expect(formatAngle(12.34)).toBe('12.3°')
		expect(formatAngle(0)).toBe('0°')
	})
})

describe('negative lengths', () => {
	it('round-trips negatives through format and parse', () => {
		expect(parseLength('-0′ 7″', 'ftin')).toBeCloseTo(-0.1778, 4)
		expect(parseLength('−7″', 'ftin')).toBeCloseTo(-0.1778, 4)
		expect(parseLength('-50', 'mm')).toBeCloseTo(-0.05, 6)
	})
})

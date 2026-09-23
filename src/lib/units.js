// Unit formatting and parsing. Internal values are always metres (lengths) or degrees (angles).

const MM_PER_M = 1000
const IN_PER_M = 1000 / 25.4
const IN_PER_FT = 12

/**
 * Format a length in metres for display.
 * 'mm' -> integer millimetres, e.g. "2400 mm"
 * 'ftin' -> feet and inches, whole or half inches, no decimals, e.g. `6′ 6″` or `6′ 6.5″`... actually no decimals: half inches only, e.g. 6' 6" or 6' 0"
 */
export function formatLength(m, units, { precision } = {}) {
	if (units === 'ftin') {
		return formatFtIn(m)
	}
	const mm = m * MM_PER_M
	const rounded = precision != null ? round(mm, precision) : Math.round(mm)
	return `${rounded} mm`
}

function formatFtIn(m) {
	const totalInches = m * IN_PER_M
	// Round to nearest half inch.
	let halves = Math.round(totalInches * 2)
	let sign = ''
	if (halves < 0) {
		sign = '−'
		halves = -halves
	}
	let wholeInches = Math.floor(halves / 2)
	const hasHalf = halves % 2 === 1
	let feet = Math.floor(wholeInches / IN_PER_FT)
	let inches = wholeInches % IN_PER_FT
	const inchStr = hasHalf ? `${inches}.5` : `${inches}`
	return feet ? `${sign}${feet}′ ${inchStr}″` : `${sign}${inchStr}″`
}

function round(v, precision) {
	const p = Math.pow(10, precision)
	return Math.round(v * p) / p
}

/**
 * Parse a length string to metres. Returns NaN if unparseable.
 * Accepts: "2400", "2400mm", "2.4m", "6'6", "6′ 6″", "78in", "6ft", with or without spaces.
 * When `units` is given, a bare number (no recognised unit suffix) is interpreted in that
 * display unit's natural base ('mm' -> millimetres, 'ftin' -> feet).
 */
export function parseLength(str, units) {
	if (str == null) return NaN
	let s = String(str).trim().replace(/^[−–]/, '-')
	if (!s) return NaN
	// Parse the magnitude and reapply the sign, so "-0′ 7″" is negative as a whole.
	if (s.startsWith('-')) {
		const v = parseLength(s.slice(1), units)
		return Number.isNaN(v) ? NaN : -v
	}

	// Feet+inches forms: 6'6, 6' 6", 6′ 6″, 6ft 6in, 6ft6in
	const ftInMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|′|ft)\s*(\d+(?:\.\d+)?)?\s*(?:"|″|in)?\s*$/i)
	if (ftInMatch && /['′]|ft/i.test(s)) {
		const feet = Number(ftInMatch[1])
		const inches = ftInMatch[2] != null ? Number(ftInMatch[2]) : 0
		if (!Number.isFinite(feet) || !Number.isFinite(inches)) return NaN
		return (feet * IN_PER_FT + inches) / IN_PER_M
	}

	// Inches only: "78in", "78\""
	const inMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:in|"|″)\s*$/i)
	if (inMatch) {
		return Number(inMatch[1]) / IN_PER_M
	}

	// Metres: "2.4m" (but not "mm")
	const mMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*m\s*$/i)
	if (mMatch) {
		return Number(mMatch[1])
	}

	// Millimetres: "2400mm"
	const mmMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*mm\s*$/i)
	if (mmMatch) {
		return Number(mmMatch[1]) / MM_PER_M
	}

	// Bare number: interpret per requested display unit, defaulting to millimetres.
	const bareMatch = s.match(/^-?\d+(?:\.\d+)?$/)
	if (bareMatch) {
		const v = Number(s)
		if (units === 'ftin') return (v * IN_PER_FT) / IN_PER_M
		return v / MM_PER_M
	}

	return NaN
}

/** Format an angle in degrees, e.g. "12.3°". */
export function formatAngle(deg) {
	const rounded = Math.round(deg * 10) / 10
	return `${rounded}°`
}

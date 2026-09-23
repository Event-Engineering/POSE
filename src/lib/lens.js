// Lens maths. Focal lengths are 35 mm full-frame equivalent; angles in degrees.
export const FF_DIAGONAL = Math.hypot(36, 24) // 43.27 mm

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

/** Sensor width / height for an aspect key ('3:2') and orientation ('land' | 'port'). */
export function aspect(ar, or = 'land') {
	const [w, h] = ar.split(':').map(Number)
	return or === 'port' ? h / w : w / h
}

/** Tangents of the half-angles {h, v, d} for a focal length. */
export function halfTans(f, ar, or) {
	const a = aspect(ar, or)
	const td = FF_DIAGONAL / (2 * f)
	const k = Math.hypot(a, 1)
	return { h: (td * a) / k, v: td / k, d: td }
}

/** Full FOV in degrees of the given type ('h' | 'v' | 'd'). */
export function fovFromFocal(f, type, ar, or) {
	return deg(2 * Math.atan(halfTans(f, ar, or)[type]))
}

export function focalFromFov(fov, type, ar, or) {
	const a = aspect(ar, or)
	const k = Math.hypot(a, 1)
	const t = Math.tan(rad(fov) / 2)
	const td = type === 'd' ? t : type === 'h' ? (t * k) / a : t * k
	return FF_DIAGONAL / (2 * td)
}

/** All three FOVs for the current state. */
export function fovs(s) {
	const t = halfTans(s.f, s.ar, s.or)
	return { h: deg(2 * Math.atan(t.h)), v: deg(2 * Math.atan(t.v)), d: deg(2 * Math.atan(t.d)) }
}

/**
 * Centred post-crop as fractions {w, h} of the sensor frame (each <= 1), or null for no crop.
 * Crop ratios are width:height of the final image as displayed.
 */
export function cropFraction(s) {
	if (!s.crop || s.crop === 'none') return null
	const target = aspect(s.crop)
	const sensor = aspect(s.ar, s.or)
	return target < sensor ? { w: target / sensor, h: 1 } : { w: 1, h: sensor / target }
}

/** Multiplier on the half-angle tangents so the true frame fills (100 - os)% of the viewport. */
export function overscanScale(s) {
	return 1 / (1 - s.os / 100)
}

/** Vertical FOV in degrees for the three.js render camera (overscan included). */
export function renderVerticalFov(s) {
	return deg(2 * Math.atan(halfTans(s.f, s.ar, s.or).v * overscanScale(s)))
}

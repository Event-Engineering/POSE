// Single source of truth for every setting. All lengths in metres, angles in degrees.
// Each key here is also its URL query parameter (see SPEC.md "Sidebar sections").
import { reactive, watch } from 'vue'
import { focalFromFov } from './lens.js'
import { enabledPoses, YMCA } from './poses.js'

export const DEFAULTS = {
	// Backdrop
	bw: 2.4, bh: 2.4, bc: '#a8c8e8',
	// Side walls: on/off and how far forward from the back wall they run (same height and colour).
	sw: false, sd: 1.2,
	// Crowd
	n: 3, hm: 'avg', hmin: 1.55, hmax: 1.98, gap: 0.1, pz: 0.5, mc: '#ffffff', seed: 1,
	// Enabled poses, comma-separated ids from lib/poses.js; each person gets one at random by seed.
	po: 'stand',
	// Floor graphic (fw null = follow backdrop width)
	fw: null, fd: 2.0, fc: '#a8c8e8',
	// Camera. Focal length (35 mm FF equivalent) is canonical; FOV of type fovt is derived via lens.js.
	// Default is 90° diagonal (AnkerWork C200).
	f: 21.635, fovt: 'd', ar: '16:9', or: 'land', ch: 1.6, ct: 0, cz: 2.4, crop: 'none',
	// View
	os: 15, view: 'camera', units: 'mm',
}

// Enumerations, for URL validation and UI options.
export const ENUMS = {
	hm: ['avg', 'mix'],
	fovt: ['d', 'h', 'v'],
	ar: ['3:2', '16:9', '4:3'],
	or: ['land', 'port'],
	crop: ['none', '1:1', '4:5', '3:4', '2:3', '9:16', '5:4', '4:3', '3:2', '16:9'],
	view: ['camera', 'top', 'side', 'orbit'],
	units: ['mm', 'ftin'],
}

export const RANGES = {
	bw: [1, 8], bh: [1, 4], sd: [0.2, 4], n: [1, 10], hmin: [1, 2.1], hmax: [1, 2.1], gap: [-0.05, 0.6],
	pz: [0.2, 3], fw: [0.5, 10], fd: [0.2, 6], f: [5, 300], ch: [0.6, 2.5], ct: [-10, 30],
	cz: [0.5, 8], os: [0, 40],
}

export const AVERAGE_HEIGHT = 1.75

export const state = reactive({ ...DEFAULTS })

/** Effective floor graphic width. */
export const floorWidth = (s) => (s.fw == null ? s.bw : s.fw)

function parse(key, raw) {
	const def = DEFAULTS[key]
	// 'plan' was the top view's old name; keep old links working.
	if (key === 'view' && raw === 'plan') return 'top'
	if (ENUMS[key]) return ENUMS[key].includes(raw) ? raw : undefined
	if (key === 'sw') return raw === '1'
	if (key === 'po') return raw === YMCA ? YMCA : enabledPoses(raw).join(',')
	if (key === 'bc' || key === 'fc' || key === 'mc') return /^[0-9a-f]{6}$/i.test(raw) ? '#' + raw : undefined
	const v = Number(raw)
	if (!Number.isFinite(v)) return undefined
	if (key === 'fw' || typeof def === 'number') {
		const r = RANGES[key]
		const c = r ? Math.min(r[1], Math.max(r[0], v)) : v
		return key === 'n' || key === 'seed' ? Math.round(c) : c
	}
	return undefined
}

function serialise(key, v) {
	if (typeof v === 'boolean') return v ? '1' : '0'
	if (typeof v === 'string' && v.startsWith('#')) return v.slice(1)
	if (typeof v === 'number') return String(Math.round(v * 10000) / 10000)
	return String(v)
}

export function loadFromUrl(search = window.location.search) {
	const params = new URLSearchParams(search)
	for (const key of Object.keys(DEFAULTS)) {
		if (!params.has(key)) continue
		const v = parse(key, params.get(key))
		if (v !== undefined) state[key] = v
	}
	// Alternate lens entry: ?fov=90 (of type fovt) is converted to focal length.
	if (params.has('fov') && !params.has('f')) {
		const fov = Number(params.get('fov'))
		if (fov > 0 && fov < 180) state.f = focalFromFov(fov, state.fovt, state.ar, state.or)
	}
}

export function toQuery(s = state) {
	const params = new URLSearchParams()
	for (const key of Object.keys(DEFAULTS)) {
		if (s[key] === DEFAULTS[key] || s[key] == null) continue
		params.set(key, serialise(key, s[key]))
	}
	return params.toString()
}

let timer
export function startUrlSync() {
	watch(state, () => {
		clearTimeout(timer)
		timer = setTimeout(() => {
			const q = toQuery()
			history.replaceState(null, '', q ? '?' + q : window.location.pathname)
		}, 250)
	}, { deep: true })
}

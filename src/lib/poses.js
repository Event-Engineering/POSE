// Pose pool metadata, free of three.js so crowd and readout maths can use it.
// Extents are multiples of standing height, measured from the posed model with
// tools/pose-lab.html?glb=1 (re-measure after changing src/three/poses.js).
// `left` / `right` are how far the figure reaches each side of its centre (world −x / +x).
export const POSE_META = [
	{ id: 'stand', label: 'Standing', top: 1, left: 0.193, right: 0.225 },
	{ id: 'tpose', label: 'T-pose', top: 1.026, left: 0.545, right: 0.545 },
	{ id: 'up', label: 'Arms up', top: 1.201, left: 0.24, right: 0.237 },
	{ id: 'wave', label: 'Wave', top: 1.104, left: 0.193, right: 0.281 },
	{ id: 'hips', label: 'Hands on hips', top: 1, left: 0.238, right: 0.232 },
	{ id: 'arm', label: 'Arm around shoulder', top: 1, left: 0.193, right: 0.457 },
]

// Easter egg (double-click the title): po=ymca lines up Y, M, C, A left to right. Kept out of
// POSE_META so they never appear as pose chips.
export const YMCA = 'ymca'
export const YMCA_META = [
	{ id: 'ymca-y', label: 'Y', top: 1.179, left: 0.351, right: 0.351 },
	{ id: 'ymca-m', label: 'M', top: 1.086, left: 0.172, right: 0.224 },
	{ id: 'ymca-c', label: 'C', top: 1.012, left: 0.17, right: 0.361 },
	{ id: 'ymca-a', label: 'A', top: 1.153, left: 0.205, right: 0.205 },
]

export const POSE_IDS = POSE_META.map((p) => p.id)
export const poseMeta = (id) => [...POSE_META, ...YMCA_META].find((p) => p.id === id) || POSE_META[0]

/** Enabled pose ids from the comma-separated `po` state value; never empty. */
export function enabledPoses(po) {
	const ids = String(po || '').split(',').filter((id) => POSE_IDS.includes(id))
	return ids.length ? ids : ['stand']
}

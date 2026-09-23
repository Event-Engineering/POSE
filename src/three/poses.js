// Photo poses for the UAL mannequin. Each pose is a frame sampled from one of the pack's clips,
// plus optional bone tweaks (degrees, applied on top of the clip in each bone's local space).
// Tune these with tools/pose-lab.html; ids and labels live in src/lib/poses.js.
import * as THREE from 'three'

// Bone axes (on top of Idle_Loop): upper_arm z lifts the arm sideways (+ for .L, − for .R);
// forearm x flexes the elbow. Idle_Loop stands turned ~19° off-axis, so FACE squares it to the camera.
const FACE = { 'DEF-hips': [0, 18.6, 0] }

export const POSES = [
	{ id: 'stand', clip: 'Idle_Loop', time: 0, bones: FACE },
	{ id: 'tpose', clip: 'A_TPose', time: 0 },
	{
		// From the T-pose, so the arms start straight.
		id: 'up', clip: 'A_TPose', time: 0,
		bones: { 'DEF-upper_arm.L': [0, 0, 78], 'DEF-upper_arm.R': [0, 0, -78] },
	},
	{
		id: 'wave', clip: 'Idle_Loop', time: 0,
		bones: { ...FACE, 'DEF-upper_arm.R': [0, 0, -140], 'DEF-forearm.R': [0, 0, -35] },
	},
	{
		id: 'hips', clip: 'Idle_Loop', time: 0,
		bones: { ...FACE, 'DEF-upper_arm.L': [0, 0, 55], 'DEF-upper_arm.R': [0, 0, -55], 'DEF-forearm.L': [0, 0, -110], 'DEF-forearm.R': [0, 0, 110] },
	},
	{
		id: 'arm', clip: 'Idle_Loop', time: 0,
		bones: { ...FACE, 'DEF-upper_arm.L': [0, 0, 80], 'DEF-forearm.L': [0, 0, -20] },
	},
]

/** Clip names the built GLB must keep (see scripts/build-mannequin.mjs). */
export const REQUIRED_CLIPS = [...new Set(POSES.map((p) => p.clip))]

const _euler = new THREE.Euler()
const _quat = new THREE.Quaternion()

/** Freeze `root` (a mannequin scene or clone) in `pose`. */
export function applyPose(root, clips, pose) {
	const clip = clips.find((c) => c.name === pose.clip)
	if (clip) {
		const mixer = new THREE.AnimationMixer(root)
		mixer.clipAction(clip).play()
		mixer.setTime(pose.time)
		// Don't stop the action: deactivating restores the bones' original (bind) state.
	}
	for (const [bone, [x, y, z]] of Object.entries(pose.bones || {})) {
		const node = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(bone))
		if (!node) continue
		_euler.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z))
		node.quaternion.multiply(_quat.setFromEuler(_euler))
	}
	root.updateMatrixWorld(true)
}

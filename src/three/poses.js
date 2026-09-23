// Photo poses for the UAL mannequin. Each pose samples one of the pack's clips, then optionally
// rotates bones (degrees, in each bone's local space), solves arm IK to hand targets, and applies
// `after` rotations. Tune these with tools/pose-lab.html; ids and labels live in src/lib/poses.js.
import * as THREE from 'three'

// Idle_Loop stands turned ~19° off-axis, so FACE squares it to the camera.
const FACE = { 'DEF-hips': [0, 18.6, 0] }

// IK hand targets and elbow poles are in model space as fractions of standing height:
// x = the model's left (screen right), y up, z forward (towards the camera).
const both = (hand, pole) => ({
	L: { hand, pole },
	R: { hand: [-hand[0], hand[1], hand[2]], pole: [-pole[0], pole[1], pole[2]] },
})

export const POSES = [
	{ id: 'stand', clip: 'Idle_Loop', time: 0, bones: FACE },
	{ id: 'tpose', clip: 'A_TPose', time: 0 },
	// Forearm twists turn the palms to face the camera.
	{
		id: 'up', clip: 'Idle_Loop', time: 0, openHands: true, bones: FACE, ik: both([0.24, 1.21, 0.03], [1, 0, -0.2]),
		after: { 'DEF-forearm.L': [0, -90, 0], 'DEF-forearm.R': [0, 90, 0] },
	},
	{
		id: 'wave', clip: 'Idle_Loop', time: 0, openHands: true, bones: FACE,
		// Left hand, elbow out at shoulder height and bent to about 90°, forearm upright.
		ik: { L: { hand: [0.26, 0.98, 0.06], pole: [1, -0.5, 0] } }, after: { 'DEF-forearm.L': [0, -90, 0] },
	},
	{ id: 'hips', clip: 'Idle_Loop', time: 0, openHands: true, bones: FACE, ik: both([0.15, 0.56, 0], [1, 0.1, -0.5]) },
	{ id: 'arm', clip: 'Idle_Loop', time: 0, bones: { ...FACE, 'DEF-upper_arm.L': [0, 0, 80], 'DEF-forearm.L': [0, 0, -20] } },

	// Easter egg (double-click the title): YMCA, spelled left to right.
	{ id: 'ymca-y', clip: 'A_TPose', time: 0, bones: { 'DEF-upper_arm.L': [0, 0, 58], 'DEF-upper_arm.R': [0, 0, -58] } },
	// Raised elbows are the M's outer peaks; hands above the head bend down at the wrist to form
	// the middle V.
	{
		id: 'ymca-m', clip: 'Idle_Loop', time: 0, openHands: true, bones: FACE, ik: both([0.09, 1.07, 0.03], [1, 0.7, 0]),
		after: { 'DEF-hand.L': [0, 0, 100], 'DEF-hand.R': [0, 0, -100] },
	},
	// Opens to screen right: the right arm arcs across in front of the head, the left reaches right at waist
	// height, the body leans left as the back of the C, and the hands turn in to close the curve.
	{
		id: 'ymca-c', clip: 'Idle_Loop', time: 0, openHands: true,
		// The spine twists ~30° to the right, bringing the top arm forward, clear of the head.
		bones: { ...FACE, 'DEF-spine.001': [0, 10, 8], 'DEF-spine.002': [0, 10, 0], 'DEF-spine.003': [0, 10, 5] },
		ik: { R: { hand: [0.16, 1.0, 0.2], pole: [-0.3, 1, 0.4] }, L: { hand: [0.3, 0.64, 0.14], pole: [0.2, -1, 0.3] } },
		after: { 'DEF-hand.R': [0, 0, -50], 'DEF-hand.L': [0, 0, 30] },
	},
	{
		id: 'ymca-a', clip: 'A_TPose', time: 0,
		bones: { 'DEF-upper_arm.L': [0, 0, 62], 'DEF-upper_arm.R': [0, 0, -62], 'DEF-forearm.L': [0, 0, 62], 'DEF-forearm.R': [0, 0, -62], 'DEF-hand.L': [0, 0, 20], 'DEF-hand.R': [0, 0, -20] },
	},

]

/** Clip names the built GLB must keep (see scripts/build-mannequin.mjs). */
export const REQUIRED_CLIPS = [...new Set(POSES.map((p) => p.clip))]

const _euler = new THREE.Euler()
const _quat = new THREE.Quaternion()

// Standing height of the model in its own units, so IK targets can be given as fractions of it.
const MODEL_HEIGHT = 1.783

const bone = (root, name) => root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name))
const worldPos = (node) => node.getWorldPosition(new THREE.Vector3())

function rotateBones(root, bones) {
	for (const [name, [x, y, z]] of Object.entries(bones || {})) {
		const node = bone(root, name)
		if (!node) continue
		_euler.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z))
		node.quaternion.multiply(_quat.setFromEuler(_euler))
	}
}

/** Turn `node` in world space so the direction from it to `from` points at `to`. */
function aim(node, from, to) {
	const origin = worldPos(node)
	const q = new THREE.Quaternion().setFromUnitVectors(
		from.clone().sub(origin).normalize(),
		to.clone().sub(origin).normalize(),
	)
	const parentWorld = node.parent.getWorldQuaternion(new THREE.Quaternion())
	const world = node.getWorldQuaternion(new THREE.Quaternion()).premultiply(q)
	node.quaternion.copy(parentWorld.invert().multiply(world))
	node.updateMatrixWorld(true)
}

/**
 * Two-bone IK for one arm. `hand` is where the wrist should go and `pole` which way the elbow
 * should point, both in model space as fractions of standing height (x = model's left, y up,
 * z forward). Unreachable targets are clamped to a nearly straight arm.
 */
function solveArm(root, side, { hand, pole }) {
	const upper = bone(root, `DEF-upper_arm.${side}`)
	const fore = bone(root, `DEF-forearm.${side}`)
	const wrist = bone(root, `DEF-hand.${side}`)
	if (!upper || !fore || !wrist) return
	root.updateMatrixWorld(true)
	const toWorld = ([x, y, z]) => root.localToWorld(new THREE.Vector3(x, y, z).multiplyScalar(MODEL_HEIGHT))
	const S = worldPos(upper)
	const E = worldPos(fore)
	const W = worldPos(wrist)
	const a = S.distanceTo(E)
	const b = E.distanceTo(W)
	const target = toWorld(hand)
	const dir = target.clone().sub(S)
	const d = Math.min(dir.length(), (a + b) * 0.999)
	dir.normalize()
	const T = S.clone().addScaledVector(dir, d)
	// Elbow: on the circle of reach, pushed towards the pole.
	const poleDir = toWorld(pole).sub(root.localToWorld(new THREE.Vector3()))
	const perp = poleDir.sub(dir.clone().multiplyScalar(poleDir.dot(dir))).normalize()
	const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)
	const elbow = S.clone().addScaledVector(dir, a * cosA).addScaledVector(perp, a * Math.sqrt(1 - cosA * cosA))
	aim(upper, E, elbow)
	aim(fore, worldPos(wrist), T)
}

/**
 * Freeze `root` (a mannequin scene or clone) in `pose`: sample the clip, apply bone tweaks, solve
 * any arm IK targets, then apply `after` tweaks (e.g. to turn the hands).
 */
export function applyPose(root, clips, pose) {
	const clip = clips.find((c) => c.name === pose.clip)
	if (clip) {
		const mixer = new THREE.AnimationMixer(root)
		mixer.clipAction(clip).play()
		mixer.setTime(pose.time)
		// Don't stop the action: deactivating restores the bones' original (bind) state.
	}
	// Open hands: take just the finger bones from the T-pose, where the hands are flat.
	const tpose = pose.openHands && clips.find((c) => c.name === 'A_TPose')
	if (tpose) {
		const fingers = tpose.tracks.filter((t) => /f_|thumb/.test(t.name))
		const mixer = new THREE.AnimationMixer(root)
		mixer.clipAction(new THREE.AnimationClip('open-hands', -1, fingers)).play()
		mixer.setTime(0)
	}
	rotateBones(root, pose.bones)
	root.updateMatrixWorld(true)
	for (const side of ['L', 'R']) if (pose.ik?.[side]) solveArm(root, side, pose.ik[side])
	rotateBones(root, pose.after)
	root.updateMatrixWorld(true)
}

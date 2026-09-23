// Loads the Quaternius UAL mannequin (src/assets/mannequin-ual.glb, CC0) and makes posed,
// tinted copies of it. See ASSETS.md and scripts/build-mannequin.mjs.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { POSES, applyPose } from './poses.js'
// Imported as a URL so Vite fingerprints it under /assets (cache-safe across rebuilds).
import MODEL_URL from '../assets/mannequin-ual.glb?url'

let loading = null

/** Resolves to { scene, animations, standTop } once, shared by all callers. */
export function loadMannequin() {
	loading ??= new GLTFLoader().loadAsync(MODEL_URL).then((gltf) => {
		const template = gltf.scene
		template.traverse((o) => {
			if (o.isMesh) o.userData.sharedGeometry = true
		})
		// Standing height of the posed model, used to scale each person to their height.
		applyPose(template, gltf.animations, POSES[0])
		const standTop = new THREE.Box3().setFromObject(template, true).max.y
		return { scene: template, animations: gltf.animations, standTop }
	})
	return loading
}

/**
 * A copy of the mannequin in pose `poseId`, scaled to `height` metres, feet on y=0, facing +z.
 * Materials: the body takes `color`; joints a slightly darker shade so limbs still read.
 */
export function createPosedMannequin(model, poseId, height, materials) {
	const root = SkeletonUtils.clone(model.scene)
	const pose = POSES.find((p) => p.id === poseId) || POSES[0]
	applyPose(root, model.animations, pose)
	root.traverse((o) => {
		if (!o.isMesh) return
		o.material = o.material.name === 'M_Joints' ? materials.joints : materials.body
		o.castShadow = true
		o.receiveShadow = true
		// Posed bounds differ from the bind pose; don't let three cull by the stale sphere.
		o.frustumCulled = false
	})
	root.scale.setScalar(height / model.standTop)
	return root
}

export function mannequinMaterials(color) {
	const body = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 })
	const joints = new THREE.MeshStandardMaterial({
		color: new THREE.Color(color).multiplyScalar(0.72),
		roughness: 0.7,
		metalness: 0,
	})
	return { body, joints }
}

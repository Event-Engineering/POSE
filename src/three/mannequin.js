// Procedural low-poly mannequin built from three.js primitives. No external assets — this
// is our CC0 "asset" (see ASSETS.md). Standing pose, arms slightly away from the body,
// facing +z, feet on y=0, exactly 1.0 m tall. Callers scale the returned group uniformly
// to a person's height.
import * as THREE from 'three'

/** @returns {THREE.Group} */
export function createMannequin(color = '#ffffff') {
	const group = new THREE.Group()
	const material = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 })

	const add = (geo, x, y, z, rz = 0) => {
		const mesh = new THREE.Mesh(geo, material)
		mesh.position.set(x, y, z)
		if (rz) mesh.rotation.z = rz
		mesh.castShadow = true
		mesh.receiveShadow = true
		group.add(mesh)
		return mesh
	}

	// Proportions: shoulder breadth (outer arm edge to outer arm edge) ≈ 0.26 × height, to match
	// the crowd spacing in lib/crowd.js.

	// Legs: floor (y=0) up to the hip line (y=0.48).
	const legRadius = 0.05
	const legGeo = new THREE.CapsuleGeometry(legRadius, 0.48 - legRadius * 2, 2, 6)
	add(legGeo, -0.055, 0.24, 0)
	add(legGeo, 0.055, 0.24, 0)

	// Pelvis.
	add(new THREE.BoxGeometry(0.2, 0.08, 0.11), 0, 0.48, 0)

	// Torso: hip line (0.48) to shoulder line (0.81), flattened front-to-back.
	const torsoRadius = 0.09
	const torso = add(new THREE.CapsuleGeometry(torsoRadius, 0.33 - torsoRadius * 2, 2, 8), 0, 0.645, 0)
	torso.scale.set(1, 1, 0.65)
	// Shoulder yoke gives the torso a broader top than waist.
	add(new THREE.BoxGeometry(0.2, 0.06, 0.1), 0, 0.78, 0)

	// Neck.
	add(new THREE.CylinderGeometry(0.03, 0.035, 0.06, 6), 0, 0.84, 0)

	// Head: top sits at y=1.0.
	const headRadius = 0.065
	const head = add(new THREE.SphereGeometry(headRadius, 8, 6), 0, 1 - headRadius, 0)
	head.scale.set(0.9, 1, 1)

	// Arms hang from the shoulders to fingertips at ~0.40, tilted slightly away from the body.
	const armRadius = 0.032
	const armExtent = 0.4
	const armGeo = new THREE.CapsuleGeometry(armRadius, armExtent - armRadius * 2, 2, 6)
	const armAngle = 0.07
	const armOffsetX = 0.13 - armRadius
	const armY = 0.8 - armExtent / 2
	add(armGeo, -armOffsetX - 0.012, armY, 0, armAngle)
	add(armGeo, armOffsetX + 0.012, armY, 0, -armAngle)

	group.name = 'mannequin'
	return group
}

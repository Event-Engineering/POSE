// Dev-only: renders the UAL mannequin in candidate poses so photo poses can be picked by eye.
// /tools/pose-lab.html            POSES applied to the source model
// ?glb=1                          POSES applied to the built src/assets/mannequin-ual.glb
// ?sweep=1&clips=A,B&steps=6      every (or the listed) source clip sampled at `steps` times
// ?axes=DEF-upper_arm.L           that bone rotated ±60° about x, y, z on top of Idle_Loop
//   &base=A_TPose&deg=90           ...on top of another clip, by another angle
// ?only=ymca-y,ymca-m              just these POSES
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { POSES, applyPose } from '../src/three/poses.js'

const params = new URLSearchParams(location.search)
const url = params.get('glb') ? '/src/assets/mannequin-ual.glb' : '/assets-src/ual/AnimationLibrary_Godot_Standard.gltf'
const axes = params.get('axes')
const base = params.get('base') || 'Idle_Loop'
const deg = Number(params.get('deg') || 60)
const only2 = params.get('only')?.split(',')
const steps = Number(params.get('steps') || 4)
const only = params.get('clips')?.split(',')

// ?size=2 renders larger thumbnails.
const k = Number(params.get('size') || 1)
const W = 150 * k
const H = 200 * k
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(W, H)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#ddd')
scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2))
const dl = new THREE.DirectionalLight(0xffffff, 1.5)
dl.position.set(1, 3, 4)
scene.add(dl)
const cam = new THREE.PerspectiveCamera(30, 150 / 200, 0.1, 50)
cam.position.set(0, 1.0, 5.2)
cam.lookAt(0, 0.95, 0)

const gltf = await new GLTFLoader().loadAsync(url)
const model = gltf.scene
scene.add(model)
const grid = document.getElementById('grid')

function snap(label) {
	renderer.render(scene, cam)
	const fig = document.createElement('figure')
	const c = document.createElement('canvas')
	c.width = W
	c.height = H
	c.getContext('2d').drawImage(renderer.domElement, 0, 0)
	const cap = document.createElement('figcaption')
	cap.textContent = label
	fig.append(c, cap)
	grid.append(fig)
}

if (axes) {
	for (const [i, axis] of ['x', 'y', 'z'].entries()) {
		for (const a of [-deg, deg]) {
			const r = [0, 0, 0]
			r[i] = a
			applyPose(model, gltf.animations, { clip: base, time: 0, bones: { [axes]: r } })
			snap(`${axis} ${a}`)
		}
	}
} else if (params.get('sweep')) {
	for (const clip of gltf.animations) {
		if (only && !only.includes(clip.name)) continue
		for (let i = 0; i < steps; i++) {
			const t = (clip.duration * i) / steps
			const m = new THREE.AnimationMixer(model)
			m.clipAction(clip).play()
			m.setTime(t)
			snap(`${clip.name} @${t.toFixed(2)}`)
		}
	}
} else {
	// Also measure each pose's extents relative to the standing height, for src/lib/pose-extents.js.
	const box = new THREE.Box3()
	const extents = {}
	applyPose(model, gltf.animations, POSES[0])
	let standTop = box.setFromObject(model, true).max.y
	for (const pose of POSES) {
		if (only2 && !only2.includes(pose.id)) continue
		applyPose(model, gltf.animations, pose)
		snap(pose.id)
		box.setFromObject(model, true)
		const r = (v) => Math.round((v / standTop) * 1000) / 1000
		extents[pose.id] = { top: r(box.max.y), left: r(-box.min.x), right: r(box.max.x) }
	}
	const pre = document.createElement('pre')
	pre.id = 'extents'
	pre.textContent = JSON.stringify({ standTop, extents }, null, 1)
	document.body.append(pre)
}

// The single three.js scene behind all three viewport views (camera / plan / orbit).
// World: metres, Y up. Backdrop wall in the plane z=0 centred on x=0, bottom at y=0.
// People and camera sit at positive z. See SPEC.md and CONTRACTS.md for the full contract.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { createMannequin } from './mannequin.js'
import { loadMannequin, createPosedMannequin, mannequinMaterials } from './mannequin-model.js'
import { halfTans, renderFit, cropFraction, fovFromFocal } from '../lib/lens.js'
import { floorWidth } from '../lib/state.js'

const deg2rad = (d) => (d * Math.PI) / 180

// Layer 1 holds plan/orbit-only helpers (grid, camera marker, frustum, gizmo) so they can be
// excluded from the camera view render without touching the rest of the scene graph.
const LAYER_DEFAULT = 0
const LAYER_HELPER = 1
// Layer 2 is plan-view only (floor projection of the frustum), so it doesn't clutter orbit view.
const LAYER_PLAN = 2
// Layer 3 is orbit-view only (the 3D frustum), which would double up with layer 2 from above.
const LAYER_ORBIT = 3
// Layer 4 is side-view only (vertical frustum edges and an elevation grid).
const LAYER_SIDE = 4
const CROP_COLOR = 0x0891b2

const FRUSTUM_COLOR = 0x2266ee
const TRANSITION_MS = 700
const INFINITY_GREY = 0xd8d8d8
const INFINITY_FLOOR_GREY = 0xcfcfcf

export class PoseScene {
	constructor(canvas) {
		this.canvas = canvas
		// Called after the mannequin model finishes loading, so the owner can re-render.
		this.onModelLoad = null
		// Fat-line materials need the viewport size in pixels; kept in sync by resize().
		this._resolution = new THREE.Vector2(1, 1)
		this._lineMaterials = new Set()
		this.model = null
		loadMannequin()
			.then((model) => {
				this.model = model
				this.onModelLoad?.()
			})
			.catch((err) => console.warn('POSE: mannequin model failed to load, using stand-in', err))
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
		this.renderer.shadowMap.enabled = true
		this.renderer.shadowMap.type = THREE.PCFShadowMap

		this.scene = new THREE.Scene()
		this.scene.background = new THREE.Color(INFINITY_GREY)
		this.scene.fog = new THREE.Fog(INFINITY_GREY, 8, 45)

		this.view = 'camera'
		this._lastState = null
		this._lastCrowd = null

		this._buildEnvironment()
		this._buildLights()
		this._buildCameras()

		// Groups rebuilt wholesale on every update() — simplicity over incremental diffing for v1.
		this.setGroup = new THREE.Group()
		this.setGroup.name = 'set'
		this.scene.add(this.setGroup)
		// People live in their own group and are only rebuilt when a figure changes (see _syncPeople).
		this.peopleGroup = new THREE.Group()
		this.peopleGroup.name = 'people'
		this.scene.add(this.peopleGroup)
		this._peopleKey = null

		this.helperGroup = new THREE.Group()
		this.helperGroup.name = 'helpers'
		this.helperGroup.layers.set(LAYER_HELPER)
		this.scene.add(this.helperGroup)
	}

	_buildEnvironment() {
		const floorGeo = new THREE.PlaneGeometry(400, 400)
		const floorMat = new THREE.MeshStandardMaterial({ color: INFINITY_FLOOR_GREY, roughness: 1 })
		const floor = new THREE.Mesh(floorGeo, floorMat)
		floor.rotation.x = -Math.PI / 2
		floor.receiveShadow = true
		floor.name = 'infinityFloor'
		this.scene.add(floor)
	}

	_buildLights() {
		const hemi = new THREE.HemisphereLight(0xffffff, 0x707070, 1.1)
		this.scene.add(hemi)

		const dir = new THREE.DirectionalLight(0xffffff, 1.4)
		dir.position.set(3, 6, 5)
		dir.castShadow = true
		dir.shadow.mapSize.set(1024, 1024)
		dir.shadow.camera.left = -6
		dir.shadow.camera.right = 6
		dir.shadow.camera.top = 6
		dir.shadow.camera.bottom = -6
		dir.shadow.camera.far = 20
		dir.shadow.bias = -0.0005
		this.scene.add(dir)
	}

	_buildCameras() {
		this.cameraViewCam = new THREE.PerspectiveCamera(50, 1, 0.05, 60)
		this.cameraViewCam.layers.disable(LAYER_HELPER)

		this.planCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60)
		this.planCam.layers.enable(LAYER_HELPER)
		this.planCam.layers.enable(LAYER_PLAN)
		this.planCam.up.set(0, 0, -1)

		// Side elevation: orthographic, looking along +x so the wall is on the left and the camera
		// on the right.
		this.sideCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60)
		this.sideCam.layers.enable(LAYER_HELPER)
		this.sideCam.layers.enable(LAYER_SIDE)

		// Copies of the top (plan) and side cameras for the desktop side panels (see renderAux).
		this.auxCams = { top: this.planCam.clone(), side: this.sideCam.clone() }

		this.orbitCam = new THREE.PerspectiveCamera(50, 1, 0.05, 60)
		this.orbitCam.layers.enable(LAYER_HELPER)
		this.orbitCam.layers.enable(LAYER_ORBIT)
		this.orbitCam.position.set(3, 2.5, 5)

		// Flies between views during a transition (see setView).
		this.transitionCam = new THREE.PerspectiveCamera(50, 1, 0.05, 80)

		this.orbitControls = new OrbitControls(this.orbitCam, this.canvas)
		this.orbitControls.enableDamping = true
		this.orbitControls.target.set(0, 1, 1.5)
		this.orbitControls.enabled = false
		this.orbitControls.update()
	}

	/** Rebuild the set (backdrop, floor graphic, people) and reposition cameras/helpers. */
	update(state, crowd) {
		this._lastState = state
		this._lastCrowd = crowd
		this._rebuildSet(state, crowd)
		this._updateCameraView(state)
		this._rebuildHelpers(state)
	}

	_clearGroup(group) {
		for (const child of [...group.children]) {
			group.remove(child)
			child.traverse?.((o) => {
				if (!o.userData.sharedGeometry) o.geometry?.dispose?.()
				if (o.material) {
					const mats = Array.isArray(o.material) ? o.material : [o.material]
					mats.forEach((m) => {
						m.dispose()
						this._lineMaterials.delete(m)
					})
				}
			})
		}
	}

	_rebuildSet(state, crowd) {
		this._clearGroup(this.setGroup)

		// Backdrop wall: bw x bh, centred on x=0, bottom edge on y=0, in the plane z=0.
		const backdrop = new THREE.Mesh(
			new THREE.BoxGeometry(state.bw, state.bh, 0.03),
			new THREE.MeshStandardMaterial({ color: state.bc, roughness: 0.95 }),
		)
		backdrop.position.set(0, state.bh / 2, -0.015)
		backdrop.receiveShadow = true
		// Casting stops people's shadows passing through the wall onto the floor behind it.
		backdrop.castShadow = true
		backdrop.name = 'backdrop'
		this.setGroup.add(backdrop)

		// Side walls: same height and colour, just outside x = ±bw/2, from behind the back wall
		// (closing the corner) forward to z = sd.
		if (state.sw && state.sd > 0) {
			const T = 0.03
			const geo = new THREE.BoxGeometry(T, state.bh, state.sd + T)
			for (const side of [-1, 1]) {
				const wall = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: state.bc, roughness: 0.95 }))
				wall.position.set(side * (state.bw / 2 + T / 2), state.bh / 2, (state.sd - T) / 2)
				wall.receiveShadow = true
				wall.castShadow = true
				wall.name = 'sideWall'
				this.setGroup.add(wall)
			}
		}

		// Floor graphic: fw x fd, from the wall (z=0) forward to z=fd.
		const fw = floorWidth(state)
		const floorGraphic = new THREE.Mesh(
			new THREE.PlaneGeometry(fw, state.fd),
			new THREE.MeshStandardMaterial({ color: state.fc, roughness: 1 }),
		)
		floorGraphic.rotation.x = -Math.PI / 2
		floorGraphic.position.set(0, 0.002, state.fd / 2)
		floorGraphic.receiveShadow = true
		floorGraphic.name = 'floorGraphic'
		this.setGroup.add(floorGraphic)

		this._syncPeople(state, crowd)
	}

	/**
	 * People: the posed UAL mannequin once loaded, the primitive stand-in until then. Cloning and
	 * posing is the expensive part, so figures are rebuilt only when a pose, height or colour
	 * changes; otherwise they are just moved.
	 */
	_syncPeople(state, crowd) {
		const key = JSON.stringify([!!this.model, state.mc, crowd.map((p) => [p.pose, p.height])])
		if (key !== this._peopleKey) {
			this._clearGroup(this.peopleGroup)
			this._peopleKey = key
			const materials = this.model ? mannequinMaterials(state.mc) : null
			for (const person of crowd) {
				let mannequin
				if (this.model) {
					mannequin = createPosedMannequin(this.model, person.pose, person.height, materials)
				} else {
					mannequin = createMannequin(state.mc)
					mannequin.scale.setScalar(person.height)
				}
				this.peopleGroup.add(mannequin)
			}
		}
		this.peopleGroup.children.forEach((m, i) => m.position.set(crowd[i].x, 0, crowd[i].z))
	}

	_updateCameraView(state) {
		this.cameraViewCam.position.set(0, state.ch, state.cz)
		this.cameraViewCam.rotation.set(0, 0, 0)
		this.cameraViewCam.rotation.x = -deg2rad(state.ct)
		this.cameraViewCam.fov = renderFit(state, this._viewportAspect || 1).fov
		this.cameraViewCam.updateProjectionMatrix()
	}

	_rebuildHelpers(state) {
		this._clearGroup(this.helperGroup)
		this._buildPlanHelpers(state)
		this._buildOrbitGizmo(state)
		this._buildSideHelpers(state)
		this._fitPlanCamera(state)
		this._fitSideCamera(state)
	}

	/**
	 * Side view: the frame's top and bottom edges and the optical axis, from the lens to wherever
	 * each ray first meets the backdrop plane (z=0) or the floor (y=0). Drawn in front of the set so
	 * the people don't hide them, over a 0.5 m elevation grid behind it.
	 */
	_buildSideHelpers(state) {
		const ct = deg2rad(state.ct)
		const fwd = [-Math.sin(ct), -Math.cos(ct)] // [y, z]
		const up = [Math.cos(ct), -Math.sin(ct)]
		const reach = Math.max(state.bw, floorWidth(state)) / 2 + 1
		const xFront = -reach
		const end = (v) => {
			const dy = fwd[0] + v * up[0]
			const dz = fwd[1] + v * up[1]
			const ts = []
			if (dz < 0) ts.push(-state.cz / dz)
			if (dy < 0) ts.push(-state.ch / dy)
			const t = ts.length ? Math.min(...ts) : state.cz + 2
			return [xFront, state.ch + t * dy, state.cz + t * dz]
		}
		const lens = [xFront, state.ch, state.cz]
		const tv = halfTans(state.f, state.ar, state.or).v
		this.helperGroup.add(this._fatLines([lens, end(tv), lens, end(-tv)], FRUSTUM_COLOR, 2, LAYER_SIDE))
		this.helperGroup.add(this._fatLines([lens, end(0)], FRUSTUM_COLOR, 1, LAYER_SIDE))
		const crop = cropFraction(state)
		if (crop && crop.h < 1) {
			this.helperGroup.add(this._fatLines([lens, end(tv * crop.h), lens, end(-tv * crop.h)], CROP_COLOR, 1, LAYER_SIDE))
		}

		const size = Math.ceil(Math.max(state.cz + 2, state.bh + 1, state.ch + 1)) * 2
		const grid = new THREE.GridHelper(size, size * 2, 0x808080, 0xa0a0a0)
		grid.rotation.z = Math.PI / 2
		grid.position.set(reach, size / 2, size / 2 - 1)
		grid.layers.set(LAYER_SIDE)
		this.helperGroup.add(grid)
	}

	_fitSideCamera(state, cam = this.sideCam, aspectRatio = this._viewportAspect || 1) {
		const tallest = Math.max(state.bh, state.ch, ...(this._lastCrowd || []).map((p) => p.top ?? p.height))
		const z0 = -0.6
		const z1 = state.cz + 0.6
		const y0 = -0.2
		const y1 = tallest + 0.5
		const midZ = (z0 + z1) / 2
		const midY = (y0 + y1) / 2
		let halfW = (z1 - z0) / 2
		let halfH = (y1 - y0) / 2
		if (aspectRatio >= halfW / halfH) halfW = halfH * aspectRatio
		else halfH = halfW / aspectRatio
		cam.left = -halfW
		cam.right = halfW
		cam.top = halfH
		cam.bottom = -halfH
		cam.position.set(-20, midY, midZ)
		cam.lookAt(0, midY, midZ)
		cam.updateProjectionMatrix()
	}

	_buildPlanHelpers(state) {
		const fw = floorWidth(state)
		// Whole-metre half-size with two divisions per metre gives exact 0.5 m squares, with lines
		// through the origin (backdrop centre, wall line).
		const extent = Math.ceil(Math.max(state.bw, fw, state.cz + 1) + 1)
		const grid = new THREE.GridHelper(extent * 2, extent * 4, 0x808080, 0xa0a0a0)
		grid.position.y = 0.003
		grid.layers.set(LAYER_HELPER)
		this.helperGroup.add(grid)

		// Horizontal frustum lines (true frame, no overscan) projected on the floor.
		const halfH = deg2rad(fovFromFocal(state.f, 'h', state.ar, state.or)) / 2
		const dirs = [
			[Math.sin(-halfH), -Math.cos(-halfH)],
			[Math.sin(halfH), -Math.cos(halfH)],
		]
		// Stop each edge at the backdrop plane (z=0), plus the centre line to the wall.
		const toWall = state.cz / Math.cos(halfH)
		const floorLines = []
		for (const [dx, dz] of dirs) floorLines.push([0, 0.004, state.cz], [dx * toWall, 0.004, state.cz + dz * toWall])
		this.helperGroup.add(this._fatLines(floorLines, FRUSTUM_COLOR, 2, LAYER_PLAN))
		this.helperGroup.add(this._fatLines([[0, 0.004, state.cz], [0, 0.004, 0]], FRUSTUM_COLOR, 1, LAYER_PLAN))
	}

	/** Pixel-width lines (WebGL's own lines are always 1 px). `points` are [x, y, z] segment pairs. */
	_fatLines(points, color, width, layer = LAYER_HELPER) {
		const geometry = new LineSegmentsGeometry().setPositions(points.flat())
		const material = new LineMaterial({ color, linewidth: width })
		material.resolution.copy(this._resolution)
		this._lineMaterials.add(material)
		const lines = new LineSegments2(geometry, material)
		lines.layers.set(layer)
		return lines
	}

	_buildOrbitGizmo(state) {
		const gizmoCam = new THREE.PerspectiveCamera()
		gizmoCam.position.set(0, state.ch, state.cz)
		gizmoCam.rotation.x = -deg2rad(state.ct)
		gizmoCam.updateProjectionMatrix()
		gizmoCam.updateMatrixWorld(true)

		// True-frame frustum (no overscan), from the lens out to the backdrop plane.
		const t = halfTans(state.f, state.ar, state.or)
		const depth = state.cz / Math.cos(deg2rad(state.ct))
		const apex = new THREE.Vector3(0, 0, 0).applyMatrix4(gizmoCam.matrixWorld).toArray()
		const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
			new THREE.Vector3(sx * t.h * depth, sy * t.v * depth, -depth).applyMatrix4(gizmoCam.matrixWorld).toArray(),
		)
		const segments = []
		for (let i = 0; i < 4; i++) segments.push(apex, corners[i], corners[i], corners[(i + 1) % 4])
		this.helperGroup.add(this._fatLines(segments, FRUSTUM_COLOR, 2, LAYER_ORBIT))
		// Centre line: the optical axis from the lens to the backdrop plane.
		const centre = new THREE.Vector3(0, 0, -depth).applyMatrix4(gizmoCam.matrixWorld).toArray()
		this.helperGroup.add(this._fatLines([apex, centre], FRUSTUM_COLOR, 1, LAYER_ORBIT))

		const body = new THREE.Mesh(
			new THREE.BoxGeometry(0.12, 0.08, 0.08),
			new THREE.MeshStandardMaterial({ color: 0x333333 }),
		)
		body.position.set(0, state.ch, state.cz)
		body.rotation.x = -deg2rad(state.ct)
		body.layers.set(LAYER_HELPER)
		this.helperGroup.add(body)
	}

	_fitPlanCamera(state, cam = this.planCam, aspectRatio = this._viewportAspect || 1) {
		const fw = floorWidth(state)
		const halfWidth = Math.max(state.bw, fw, state.cz * Math.tan(deg2rad(fovFromFocal(state.f, 'h', state.ar, state.or) / 2)) + 1) / 2 + 0.5
		const depth = Math.max(state.fd, state.cz) + 1.5
		const midZ = depth / 2 - 0.5
		let halfW = halfWidth
		let halfD = depth / 2
		if (aspectRatio >= halfW / halfD) {
			halfW = halfD * aspectRatio
		} else {
			halfD = halfW / aspectRatio
		}
		cam.left = -halfW
		cam.right = halfW
		cam.top = halfD
		cam.bottom = -halfD
		cam.near = 0.1
		cam.far = 60
		cam.position.set(0, 20, midZ)
		cam.lookAt(0, 0, midZ)
		cam.updateProjectionMatrix()
	}

	setView(view) {
		if (view === this.view) return
		// Glide from whatever is on screen now (mid-transition included) to the new view.
		if (this.view && this._lastState) {
			const from = this._anim ? this._anim.current : this._poseOf(this.view)
			this._anim = { from, to: this._poseOf(view), start: performance.now(), current: from }
			this.transitionCam.layers.mask = this._cameraFor(view).layers.mask
		}
		this.view = view
		this.orbitControls.enabled = view === 'orbit'
	}

	/** Project a world point [x, y, z] to viewport CSS pixels with whatever camera is on screen. */
	project([x, y, z], w, h) {
		const cam = this._anim ? this.transitionCam : this._activeCamera()
		const v = new THREE.Vector3(x, y, z).project(cam)
		return { x: (v.x + 1) * 0.5 * w, y: (1 - v.y) * 0.5 * h, behind: v.z > 1 }
	}

	/** True while a view transition is playing; the owner should keep rendering frames. */
	get animating() {
		return !!this._anim
	}

	/**
	 * A view's camera as a perspective-equivalent pose: the point it looks at, its orientation,
	 * the height of world it frames at that point, and its FOV. The orthographic top and side
	 * cameras sit 20 m from their look point, so a long lens at the same distance matches them
	 * exactly (fog included) and the hand-off at the end of a transition is seamless.
	 */
	_poseOf(view) {
		const cam = this._cameraFor(view)
		cam.updateMatrixWorld()
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
		let dist
		let fov
		if (cam.isOrthographicCamera) {
			dist = 20
			fov = THREE.MathUtils.radToDeg(2 * Math.atan((cam.top - cam.bottom) / 2 / dist))
		} else {
			fov = cam.fov
			dist = view === 'orbit'
				? cam.position.distanceTo(this.orbitControls.target)
				: Math.max(0.5, (this._lastState.cz - this._lastState.pz) / Math.cos(deg2rad(this._lastState.ct)))
		}
		const target = cam.position.clone().addScaledVector(forward, dist)
		const height = 2 * dist * Math.tan(deg2rad(fov) / 2)
		return { target, quat: cam.quaternion.clone(), height, fov }
	}

	_cameraFor(view) {
		if (view === 'top') return this.planCam
		if (view === 'side') return this.sideCam
		if (view === 'orbit') return this.orbitCam
		return this.cameraViewCam
	}

	/** Advance the transition and pose transitionCam; clears it once finished. */
	_stepTransition() {
		const a = this._anim
		const t = Math.min(1, (performance.now() - a.start) / TRANSITION_MS)
		const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
		const { from, to } = a
		// Blend framing height and lens in log space so zooms feel even; derive distance from both.
		const height = Math.exp(THREE.MathUtils.lerp(Math.log(from.height), Math.log(to.height), e))
		const lt = (fov) => Math.log(Math.tan(deg2rad(fov) / 2))
		const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.exp(THREE.MathUtils.lerp(lt(from.fov), lt(to.fov), e))))
		const quat = from.quat.clone().slerp(to.quat, e)
		const target = from.target.clone().lerp(to.target, e)
		const dist = height / (2 * Math.tan(deg2rad(fov) / 2))
		const cam = this.transitionCam
		cam.quaternion.copy(quat)
		cam.position.copy(target).addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(quat), -dist)
		cam.fov = fov
		cam.aspect = this._viewportAspect || 1
		cam.updateProjectionMatrix()
		a.current = { target, quat, height, fov }
		if (t >= 1) this._anim = null
	}

	resize(w, h) {
		this._viewportAspect = w / h
		this.renderer.setSize(w, h, false)
		this._resolution.set(w, h)
		for (const m of this._lineMaterials) m.resolution.set(w, h)
		this.cameraViewCam.aspect = w / h
		this.cameraViewCam.updateProjectionMatrix()
		this.orbitCam.aspect = w / h
		this.orbitCam.updateProjectionMatrix()
		if (this._lastState) {
			this._updateCameraView(this._lastState)
			this._fitPlanCamera(this._lastState)
			this._fitSideCamera(this._lastState)
		}
	}

	_activeCamera() {
		return this._cameraFor(this.view)
	}

	render() {
		if (this._anim) {
			this._stepTransition()
			if (this._anim) {
				this.renderer.render(this.scene, this.transitionCam)
				return
			}
		}
		if (this.view === 'orbit') this.orbitControls.update()
		this.renderer.render(this.scene, this._activeCamera())
	}

	/**
	 * Render the plan or side view into `target`, a 2D canvas elsewhere on the page, using a
	 * second small renderer so the main viewport is left untouched.
	 */
	renderAux(view, target) {
		const state = this._lastState
		const w = target.clientWidth
		const h = target.clientHeight
		if (!state || !w || !h) return
		const dpr = Math.min(window.devicePixelRatio || 1, 2)
		if (!this.auxRenderer) {
			this.auxRenderer = new THREE.WebGLRenderer({ antialias: true })
			this.auxRenderer.shadowMap.enabled = true
			this.auxRenderer.shadowMap.type = THREE.PCFShadowMap
		}
		this.auxRenderer.setPixelRatio(dpr)
		this.auxRenderer.setSize(w, h, false)
		const cam = this.auxCams[view]
		if (view === 'top') this._fitPlanCamera(state, cam, w / h)
		else this._fitSideCamera(state, cam, w / h)
		for (const m of this._lineMaterials) m.resolution.set(w, h)
		this.auxRenderer.render(this.scene, cam)
		for (const m of this._lineMaterials) m.resolution.copy(this._resolution)
		target.width = Math.round(w * dpr)
		target.height = Math.round(h * dpr)
		target.getContext('2d').drawImage(this.auxRenderer.domElement, 0, 0, target.width, target.height)
	}

	/** Render the current view and return it as a PNG blob, with `overlay` (a 2D canvas) on top. */
	async capture(overlay = null) {
		this.render()
		const source = this.renderer.domElement
		const out = document.createElement('canvas')
		out.width = source.width
		out.height = source.height
		const ctx = out.getContext('2d')
		ctx.drawImage(source, 0, 0)
		if (overlay) ctx.drawImage(overlay, 0, 0, out.width, out.height)
		return new Promise((resolve) => out.toBlob(resolve, 'image/png'))
	}

	dispose() {
		this.orbitControls.dispose()
		this._clearGroup(this.setGroup)
		this._clearGroup(this.peopleGroup)
		this._clearGroup(this.helperGroup)
		this.renderer.dispose()
		this.auxRenderer?.dispose()
	}
}

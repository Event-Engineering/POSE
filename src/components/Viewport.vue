<template>
	<div class="viewport" ref="stage">
		<canvas ref="canvasEl" class="render-canvas"></canvas>
		<canvas ref="overlayEl" class="overlay-canvas" :class="{ hidden: animating || (state.view !== 'camera' && !highlight) }"></canvas>

		<div class="float-bar float-tl btn-group" role="group" aria-label="View">
			<button
				v-for="v in VIEWS" :key="v.key" type="button"
				:class="{ active: state.view === v.key }"
				@click="state.view = v.key"
			>{{ v.label }}</button>
		</div>
		<div class="float-bar float-tr">
			<button type="button" @click="saveImage">Save image</button>
			<button type="button" @click="copyImage">Copy image</button>
		</div>
	</div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { state } from '../lib/state.js'
import { generateCrowd } from '../lib/crowd.js'
import { renderFit, cropFraction } from '../lib/lens.js'
import { PoseScene } from '../three/scene.js'
import { auxViews } from './aux-views.js'
import { downloadBlob, copyBlob, imageName } from './image-export.js'
import { highlight } from './highlight.js'
import { computeReadouts } from '../lib/readouts.js'
import { buildDimensions } from '../lib/dimensions.js'
import { formatLength } from '../lib/units.js'

const VIEWS = [
	{ key: 'camera', label: 'Camera' },
	{ key: 'top', label: 'Top' },
	{ key: 'side', label: 'Side' },
	{ key: 'orbit', label: 'Orbit' },
]

const stage = ref(null)
const canvasEl = ref(null)
const overlayEl = ref(null)

// The render always fills the viewport; in camera view the sensor frame is fitted inside it
// (see renderFit), so the extra space shows more of the scene around the shot.
const size = reactive({ w: 0, h: 0 })
let scene = null
let resizeObserver = null
let loopId = null
// True while the scene glides between views; the camera overlay fades back in when it lands.
const animating = ref(false)

const crowd = computed(() => generateCrowd(state))

function renderFrame() {
	if (!scene) return
	scene.update(state, crowd.value)
	scene.render()
	drawOverlay()
	for (const [view, canvas] of auxViews.targets) scene.renderAux(view, canvas)
}

const DIM_COLOURS = { ok: '#67c23a', warn: '#e6a23c', bad: '#f56c6c', null: '#3b82f6' }

/**
 * Camera view: dim outside the sensor frame, outline it in red and the crop (if any) dashed
 * cyan. Any view: while a readout card is hovered, draw its dimensions over the render.
 */
function drawOverlay() {
	const canvas = overlayEl.value
	if (!canvas || !size.w || !size.h) return
	const dpr = Math.min(window.devicePixelRatio || 1, 2)
	canvas.width = Math.round(size.w * dpr)
	canvas.height = Math.round(size.h * dpr)
	const ctx = canvas.getContext('2d')
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	if (state.view === 'camera') drawFrame(ctx, size.w, size.h)
	if (highlight.value && scene) drawDimensions(ctx, size.w, size.h)
}

function drawFrame(ctx, w, h) {
	const { frame } = renderFit(state, w / h)
	const fw = w * frame.w
	const fh = h * frame.h
	const fx = (w - fw) / 2
	const fy = (h - fh) / 2

	ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
	ctx.fillRect(0, 0, w, h)
	ctx.clearRect(fx, fy, fw, fh)

	ctx.strokeStyle = '#ff2020'
	ctx.lineWidth = 2
	ctx.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2)

	const crop = cropFraction(state)
	if (crop) {
		const cw = fw * crop.w
		const ch = fh * crop.h
		ctx.strokeStyle = '#22d3ee'
		ctx.setLineDash([6, 5])
		ctx.strokeRect(fx + (fw - cw) / 2 + 1, fy + (fh - ch) / 2 + 1, cw - 2, ch - 2)
		ctx.setLineDash([])
	}
}

function drawDimensions(ctx, w, h) {
	const dims = buildDimensions(highlight.value, state, computeReadouts(state, crowd.value), crowd.value)
	ctx.font = '600 12px oxanium, sans-serif'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	for (const d of dims) {
		const a = scene.project(d.a, w, h)
		const b = scene.project(d.b, w, h)
		if (a.behind || b.behind) continue
		const colour = DIM_COLOURS[d.status]
		const dx = b.x - a.x
		const dy = b.y - a.y
		const len = Math.hypot(dx, dy)
		// Unit normal for the end ticks.
		const nx = len ? -dy / len : 0
		const ny = len ? dx / len : 1

		ctx.strokeStyle = colour
		ctx.lineWidth = 2
		ctx.beginPath()
		ctx.moveTo(a.x, a.y)
		ctx.lineTo(b.x, b.y)
		for (const p of [a, b]) {
			ctx.moveTo(p.x - nx * 6, p.y - ny * 6)
			ctx.lineTo(p.x + nx * 6, p.y + ny * 6)
		}
		ctx.stroke()

		const text = (d.label ? d.label + ' ' : '') + formatLength(d.value, state.units)
		const tw = ctx.measureText(text).width + 12
		// Sit the label beside the line (above horizontals, right of verticals) so short
		// dimensions stay visible.
		const side = ny < -0.3 || (Math.abs(ny) <= 0.3 && nx > 0) ? 1 : -1
		const mx = (a.x + b.x) / 2 + nx * side * 16
		const my = (a.y + b.y) / 2 + ny * side * 16
		ctx.fillStyle = 'rgba(20, 20, 20, 0.85)'
		ctx.beginPath()
		ctx.roundRect(mx - tw / 2, my - 10, tw, 20, 4)
		ctx.fill()
		ctx.fillStyle = colour
		ctx.fillText(text, mx, my + 1)
	}
}

async function captureBlob() {
	drawOverlay()
	return scene?.capture(state.view === 'camera' ? overlayEl.value : null)
}

async function saveImage() {
	downloadBlob(await captureBlob(), imageName(state.view))
}

async function copyImage() {
	copyBlob(await captureBlob())
}

// Continuous rendering, only while needed: orbiting (damped controls) or a view transition.
function ensureLoop() {
	if (loopId != null) return
	const step = () => {
		if (!scene || (state.view !== 'orbit' && !scene.animating)) {
			loopId = null
			animating.value = false
			drawOverlay()
			return
		}
		scene.render()
		animating.value = scene.animating
		// Dimensions follow the orbiting camera.
		if (highlight.value && !scene.animating) drawOverlay()
		loopId = requestAnimationFrame(step)
	}
	loopId = requestAnimationFrame(step)
}

watch(() => state.view, (view) => {
	scene?.setView(view)
	animating.value = !!scene?.animating
	renderFrame()
	ensureLoop()
})

watch(size, ({ w, h }) => {
	if (!scene || !w || !h) return
	scene.resize(w, h)
	renderFrame()
})

watch(state, renderFrame, { deep: true })
watch(highlight, drawOverlay)

onMounted(() => {
	scene = new PoseScene(canvasEl.value)
	scene.onModelLoad = renderFrame
	auxViews.request = renderFrame
	scene.setView(state.view)

	resizeObserver = new ResizeObserver(([entry]) => {
		if (!entry) return
		size.w = Math.round(entry.contentRect.width)
		size.h = Math.round(entry.contentRect.height)
	})
	resizeObserver.observe(stage.value)

	ensureLoop()
})

onBeforeUnmount(() => {
	if (loopId != null) cancelAnimationFrame(loopId)
	resizeObserver?.disconnect()
	scene?.dispose()
})
</script>

<style scoped>
.viewport {
	position: relative;
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;
	overflow: hidden;
	background: var(--bg);
}

.render-canvas,
.overlay-canvas {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	display: block;
}

.overlay-canvas {
	pointer-events: none;
	transition: opacity 0.2s ease;
}

.overlay-canvas.hidden {
	opacity: 0;
}
</style>

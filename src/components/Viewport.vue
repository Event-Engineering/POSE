<template>
	<div class="viewport">
		<div class="viewport-stage" ref="stage">
			<div class="canvas-frame" :style="{ width: frameSize.w + 'px', height: frameSize.h + 'px' }">
				<canvas ref="canvasEl" class="render-canvas"></canvas>
				<canvas ref="overlayEl" class="overlay-canvas" v-show="state.view === 'camera'"></canvas>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { state } from '../lib/state.js'
import { generateCrowd } from '../lib/crowd.js'
import { aspect, overscanScale, cropFraction } from '../lib/lens.js'
import { PoseScene } from '../three/scene.js'

// View switching, snap-to-camera and export controls live in the app header (App.vue); this
// component exposes the handlers that need the internal scene/overlay instances.
const props = defineProps({
	exportMode: { type: String, default: 'frame' },
})

const stage = ref(null)
const canvasEl = ref(null)
const overlayEl = ref(null)

const containerSize = reactive({ w: 0, h: 0 })
let scene = null
let resizeObserver = null
let orbitRafId = null

const frameSize = computed(() => {
	const cw = containerSize.w
	const ch = containerSize.h
	if (!cw || !ch) return { w: 1, h: 1 }
	if (state.view !== 'camera') return { w: Math.round(cw), h: Math.round(ch) }
	const targetAspect = aspect(state.ar, state.or)
	let w = cw
	let h = cw / targetAspect
	if (h > ch) {
		h = ch
		w = ch * targetAspect
	}
	return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
})

const crowd = computed(() => generateCrowd(state))

function renderFrame() {
	if (!scene) return
	scene.update(state, crowd.value)
	scene.render()
	drawOverlay()
}

function drawOverlay() {
	if (state.view !== 'camera' || !overlayEl.value) return
	const canvas = overlayEl.value
	const ctx = canvas.getContext('2d')
	const w = canvas.width
	const h = canvas.height
	ctx.clearRect(0, 0, w, h)
	if (!w || !h) return

	// Dim the overscan area outside the true sensor frame.
	const frac = 1 / overscanScale(state)
	const fw = w * frac
	const fh = h * frac
	const fx = (w - fw) / 2
	const fy = (h - fh) / 2

	ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
	ctx.fillRect(0, 0, w, h)
	ctx.clearRect(fx, fy, fw, fh)

	// True sensor frame: solid, clearly-defined pure red.
	ctx.strokeStyle = '#ff2020'
	ctx.lineWidth = 2
	ctx.setLineDash([])
	ctx.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2)

	// Post-crop, if set: dashed, contrasting colour, inside the sensor frame.
	const crop = cropFraction(state)
	if (crop) {
		const cw = fw * crop.w
		const ch = fh * crop.h
		const cx = fx + (fw - cw) / 2
		const cy = fy + (fh - ch) / 2
		ctx.strokeStyle = '#22d3ee'
		ctx.lineWidth = 2
		ctx.setLineDash([6, 5])
		ctx.strokeRect(cx + 1, cy + 1, cw - 2, ch - 2)
		ctx.setLineDash([])
	}
}

function snapToCamera() {
	scene?.snapToCamera()
	state.view = 'camera'
}

function download(blob, filename) {
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}

async function captureBlob() {
	// Make sure the overlay reflects the camera view before compositing it.
	drawOverlay()
	return scene.capture(props.exportMode, overlayEl.value)
}

async function savePng() {
	if (!scene) return
	const blob = await captureBlob()
	if (blob) download(blob, `pose-${props.exportMode}.png`)
}

async function copyImage() {
	if (!scene || !navigator.clipboard?.write) return
	const blob = await captureBlob()
	if (!blob) return
	await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch((err) => console.warn('POSE: copy image failed', err))
}

function ensureOrbitLoop() {
	if (orbitRafId != null) return
	const step = () => {
		if (state.view !== 'orbit') {
			orbitRafId = null
			return
		}
		renderFrame()
		orbitRafId = requestAnimationFrame(step)
	}
	orbitRafId = requestAnimationFrame(step)
}

watch(() => state.view, (view) => {
	scene?.setView(view)
	if (view === 'orbit') ensureOrbitLoop()
	else renderFrame()
})

watch(frameSize, ({ w, h }) => {
	if (!scene) return
	scene.resize(w, h)
	if (overlayEl.value) {
		overlayEl.value.width = w
		overlayEl.value.height = h
	}
	renderFrame()
}, { deep: true })

watch(state, () => {
	if (state.view !== 'orbit') renderFrame()
}, { deep: true })

onMounted(() => {
	scene = new PoseScene(canvasEl.value)
	scene.onModelLoad = renderFrame
	scene.setView(state.view)

	resizeObserver = new ResizeObserver((entries) => {
		const entry = entries[0]
		if (!entry) return
		containerSize.w = entry.contentRect.width
		containerSize.h = entry.contentRect.height
	})
	resizeObserver.observe(stage.value)

	if (state.view === 'orbit') ensureOrbitLoop()
})

onBeforeUnmount(() => {
	if (orbitRafId != null) cancelAnimationFrame(orbitRafId)
	resizeObserver?.disconnect()
	scene?.dispose()
})

defineExpose({ snapToCamera, savePng, copyImage })
</script>

<style scoped>
.viewport {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;
}

.viewport-stage {
	flex: 1 1 auto;
	min-width: 0;
	min-height: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--bg);
	overflow: hidden;
}

.canvas-frame {
	position: relative;
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
}
</style>

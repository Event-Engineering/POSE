<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { auxViews } from './aux-views.js'
import { canvasToBlob, downloadBlob, copyBlob, imageName } from './image-export.js'

// Desktop-only right-hand column with live top and side views, each with its own save/copy.
// They are independent of the main viewport's view.
const panels = [
	{ view: 'top', label: 'Top' },
	{ view: 'side', label: 'Side' },
]
const canvases = ref([])
let observer

// Each panel canvas already holds its latest render at device resolution.
async function saveImage(view, i) {
	downloadBlob(await canvasToBlob(canvases.value[i]), imageName(view))
}

async function copyImage(i) {
	copyBlob(await canvasToBlob(canvases.value[i]))
}

// Width is draggable from the left edge and remembered per viewer (a convenience, not URL state).
const MIN_WIDTH = 220
const WIDTH_KEY = 'pose.viewPanelsWidth'
const width = ref(readWidth())
const dragging = ref(false)

function readWidth() {
	try {
		const w = Number(localStorage.getItem(WIDTH_KEY))
		if (w >= MIN_WIDTH) return w
	} catch {}
	return 340
}

function startDrag(e) {
	const startX = e.clientX
	const startW = width.value
	// Leave the main viewport at least 40% of the row.
	const maxW = Math.max(MIN_WIDTH, e.currentTarget.parentElement.parentElement.clientWidth * 0.6)
	const move = (ev) => {
		width.value = Math.round(Math.min(maxW, Math.max(MIN_WIDTH, startW + startX - ev.clientX)))
	}
	const up = () => {
		window.removeEventListener('pointermove', move)
		window.removeEventListener('pointerup', up)
		dragging.value = false
		document.body.classList.remove('resizing-x')
		try {
			localStorage.setItem(WIDTH_KEY, String(width.value))
		} catch {}
	}
	window.addEventListener('pointermove', move)
	window.addEventListener('pointerup', up)
	dragging.value = true
	document.body.classList.add('resizing-x')
	e.preventDefault()
}

onMounted(() => {
	panels.forEach((p, i) => auxViews.targets.set(p.view, canvases.value[i]))
	observer = new ResizeObserver(() => auxViews.request?.())
	canvases.value.forEach((c) => observer.observe(c))
	auxViews.request?.()
})

onBeforeUnmount(() => {
	observer?.disconnect()
	panels.forEach((p) => auxViews.targets.delete(p.view))
})
</script>

<template>
	<aside class="view-panels" :style="{ flexBasis: width + 'px' }">
		<div class="drag-handle" :class="{ dragging }" role="separator" aria-orientation="vertical" aria-label="Resize top and side views" @pointerdown="startDrag"></div>
		<div v-for="(p, i) in panels" :key="p.view" class="view-panel">
			<span class="panel-label">{{ p.label }}</span>
			<div class="float-bar panel-actions">
				<button type="button" @click="saveImage(p.view, i)">Save</button>
				<button type="button" @click="copyImage(i)">Copy</button>
			</div>
			<canvas :ref="(el) => (canvases[i] = el)" class="panel-canvas"></canvas>
		</div>
	</aside>
</template>

<style scoped>
.view-panels {
	position: relative;
	flex: 0 0 340px;
	display: flex;
	flex-direction: column;
	gap: 0.75em;
	padding: 0.75em;
	background: var(--panel);
	border-left: 1px solid var(--border);
	min-height: 0;
}

.drag-handle {
	position: absolute;
	top: 0;
	bottom: 0;
	left: -3px;
	width: 7px;
	cursor: col-resize;
	z-index: 2;
}

.drag-handle:hover,
.drag-handle.dragging {
	background: var(--accent);
	opacity: 0.6;
}

.view-panel {
	position: relative;
	flex: 1 1 0;
	min-height: 0;
	padding: 0;
	overflow: hidden;
	border: 1px solid var(--border);
	border-radius: var(--radius);
	background: var(--panel-2);
}

.panel-actions {
	top: 0.5em;
	right: 0.5em;
}

.panel-actions button {
	font-size: 0.75em;
	padding: 0.3em 0.6em;
}

.panel-label {
	position: absolute;
	top: 0.5em;
	left: 0.6em;
	z-index: 1;
	padding: 0.15em 0.5em;
	font-size: 0.75em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #fff;
	background: rgba(0, 0, 0, 0.55);
	border-radius: var(--radius);
}

.panel-canvas {
	display: block;
	width: 100%;
	height: 100%;
}

/* Desktop only: below this width the main view switcher covers top and side. */
@media (max-width: 1279px) {
	.view-panels {
		display: none;
	}
}
</style>

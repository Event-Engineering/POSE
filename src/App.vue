<script setup>
import poweredBy from './assets/ee-powered-by.svg'
import { ref } from 'vue'
import { loadFromUrl, startUrlSync, state } from './lib/state.js'
import Sidebar from './components/Sidebar.vue'
import Viewport from './components/Viewport.vue'
import Readouts from './components/Readouts.vue'
import ViewPanels from './components/ViewPanels.vue'

loadFromUrl()
startUrlSync()

const views = [
	{ key: 'camera', label: 'Camera' },
	{ key: 'top', label: 'Top' },
	{ key: 'side', label: 'Side' },
	{ key: 'orbit', label: 'Orbit' },
]

const exportMode = ref('frame')
const viewport = ref(null)

function setView(v) {
	state.view = v
}

function snapToCamera() {
	viewport.value?.snapToCamera()
}

function copyLink() {
	navigator.clipboard?.writeText(location.href).catch((err) => console.warn('POSE: copy link failed', err))
}

function savePng() {
	viewport.value?.savePng()
}

function copyImage() {
	viewport.value?.copyImage()
}
</script>

<template>
	<div class="app-shell">
		<aside class="sidebar">
			<Sidebar />
			<footer class="sidebar-footer">
				<a href="https://event.engineering" target="_blank" rel="noopener">
					<img :src="poweredBy" alt="Powered by Event Engineering" />
				</a>
			</footer>
		</aside>
		<div class="main-column">
			<header class="app-header">
				<div class="header-side header-left">
					<div class="btn-group seg-group">
						<button
							v-for="v in views"
							:key="v.key"
							type="button"
							:class="{ active: state.view === v.key }"
							@click="setView(v.key)"
						>{{ v.label }}</button>
					</div>
					<button v-if="state.view === 'orbit'" type="button" class="tool-btn" @click="snapToCamera">Snap to camera</button>
				</div>
				<div class="title-block">
					<h1>POSE</h1>
					<p class="subtitle">Photo Optics and Spatial Estimator</p>
				</div>
				<div class="header-side header-right">
					<button type="button" class="tool-btn" @click="copyLink">Copy link</button>
					<select v-model="exportMode" class="export-select">
						<option value="frame">True frame</option>
						<option value="crop">Crop</option>
						<option value="overscan">Overscan</option>
					</select>
					<button type="button" class="tool-btn" @click="savePng">Save PNG</button>
					<button type="button" class="tool-btn" @click="copyImage">Copy image</button>
				</div>
			</header>
			<main class="viewport-area">
				<div class="viewport-row">
					<div class="viewport-wrap">
						<Viewport ref="viewport" :export-mode="exportMode" />
					</div>
					<ViewPanels />
				</div>
				<Readouts />
			</main>
		</div>
	</div>
</template>

<style scoped>
.app-shell {
	display: flex;
	width: 100%;
	height: 100%;
}

.main-column {
	flex: 1 1 auto;
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
}

.app-header {
	container-type: inline-size;
	flex: 0 0 auto;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1em;
	padding: 0.75em 1.25em;
	background: var(--panel);
	border-bottom: 1px solid var(--border);
	flex-wrap: wrap;
	row-gap: 0.5em;
}

.header-side {
	flex: 1 0 auto;
	display: flex;
	align-items: center;
	gap: 0.6em;
	min-width: 0;
}

.header-left {
	justify-content: flex-start;
}

.header-right {
	justify-content: flex-end;
}

.title-block {
	flex: 0 0 auto;
	text-align: center;
}

.title-block h1 {
	font-size: 1.4em;
	color: var(--accent);
	letter-spacing: 0.03em;
	line-height: 1;
}

.subtitle {
	margin: 0.2em 0 0;
	font-size: 0.72em;
	color: var(--muted);
	white-space: nowrap;
}

/* One look for every header control: the view switcher, export select and tool buttons. */
.seg-group button,
.tool-btn,
.export-select {
	box-sizing: border-box;
	height: 2.3em;
	padding: 0 0.85em;
	font: inherit;
	font-size: 0.9em;
	line-height: 1;
	color: var(--text);
	background: var(--panel-2, var(--panel));
	white-space: nowrap;
	cursor: pointer;
}

.tool-btn,
.export-select {
	border: 1px solid var(--border);
	border-radius: var(--radius, 6px);
}

.seg-group button.active {
	background: var(--accent);
	color: #fff;
}

.seg-group button:not(.active):hover,
.tool-btn:hover {
	color: var(--accent);
}

.tool-btn:hover {
	border-color: var(--accent);
}

.sidebar {
	flex: 0 0 380px;
	width: 380px;
	height: 100%;
	overflow-y: auto;
	background: var(--panel);
	border-right: 1px solid var(--border);
	display: flex;
	flex-direction: column;
}

.viewport-area {
	flex: 1 1 auto;
	min-width: 0;
	min-height: 0;
	display: flex;
	flex-direction: column;
	position: relative;
	overflow: hidden;
}

.viewport-row {
	flex: 1 1 auto;
	display: flex;
	min-height: 0;
}

.viewport-wrap {
	flex: 1 1 auto;
	min-width: 0;
	min-height: 0;
	position: relative;
}
.sidebar-footer {
	margin-top: auto;
	padding: 1.25em;
	border-top: 1px solid var(--border);
	display: flex;
	justify-content: center;
}

.sidebar-footer img {
	display: block;
	width: 200px;
	max-width: 100%;
	height: auto;
}
/* Narrow header (e.g. with the desktop top/side panels open): drop the subtitle first. */
@container (max-width: 980px) {
	.subtitle {
		display: none;
	}
}
</style>

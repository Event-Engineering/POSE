<script setup>
import poweredBy from './assets/ee-powered-by.svg'
import { ref } from 'vue'
import { loadFromUrl, startUrlSync, state } from './lib/state.js'
import Sidebar from './components/Sidebar.vue'
import Viewport from './components/Viewport.vue'
import Readouts from './components/Readouts.vue'

loadFromUrl()
startUrlSync()

const views = [
	{ key: 'camera', label: 'Camera' },
	{ key: 'plan', label: 'Plan' },
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
				<div class="viewport-wrap">
					<Viewport ref="viewport" :export-mode="exportMode" />
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
	flex: 1 1 0;
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

.seg-group button {
	white-space: nowrap;
}

.tool-btn,
.export-select {
	background: var(--panel-2, var(--panel));
	color: var(--text);
	border: 1px solid var(--border);
	border-radius: var(--radius, 6px);
	padding: 0.35em 0.6em;
	cursor: pointer;
	font: inherit;
	white-space: nowrap;
}

.tool-btn:hover {
	border-color: var(--accent);
	color: var(--accent);
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

.viewport-wrap {
	flex: 1 1 auto;
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
</style>

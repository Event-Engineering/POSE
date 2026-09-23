<script setup>
import poweredBy from './assets/ee-powered-by.svg'
import { computed, watchEffect } from 'vue'
import { loadFromUrl, startUrlSync, state } from './lib/state.js'
import { YMCA } from './lib/poses.js'
import Sidebar from './components/Sidebar.vue'
import Viewport from './components/Viewport.vue'
import Readouts from './components/Readouts.vue'
import ViewPanels from './components/ViewPanels.vue'

loadFromUrl()
startUrlSync()

// Easter egg: double-click the title for four people doing the YMCA; again to go back.
const ymca = computed(() => state.po === YMCA)
const PAGE_TITLE = document.title

function toggleYmca() {
	window.getSelection()?.removeAllRanges()
	if (ymca.value) {
		state.po = 'stand'
		return
	}
	Object.assign(state, { po: YMCA, n: 4, hm: 'avg', gap: 0.2 })
}

watchEffect(() => {
	document.title = ymca.value ? 'YMCA' : PAGE_TITLE
})

function copyLink() {
	navigator.clipboard?.writeText(location.href).catch((err) => console.warn('POSE: copy link failed', err))
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
				<div class="header-side header-left"></div>
				<div class="title-block">
					<h1 @dblclick="toggleYmca">{{ ymca ? 'YMCA' : 'POSE' }}</h1>
					<p class="subtitle">Photo Optics and Spatial Estimator</p>
				</div>
				<div class="header-side header-right">
					<div class="btn-group units-toggle" role="group" aria-label="Units">
						<button type="button" :class="{ active: state.units === 'mm' }" @click="state.units = 'mm'">mm</button>
						<button type="button" :class="{ active: state.units === 'ftin' }" @click="state.units = 'ftin'">ft&#8211;in</button>
					</div>
					<button type="button" class="tool-btn" @click="copyLink">Copy link</button>
				</div>
			</header>
			<main class="viewport-area">
				<div class="viewport-row">
					<div class="viewport-wrap">
						<Viewport />
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
	user-select: none;
	cursor: default;
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

.tool-btn {
	box-sizing: border-box;
	height: 2.3em;
	padding: 0 0.85em;
	font: inherit;
	font-size: 0.9em;
	line-height: 1;
	color: var(--text);
	background: var(--panel-2, var(--panel));
	border: 1px solid var(--border);
	border-radius: var(--radius, 6px);
	white-space: nowrap;
	cursor: pointer;
}

.units-toggle button {
	box-sizing: border-box;
	/* The group's 1px border wraps the buttons; match Copy link's overall height. */
	height: calc(2.3em - 2px);
	padding: 0 0.75em;
	font-size: 0.9em;
	line-height: 1;
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

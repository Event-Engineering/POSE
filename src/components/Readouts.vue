<script setup>
import { computed, ref } from 'vue'
import { state } from '../lib/state.js'
import { fovs } from '../lib/lens.js'
import { generateCrowd } from '../lib/crowd.js'
import { computeReadouts, marginStatus } from '../lib/readouts.js'
import { highlight } from './highlight.js'
import { formatLength, formatAngle } from '../lib/units.js'

const STORAGE_KEY = 'pose.readoutsOpen'

function loadOpen() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (raw === null) return true
		return raw === '1'
	} catch {
		return true
	}
}

const isOpen = ref(loadOpen())

function toggle() {
	isOpen.value = !isOpen.value
	try {
		localStorage.setItem(STORAGE_KEY, isOpen.value ? '1' : '0')
	} catch {
		// Best-effort only; ignore storage failures (private mode, quota, etc).
	}
}

const crowd = computed(() => generateCrowd(state))
const readouts = computed(() => computeReadouts(state, crowd.value))
const fov = computed(() => fovs(state))

function fmt(m) {
	return formatLength(m, state.units)
}

function cls(m) {
	return 'status-' + marginStatus(m)
}

// Every margin-style reading, used to find the single worst one for the collapsed summary bar.
const margins = computed(() => {
	const r = readouts.value
	const list = [
		{ label: 'Spill top', value: r.sensor.spill.top },
		{ label: 'Spill left', value: r.sensor.spill.left },
		{ label: 'Spill right', value: r.sensor.spill.right },
		{ label: 'Headroom', value: r.headroom },
		{ label: 'Clearance left', value: r.sideClearance.left },
		{ label: 'Clearance right', value: r.sideClearance.right },
	]
	if (r.crop) {
		list.push(
			{ label: 'Crop spill top', value: r.crop.spill.top },
			{ label: 'Crop spill left', value: r.crop.spill.left },
			{ label: 'Crop spill right', value: r.crop.spill.right },
		)
	}
	return list.filter((m) => Number.isFinite(m.value))
})

const summary = computed(() => {
	const bad = margins.value.filter((m) => marginStatus(m.value) === 'bad')
	const warn = margins.value.filter((m) => marginStatus(m.value) === 'warn')
	const pool = bad.length ? bad : warn
	if (!pool.length) return { text: 'All clear', status: 'ok' }
	const worst = pool.reduce((a, b) => (b.value < a.value ? b : a))
	return { text: `${worst.label}: ${fmt(worst.value)}`, status: marginStatus(worst.value) }
})
</script>

<template>
	<section class="readouts-drawer" :class="{ open: isOpen }">
		<div class="drawer-bar">
			<button type="button" class="drawer-handle" @click="toggle">
				<span class="drawer-title">Readouts</span>
				<span v-if="!isOpen" class="drawer-summary" :class="'status-' + summary.status">{{ summary.text }}</span>
			</button>
			<button type="button" class="drawer-arrow" :aria-label="isOpen ? 'Hide readouts' : 'Show readouts'" @click="toggle">
				{{ isOpen ? '▼' : '▲' }}
			</button>
		</div>
		<div v-show="isOpen" class="drawer-body">
			<div class="rcard" :class="{ hot: highlight === 'spill' }" @mouseenter="highlight = 'spill'" @mouseleave="highlight = null">
				<div class="rcard-title">Scene spill (sensor)</div>
				<div class="rline"><span>Top</span><span :class="cls(readouts.sensor.spill.top)">{{ fmt(readouts.sensor.spill.top) }}</span></div>
				<div class="rline"><span>Left</span><span :class="cls(readouts.sensor.spill.left)">{{ fmt(readouts.sensor.spill.left) }}</span></div>
				<div class="rline"><span>Right</span><span :class="cls(readouts.sensor.spill.right)">{{ fmt(readouts.sensor.spill.right) }}</span></div>
			</div>

			<div class="rcard" v-if="readouts.crop" :class="{ hot: highlight === 'cropSpill' }" @mouseenter="highlight = 'cropSpill'" @mouseleave="highlight = null">
				<div class="rcard-title">Scene spill (crop)</div>
				<div class="rline"><span>Top</span><span :class="cls(readouts.crop.spill.top)">{{ fmt(readouts.crop.spill.top) }}</span></div>
				<div class="rline"><span>Left</span><span :class="cls(readouts.crop.spill.left)">{{ fmt(readouts.crop.spill.left) }}</span></div>
				<div class="rline"><span>Right</span><span :class="cls(readouts.crop.spill.right)">{{ fmt(readouts.crop.spill.right) }}</span></div>
			</div>

			<div class="rcard" :class="{ hot: highlight === 'floor' }" @mouseenter="highlight = 'floor'" @mouseleave="highlight = null">
				<div class="rcard-title">Floor</div>
				<div class="rline"><span>Hits floor</span><span>{{ readouts.sensor.floor.hitsFloor ? 'Yes' : 'No' }}</span></div>
				<div class="rline"><span>Reach</span><span>{{ readouts.sensor.floor.hitsFloor ? fmt(readouts.sensor.floor.farthestZ) : '—' }}</span></div>
				<div class="rline"><span>Beyond graphic</span>
					<span :class="readouts.sensor.floor.beyondGraphic ? 'status-warn' : 'status-ok'">
						{{ readouts.sensor.floor.beyondGraphic ? 'Yes' : 'No' }}
					</span>
				</div>
			</div>

			<div class="rcard" :class="{ hot: highlight === 'coverage' }" @mouseenter="highlight = 'coverage'" @mouseleave="highlight = null">
				<div class="rcard-title">Coverage at people</div>
				<div class="rline"><span>Width</span><span>{{ fmt(readouts.coverage.width) }}</span></div>
				<div class="rline"><span>Height</span><span>{{ fmt(readouts.coverage.height) }}</span></div>
				<div class="rline" v-if="readouts.coverage.crop">
					<span>Crop width</span><span>{{ fmt(readouts.coverage.crop.width) }}</span>
				</div>
				<div class="rline" v-if="readouts.coverage.crop">
					<span>Crop height</span><span>{{ fmt(readouts.coverage.crop.height) }}</span>
				</div>
			</div>

			<div class="rcard" :class="{ hot: highlight === 'headroom' }" @mouseenter="highlight = 'headroom'" @mouseleave="highlight = null">
				<div class="rcard-title">Headroom &amp; clearance</div>
				<div class="rline"><span>Headroom</span><span :class="cls(readouts.headroom)">{{ fmt(readouts.headroom) }}</span></div>
				<div class="rline"><span>Clearance L</span><span :class="cls(readouts.sideClearance.left)">{{ fmt(readouts.sideClearance.left) }}</span></div>
				<div class="rline"><span>Clearance R</span><span :class="cls(readouts.sideClearance.right)">{{ fmt(readouts.sideClearance.right) }}</span></div>
			</div>

			<div class="rcard" :class="{ hot: highlight === 'footprint' }" @mouseenter="highlight = 'footprint'" @mouseleave="highlight = null">
				<div class="rcard-title">Footprint</div>
				<div class="rline"><span>Width</span><span>{{ fmt(readouts.footprint.width) }}</span></div>
				<div class="rline"><span>Depth</span><span>{{ fmt(readouts.footprint.depth) }}</span></div>
			</div>

			<div class="rcard">
				<div class="rcard-title">Lens</div>
				<div class="rline"><span>Focal</span><span>{{ state.f.toFixed(1) }} mm</span></div>
				<div class="rline"><span>H FOV</span><span>{{ formatAngle(fov.h) }}</span></div>
				<div class="rline"><span>V FOV</span><span>{{ formatAngle(fov.v) }}</span></div>
				<div class="rline"><span>D FOV</span><span>{{ formatAngle(fov.d) }}</span></div>
			</div>
		</div>
	</section>
</template>

<style scoped>
.readouts-drawer {
	flex: 0 0 auto;
	background: var(--panel);
	border-top: 1px solid var(--border);
	display: flex;
	flex-direction: column;
	max-height: 45%;
}

.drawer-bar {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
	gap: 0.5em;
	padding-right: 0.5em;
}

.drawer-handle {
	flex: 1 1 auto;
	display: flex;
	align-items: center;
	gap: 0.75em;
	min-width: 0;
	background: none;
	border: none;
	border-radius: 0;
	padding: 0.5em 1em;
	font-family: var(--font);
	cursor: pointer;
	color: var(--text);
}

.drawer-handle:hover {
	color: var(--accent);
}

.drawer-title {
	font-weight: 700;
	font-size: 0.85em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.drawer-summary {
	font-size: 0.85em;
	font-weight: 600;
}

.drawer-arrow {
	background: none;
	border: none;
	padding: 0.4em 0.6em;
	cursor: pointer;
	color: var(--accent);
	font-size: 0.8em;
}

.drawer-body {
	flex: 1 1 auto;
	min-height: 0;
	overflow: auto;
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	gap: 1em;
	padding: 0 1em 1em;
}

.rcard {
	flex: 1 1 180px;
	min-width: 160px;
	background: var(--panel-2);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	padding: 0.75em 0.9em;
}

.rcard-title {
	font-size: 0.72em;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--muted);
	margin-bottom: 0.5em;
}

.rline {
	display: flex;
	justify-content: space-between;
	font-size: 0.85em;
	padding: 0.15em 0;
}
.rcard {
	transition: border-color 0.15s ease;
}

.rcard.hot {
	border-color: var(--accent);
}
</style>

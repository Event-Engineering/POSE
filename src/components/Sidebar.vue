<script setup>
import { computed } from 'vue'
import { state, RANGES, floorWidth } from '../lib/state.js'
import { fovs, focalFromFov } from '../lib/lens.js'
import Accordion from './controls/Accordion.vue'
import LengthField from './controls/LengthField.vue'
import NumberSlider from './controls/NumberSlider.vue'
import RangeSlider2 from './controls/RangeSlider2.vue'
import SegButtons from './controls/SegButtons.vue'
import { POSE_META, enabledPoses } from '../lib/poses.js'

const arOptions = [
	{ value: '3:2', label: '3:2' },
	{ value: '16:9', label: '16:9' },
	{ value: '4:3', label: '4:3' },
]
const orOptions = [
	{ value: 'land', label: 'Landscape' },
	{ value: 'port', label: 'Portrait' },
]
const fovtOptions = [
	{ value: 'd', label: 'D' },
	{ value: 'h', label: 'H' },
	{ value: 'v', label: 'V' },
]
// Post-crops, grouped by the shape of the final image.
const cropGroups = [
	{ label: 'Square', options: ['1:1'] },
	{ label: 'Portrait', options: ['4:5', '3:4', '2:3', '9:16'] },
	{ label: 'Landscape', options: ['5:4', '4:3', '3:2', '16:9'] },
]
const hmOptions = [
	{ value: 'avg', label: 'Average' },
	{ value: 'mix', label: 'Mixed' },
]

const followFloorWidth = computed({
	get: () => state.fw == null,
	set: (v) => { state.fw = v ? null : state.bw },
})

const effectiveFloorWidth = computed({
	get: () => floorWidth(state),
	set: (v) => { state.fw = v },
})

const currentFov = computed({
	get: () => fovs(state)[state.fovt],
	set: (v) => { state.f = focalFromFov(v, state.fovt, state.ar, state.or) },
})

const poses = computed(() => enabledPoses(state.po))

// Toggle a pose in the pool; the last enabled pose can't be switched off.
function togglePose(id) {
	const on = poses.value.includes(id)
	if (on && poses.value.length === 1) return
	const next = on ? poses.value.filter((p) => p !== id) : [...poses.value, id]
	state.po = POSE_META.map((p) => p.id).filter((p) => next.includes(p)).join(',')
}

function reseed() {
	state.seed = Math.floor(Math.random() * 1_000_000)
}
</script>

<template>
	<div class="sidebar-sections">
		<Accordion title="Backdrop">
			<LengthField v-model="state.bw" label="Width" :min="RANGES.bw[0]" :max="RANGES.bw[1]" />
			<LengthField v-model="state.bh" label="Height" :min="RANGES.bh[0]" :max="RANGES.bh[1]" />
			<div class="field-row">
				<label class="slider-label">Colour</label>
				<input type="color" v-model="state.bc" />
			</div>
		</Accordion>

		<Accordion title="Crowd">
			<NumberSlider v-model="state.n" label="Number of people" :min="RANGES.n[0]" :max="RANGES.n[1]" :step="1" />
			<div class="field-row">
				<label class="slider-label">Height mode</label>
				<SegButtons v-model="state.hm" :options="hmOptions" />
			</div>
			<RangeSlider2
				label="Height range"
				:min="1.0" :max="2.1"
				:model-min="state.hmin" :model-max="state.hmax"
				:disabled="state.hm !== 'mix'"
				:class="{ disabled: state.hm !== 'mix' }"
				@update:model-min="v => state.hmin = v"
				@update:model-max="v => state.hmax = v"
			/>
			<LengthField
				v-model="state.gap" label="Grouping" :min="RANGES.gap[0]" :max="RANGES.gap[1]"
				:end-labels="['Social', 'Corporate']"
			/>
			<LengthField v-model="state.pz" label="Distance from backdrop" :min="RANGES.pz[0]" :max="RANGES.pz[1]" />
			<div class="field-row">
				<label class="slider-label">Mannequin colour</label>
				<input type="color" v-model="state.mc" />
			</div>
			<div class="field-row">
				<button type="button" @click="reseed">Reseed ({{ state.seed }})</button>
			</div>
			<div class="field-col">
				<label class="slider-label">Poses (assigned at random by seed)</label>
				<div class="pose-chips">
					<button
						v-for="p in POSE_META" :key="p.id" type="button"
						:class="{ active: poses.includes(p.id) }"
						:aria-pressed="poses.includes(p.id)"
						@click="togglePose(p.id)"
					>{{ p.label }}</button>
				</div>
			</div>
		</Accordion>

		<Accordion title="Floor graphic">
			<label class="check-label">
				<input type="checkbox" v-model="followFloorWidth" />
				Match backdrop width
			</label>
			<LengthField
				v-if="!followFloorWidth"
				v-model="effectiveFloorWidth" label="Width" :min="0.5" :max="10"
			/>
			<LengthField v-model="state.fd" label="Depth" :min="RANGES.fd[0]" :max="RANGES.fd[1]" />
			<div class="field-row">
				<label class="slider-label">Colour</label>
				<input type="color" v-model="state.fc" />
			</div>
		</Accordion>

		<Accordion title="Camera">
			<NumberSlider v-model="state.f" label="Focal length" :min="RANGES.f[0]" :max="RANGES.f[1]" :step="0.1" precision="1" suffix="mm" />
			<div class="field-row">
				<label class="slider-label">FOV type</label>
				<SegButtons v-model="state.fovt" :options="fovtOptions" />
			</div>
			<NumberSlider v-model="currentFov" label="Field of view" :min="1" :max="170" :step="0.1" precision="1" suffix="&deg;" />
			<div class="field-row">
				<label class="slider-label">Sensor aspect</label>
				<select v-model="state.ar">
					<option v-for="o in arOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
				</select>
			</div>
			<div class="field-row">
				<label class="slider-label">Orientation</label>
				<SegButtons v-model="state.or" :options="orOptions" />
			</div>
			<LengthField v-model="state.ch" label="Height from floor" :min="RANGES.ch[0]" :max="RANGES.ch[1]" />
			<NumberSlider v-model="state.ct" label="Tilt" :min="RANGES.ct[0]" :max="RANGES.ct[1]" :step="0.5" precision="1" suffix="&deg;" />
			<LengthField v-model="state.cz" label="Distance from backdrop" :min="RANGES.cz[0]" :max="RANGES.cz[1]" />
			<div class="field-row">
				<label class="slider-label">Post-crop</label>
				<select v-model="state.crop">
					<option value="none">None</option>
					<optgroup v-for="g in cropGroups" :key="g.label" :label="g.label">
						<option v-for="c in g.options" :key="c" :value="c">{{ c }}</option>
					</optgroup>
				</select>
			</div>
		</Accordion>
	</div>
</template>

<style scoped>
.field-col {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.pose-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4em;
}

.pose-chips button {
	padding: 0.3em 0.7em;
	font-size: 0.85em;
}

.pose-chips button.active {
	background: var(--accent);
	border-color: var(--accent);
	color: #fff;
}

.sidebar-sections {
	display: flex;
	flex-direction: column;
	padding: 0.25em 1.25em 2em;
}

.field-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75em;
}

.field-row select {
	flex: 1;
}

.check-label {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.85em;
}

.disabled {
	opacity: 0.4;
	pointer-events: none;
}
</style>

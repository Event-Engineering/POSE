<script setup>
import { computed } from 'vue'
import { state } from '../../lib/state.js'
import { formatLength } from '../../lib/units.js'

// Two-handle range slider, e.g. for hmin/hmax (metres in, metres out).
const props = defineProps({
	min: { type: Number, required: true }, // lower bound of the track
	max: { type: Number, required: true }, // upper bound of the track
	modelMin: { type: Number, required: true },
	modelMax: { type: Number, required: true },
	label: { type: String, default: '' },
	step: { type: Number, default: 0.01 },
	disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelMin', 'update:modelMax'])

const pctMin = computed(() => ((props.modelMin - props.min) / (props.max - props.min)) * 100)
const pctMax = computed(() => ((props.modelMax - props.min) / (props.max - props.min)) * 100)

function onMin(e) {
	const v = Math.min(Number(e.target.value), props.modelMax)
	emit('update:modelMin', v)
}

function onMax(e) {
	const v = Math.max(Number(e.target.value), props.modelMin)
	emit('update:modelMax', v)
}
</script>

<template>
	<div class="range2">
		<div class="range2-header">
			<span class="slider-label">{{ label }}</span>
			<span class="range2-values">{{ formatLength(modelMin, state.units) }} &ndash; {{ formatLength(modelMax, state.units) }}</span>
		</div>
		<div class="range2-track">
			<div class="range2-fill" :style="{ left: pctMin + '%', width: (pctMax - pctMin) + '%' }"></div>
			<input
				type="range"
				:min="min" :max="max" :step="step"
				:value="modelMin"
				:disabled="disabled"
				@input="onMin"
				class="range2-input"
			/>
			<input
				type="range"
				:min="min" :max="max" :step="step"
				:value="modelMax"
				:disabled="disabled"
				@input="onMax"
				class="range2-input"
			/>
		</div>
	</div>
</template>

<style scoped>
.range2 {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.range2-header {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
}

.slider-label {
	font-size: 0.72em;
	font-weight: normal;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	opacity: 0.7;
}

.range2-values {
	font-size: 0.8em;
	opacity: 0.85;
}

.range2-track {
	position: relative;
	height: 20px;
}

.range2-fill {
	position: absolute;
	top: 8px;
	height: 4px;
	background: var(--accent);
	border-radius: 2px;
	pointer-events: none;
}

.range2-input {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	margin: 0;
	background: none;
	pointer-events: none;
}

.range2-input::-webkit-slider-thumb {
	pointer-events: auto;
}

.range2-input::-moz-range-thumb {
	pointer-events: auto;
}

.range2-input::-webkit-slider-runnable-track {
	background: transparent;
}
</style>

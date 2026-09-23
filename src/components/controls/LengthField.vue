<script setup>
import { computed, ref, watch } from 'vue'
import { state } from '../../lib/state.js'
import { formatLength, parseLength } from '../../lib/units.js'

// A slider + text field pair for a length value in metres, displayed/edited in state.units.
const props = defineProps({
	modelValue: { type: Number, required: true },
	label: { type: String, required: true },
	min: { type: Number, required: true },
	max: { type: Number, required: true },
	step: { type: Number, default: 0.01 },
	endLabels: { type: Array, default: null }, // [leftLabel, rightLabel] under the track
})
const emit = defineEmits(['update:modelValue'])

const text = ref(formatLength(props.modelValue, state.units))
const editing = ref(false)

watch(() => [props.modelValue, state.units], () => {
	if (!editing.value) text.value = formatLength(props.modelValue, state.units)
}, { immediate: true })

function onSlider(e) {
	emit('update:modelValue', Number(e.target.value))
}

function onFocus() {
	editing.value = true
}

function commit() {
	editing.value = false
	const v = parseLength(text.value, state.units)
	if (Number.isFinite(v)) {
		const clamped = Math.min(props.max, Math.max(props.min, v))
		emit('update:modelValue', clamped)
	} else {
		text.value = formatLength(props.modelValue, state.units)
	}
}

function onKeydown(e) {
	if (e.key === 'Enter') e.target.blur()
}
</script>

<template>
	<div class="slider-field">
		<label class="slider-label">{{ label }}</label>
		<input
			type="text"
			inputmode="decimal"
			class="slider-number"
			v-model="text"
			@focus="onFocus"
			@blur="commit"
			@keydown="onKeydown"
		/>
		<input
			type="range"
			class="slider-track"
			:min="min"
			:max="max"
			:step="step"
			:value="modelValue"
			@input="onSlider"
		/>
		<div v-if="endLabels" class="slider-endlabels">
			<span>{{ endLabels[0] }}</span>
			<span>{{ endLabels[1] }}</span>
		</div>
	</div>
</template>

<style scoped>
.slider-field {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.25em 0.5em;
}

.slider-label {
	flex: 1 1 auto;
	font-size: 0.72em;
	font-weight: normal;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	opacity: 0.7;
}

.slider-number {
	flex: 0 0 5.5em;
	text-align: right;
}

.slider-track {
	flex: 1 0 100%;
}
.slider-endlabels {
	flex: 1 0 100%;
	display: flex;
	justify-content: space-between;
	font-size: 0.68em;
	color: var(--muted);
	margin-top: -0.35em;
}
</style>

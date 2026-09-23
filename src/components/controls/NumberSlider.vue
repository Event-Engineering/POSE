<script setup>
// Generic slider + number field for values that aren't scene lengths (mm focal length,
// degrees, integer counts, percentages) — LengthField handles metres via units.js instead.
const props = defineProps({
	modelValue: { type: Number, required: true },
	label: { type: String, required: true },
	min: { type: Number, required: true },
	max: { type: Number, required: true },
	step: { type: Number, default: 1 },
	suffix: { type: String, default: '' },
	endLabels: { type: Array, default: null }, // [leftLabel, rightLabel] under the track
	precision: { type: Number, default: 0 },
})
const emit = defineEmits(['update:modelValue'])

function onInput(e) {
	emit('update:modelValue', Number(e.target.value))
}

function displayValue(v) {
	return props.precision > 0 ? Number(v).toFixed(props.precision) : Math.round(v)
}
</script>

<template>
	<div class="slider-field">
		<label class="slider-label">{{ label }}</label>
		<input
			type="number"
			class="slider-number"
			:min="min" :max="max" :step="step"
			:value="displayValue(modelValue)"
			@change="onInput"
		/>
		<span v-if="suffix" class="slider-suffix">{{ suffix }}</span>
		<input
			type="range"
			class="slider-track"
			:min="min" :max="max" :step="step"
			:value="modelValue"
			@input="onInput"
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
	flex: 0 0 4.5em;
	text-align: right;
}

.slider-suffix {
	font-size: 0.75em;
	opacity: 0.7;
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

<script setup>
defineProps({
	modelValue: { type: Boolean, required: true },
	label: { type: String, required: true },
})
defineEmits(['update:modelValue'])
</script>

<template>
	<label class="toggle">
		<span class="slider-label">{{ label }}</span>
		<input
			type="checkbox" role="switch" class="toggle-input"
			:checked="modelValue" :aria-checked="modelValue"
			@change="$emit('update:modelValue', $event.target.checked)"
		/>
		<span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
	</label>
</template>

<style scoped>
.toggle {
	display: flex;
	align-items: center;
	justify-content: space-between;
	cursor: pointer;
}

.toggle-input {
	position: absolute;
	opacity: 0;
	pointer-events: none;
}

.toggle-track {
	position: relative;
	flex: 0 0 auto;
	width: 2.4em;
	height: 1.35em;
	border-radius: 1em;
	background: var(--panel-2);
	border: 1px solid var(--border);
	transition: background 0.15s ease, border-color 0.15s ease;
}

.toggle-thumb {
	position: absolute;
	top: 50%;
	left: 0.15em;
	width: 1em;
	height: 1em;
	border-radius: 50%;
	background: var(--muted);
	transform: translateY(-50%);
	transition: left 0.15s ease, background 0.15s ease;
}

.toggle-input:checked + .toggle-track {
	background: var(--accent);
	border-color: var(--accent);
}

.toggle-input:checked + .toggle-track .toggle-thumb {
	left: calc(100% - 1.15em);
	background: #fff;
}

.toggle-input:focus-visible + .toggle-track {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}
</style>

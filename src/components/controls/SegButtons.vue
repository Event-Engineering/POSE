<script setup>
defineProps({
	modelValue: { type: [String, Number, Boolean], required: true },
	options: { type: Array, required: true }, // [{ value, label }]
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
	<div class="btn-group seg-buttons">
		<button
			v-for="opt in options"
			:key="String(opt.value)"
			type="button"
			:class="{ active: opt.value === modelValue }"
			@click="emit('update:modelValue', opt.value)"
		>{{ opt.label }}</button>
	</div>
</template>

<style scoped>
.seg-buttons {
	width: 100%;
}

.seg-buttons button {
	flex: 1;
}
</style>

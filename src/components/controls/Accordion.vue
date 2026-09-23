<script setup>
import { ref } from 'vue'

const props = defineProps({
	title: { type: String, required: true },
	defaultOpen: { type: Boolean, default: true },
})
const open = ref(props.defaultOpen)
</script>

<template>
	<section class="accordion-section">
		<button type="button" class="accordion-header" :class="{ open }" @click="open = !open">
			<span>{{ title }}</span>
			<span class="chevron">&#9650;</span>
		</button>
		<div v-show="open" class="accordion-body">
			<slot />
		</div>
	</section>
</template>

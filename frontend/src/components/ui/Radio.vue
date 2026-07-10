<script setup lang="ts">
const model = defineModel();

defineProps<{
  value: any;
  label?: string;
  disabled?: boolean;
}>();
</script>

<template>
  <label class="flex items-start gap-2 text-[0.9rem] text-text cursor-pointer select-none" :class="{ 'opacity-50 cursor-not-allowed': disabled }">
    <input
      type="radio"
      :value="value"
      :disabled="disabled"
      v-model="model"
      class="w-4 h-4 mt-[2px] accent-primary shrink-0 cursor-pointer focus:ring-primary"
      :class="{ 'cursor-not-allowed': disabled }"
    />
    <span class="break-words leading-[1.25]"><slot>{{ label }}</slot></span>
  </label>
</template>

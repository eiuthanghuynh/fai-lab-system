<script setup lang="ts">
defineProps<{
  title: string
  bodyClass?: string
}>()
</script>

<template>
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm transition-colors duration-300">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white transition-colors duration-300 m-0">{{ title }}</h2>
      <slot name="header-actions" />
    </div>
    <div :class="bodyClass || 'h-64'">
      <slot />
    </div>
  </div>
</template>

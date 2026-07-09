<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm transition-colors duration-300">
    <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4 transition-colors duration-300">{{ title }}</h2>
    <div class="h-64">
      <slot />
    </div>
  </div>
</template>

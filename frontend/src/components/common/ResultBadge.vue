<template>
  <span v-if="result" :class="[
    'inline-flex items-center justify-center px-2.5 py-0.5 text-md font-bold rounded-[8px] border w-16',
    result === 'PASS' ? 'border-primary text-primary bg-bg-surface' : 
    result === 'FAIL' ? 'border-red-600 text-red-500 bg-bg-surface' : 
    'border-gray-400 text-gray-600 bg-bg-surface'
  ]">
    {{ result }}
  </span>
  <span v-else>-</span>
</template>

<script setup lang="ts">
defineProps<{
  result?: string | null;
}>();
</script>

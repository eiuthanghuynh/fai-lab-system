<template>
  <span v-if="result" :class="[
    'inline-flex items-center justify-center px-2.5 py-0.5 text-md font-bold rounded-[8px] border w-16',
    result === 'PASS' ? 'border-primary text-primary bg-emerald-50' : 
    result === 'FAIL' ? 'border-red-600 text-red-500 bg-red-50' : 
    'border-gray-400 text-gray-600 bg-gray-50'
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

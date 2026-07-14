<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="bg-bg-surface border border-border rounded-lg shadow-sm flex flex-col h-[467px]">
    <div class="px-6 py-4 border-b border-border shrink-0">
      <h3 class="m-0 text-[1.15rem] font-semibold text-primary">{{ title }}</h3>
    </div>
    <div class="p-6 overflow-y-auto flex-1">
      <slot></slot>
    </div>
  </div>
</template>

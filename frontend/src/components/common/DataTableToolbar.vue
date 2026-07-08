<script setup lang="ts">

import SearchInput from './SearchInput.vue';

defineProps<{
  searchQuery: string;
  searchPlaceholder?: string;
  hideSearch?: boolean;
}>();

defineEmits<{
  (e: 'update:searchQuery', value: string): void;
}>();
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <SearchInput 
        v-if="!hideSearch"
        :modelValue="searchQuery" 
        @update:modelValue="$emit('update:searchQuery', $event)" 
        :placeholder="searchPlaceholder" 
      />
      <slot name="left"></slot>
    </div>
    
    <div class="toolbar-right">
      <slot name="filters"></slot>
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>

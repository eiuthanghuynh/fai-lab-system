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
  <div class="flex justify-between items-center gap-4 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <SearchInput 
        v-if="!hideSearch"
        :modelValue="searchQuery" 
        @update:modelValue="$emit('update:searchQuery', $event)" 
        :placeholder="searchPlaceholder" 
      />
      <slot name="left"></slot>
    </div>
    
    <div class="flex items-center gap-3 flex-wrap">
      <slot name="filters"></slot>
      <slot name="actions"></slot>
    </div>
  </div>
</template>

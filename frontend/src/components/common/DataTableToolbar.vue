<script setup lang="ts">

import SearchInput from './SearchInput.vue';

defineProps<{
  searchPlaceholder?: string;
  hideSearch?: boolean;
}>();

const searchQuery = defineModel<string>('searchQuery', { required: true });
</script>

<template>
  <div class="flex justify-between items-center gap-4 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <SearchInput 
        v-if="!hideSearch"
        v-model="searchQuery" 
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

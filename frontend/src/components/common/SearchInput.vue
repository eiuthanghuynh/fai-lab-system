<script setup lang="ts">


defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();
</script>

<template>
  <div class="flex items-center w-full px-3 py-2 rounded-md border border-border text-text bg-bg-surface font-sans transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary gap-2 min-w-[250px]">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted shrink-0"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
    <input 
      type="text" 
      :value="modelValue" 
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" 
      :placeholder="placeholder || 'Search...'" 
      class="bg-transparent border-none outline-none w-full p-0 m-0 placeholder:text-text-muted" 
    />
  </div>
</template>

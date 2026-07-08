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
  <div class="pill-search">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
    <input 
      type="text" 
      :value="modelValue" 
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" 
      :placeholder="placeholder || 'Search...'" 
      class="pill-input" 
    />
  </div>
</template>

<style scoped>
.pill-search {
  display: flex;
  align-items: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 0.25rem 1rem;
  gap: 0.5rem;
  min-width: 250px;
  height: 44px;
}

.search-icon {
  color: var(--color-text-muted);
}

.pill-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text);
  width: 100%;
  padding: 0.25rem 0;
  font-size: 1rem;
}
</style>

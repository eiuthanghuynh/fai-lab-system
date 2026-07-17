<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  multiple?: boolean;
  accept?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}>(), {
  multiple: false,
  accept: '',
  size: 'md',
  disabled: false
});

const emit = defineEmits<{
  (e: 'change', event: Event): void;
}>();

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'file:py-1 file:px-2 file:text-[0.75rem] text-[0.75rem]';
    case 'lg': return 'file:py-2 file:px-4 file:text-[1rem] text-[1rem]';
    case 'md':
    default: return 'file:py-1.5 file:px-3.5 file:text-[0.85rem] text-[0.85rem]';
  }
});
</script>

<template>
  <input 
    type="file" 
    :multiple="multiple" 
    :accept="accept || undefined"
    :disabled="disabled"
    @change="e => emit('change', e)"
    class="file:bg-bg-surface file:border file:border-border file:text-text file:rounded file:font-medium file:cursor-pointer file:shadow-sm hover:file:bg-border file:mr-3 text-text-muted transition-colors cursor-pointer focus:outline-none"
    :class="[sizeClasses, disabled ? 'opacity-50 cursor-not-allowed file:cursor-not-allowed' : '']"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  isActive?: boolean;
  activeText?: string;
  inactiveText?: string;
  variant?: 'success' | 'danger' | 'warning' | 'secondary' | 'info';
  text?: string;
}>();

const badgeVariant = computed(() => {
  if (props.variant) return props.variant;
  return props.isActive ? 'success' : 'danger';
});

const displayText = computed(() => {
  if (props.text) return props.text;
  return props.isActive ? props.activeText : props.inactiveText;
});

const themeClasses = computed(() => {
  const map: Record<string, string> = {
    success: 'bg-success/10 text-success',
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-warning/10 text-warning',
    secondary: 'bg-gray/10 text-gray',
    info: 'bg-blue-500/10 text-blue-500',
  };
  return map[badgeVariant.value] || map.secondary;
});

const dotStyle = computed(() => {
  const map: Record<string, string> = {
    success: 'bg-success shadow-[0_0_8px_var(--color-success)]',
    danger: 'bg-danger shadow-[0_0_8px_var(--color-danger)]',
    warning: 'bg-warning shadow-[0_0_8px_var(--color-warning)]',
    secondary: 'bg-gray shadow-[0_0_8px_var(--color-gray)]',
    info: 'bg-blue-500 shadow-[0_0_8px_#3b82f6]',
  };
  return map[badgeVariant.value] || map.secondary;
});
</script>

<template>
  <span :class="['inline-flex items-center px-3 py-1 rounded-full text-sm font-medium', themeClasses]">
    <span :class="['inline-block w-2 h-2 rounded-full mr-2', dotStyle]"></span>
    {{ displayText }}
  </span>
</template>

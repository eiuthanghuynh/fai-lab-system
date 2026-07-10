<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
});

const emit = defineEmits(['click']);

const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

const variantClasses = computed(() => {
  const map: Record<string, string> = {
    primary: 'bg-primary text-primary-text hover:bg-primary-dark',
    secondary: 'bg-bg-surface border border-border text-text hover:bg-border',
    danger: 'bg-danger/10 border border-danger text-danger hover:bg-danger/20',
    ghost: 'bg-transparent text-text hover:bg-bg-surface',
  };
  return map[props.variant];
});

const sizeClasses = computed(() => {
  const map: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  return map[props.size];
});

const onClick = (e: Event) => {
  if (!props.disabled && !props.loading) {
    emit('click', e);
  }
};
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[baseClasses, variantClasses, sizeClasses]"
    @click="onClick"
  >
    <i v-if="loading" class="bi bi-arrow-clockwise animate-spin mr-2"></i>
    <slot></slot>
  </button>
</template>

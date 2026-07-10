<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: string | number | null;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
});

const emit = defineEmits(['update:modelValue']);

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};

const inputClasses = computed(() => {
  return [
    'w-full px-3 py-2 rounded-md border text-text bg-bg-surface font-sans shadow-sm transition-colors focus:outline-none focus:ring-1',
    props.error
      ? 'border-danger focus:border-danger focus:ring-danger'
      : 'border-border focus:border-primary focus:ring-primary',
    props.disabled ? 'opacity-50 cursor-not-allowed bg-bg' : ''
  ];
});
</script>

<template>
  <div class="w-full">
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="inputClasses"
      @input="onInput"
    />
    <p v-if="error" class="mt-1 text-sm text-danger">{{ error }}</p>
  </div>
</template>

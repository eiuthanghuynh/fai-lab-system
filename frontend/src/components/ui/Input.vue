<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ inheritAttrs: false });

interface Props {
  modelValue: string | number | null;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  min?: number;
  max?: number;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
});

const emit = defineEmits(['update:modelValue', 'clear-error']);

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  emit('update:modelValue', target.value);
  emit('clear-error');
};

const onBlur = (e: Event) => {
  if (props.type === 'number') {
    let val = Number((e.target as HTMLInputElement).value);
    if (!isNaN(val)) {
      if (props.min !== undefined && val < props.min) val = props.min;
      if (props.max !== undefined && val > props.max) val = props.max;
      emit('update:modelValue', val);
      (e.target as HTMLInputElement).value = String(val);
    }
  }
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
      :min="min"
      :max="max"
      :class="inputClasses"
      v-bind="$attrs"
      @input="onInput"
      @blur="onBlur"
    />
    <p v-if="error" class="mt-1 text-sm text-danger">{{ error }}</p>
  </div>
</template>

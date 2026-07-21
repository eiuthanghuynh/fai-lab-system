<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  rows?: number;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  disabled: false,
  rows: 3,
});

const emit = defineEmits(['clear-error']);
const modelValue = defineModel<string | null>();

const onInput = () => {
  emit('clear-error');
};

const textareaClasses = computed(() => {
  return [
    'w-full px-3 py-2 rounded-md border text-text bg-bg-surface font-sans shadow-sm transition-colors focus:outline-none focus:ring-1 resize-none text-sm',
    props.error
      ? 'border-danger focus:border-danger focus:ring-danger'
      : 'border-border focus:border-primary focus:ring-primary',
    props.disabled ? 'opacity-50 cursor-not-allowed bg-bg' : ''
  ];
});
</script>

<template>
  <div class="w-full flex flex-col gap-1">
    <textarea
      v-model="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      :class="textareaClasses"
      @input="onInput"
    ></textarea>
    <span v-if="error" class="text-danger text-sm">{{ error }}</span>
  </div>
</template>

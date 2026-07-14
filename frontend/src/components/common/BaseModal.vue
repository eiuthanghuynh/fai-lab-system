<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  title: string;
  maxWidth?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const handleClose = () => {
  emit('close');
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    handleClose();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Transition 
    enter-active-class="transition-all duration-300 ease-out"
    leave-active-class="transition-all duration-300 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" @mousedown.self="handleClose">
      <div class="bg-bg-surface rounded-lg w-full border border-border shadow-xl flex flex-col transition-transform duration-300 scale-100 max-h-[95vh]" :style="{ maxWidth: maxWidth || '600px' }">
        <div class="px-8 pt-6 pb-4 flex justify-between items-center border-b border-border shrink-0">
          <h2 class="m-0 text-xl font-bold text-text">{{ title }}</h2>
          <button type="button" class="bg-transparent border-none text-text-muted cursor-pointer p-1 rounded hover:bg-white/10 hover:text-text transition-colors flex items-center justify-center" @click="handleClose">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="px-8 py-6 overflow-y-auto">
          <slot></slot>
        </div>
        <div class="px-8 pt-4 pb-6 flex justify-end gap-4 border-t border-border shrink-0" v-if="$slots.footer">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import Button from './ui/Button.vue';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  hideCancel?: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]" @mousedown.self="emit('cancel')">
      <div class="bg-bg-surface p-6 rounded-lg w-[90%] max-w-[400px] border border-border shadow-[0_4px_15px_rgba(0,0,0,0.3)] confirm-modal-content">
        <h3 :class="['m-0 mb-4 text-xl font-semibold', isDanger ? 'text-[#ff5555]' : 'text-primary']">
          {{ title || t('common.warning') }}
        </h3>
        <p class="m-0 mb-6 text-text leading-relaxed">{{ message }}</p>
        
        <div class="flex justify-end gap-4">
          <Button v-if="!hideCancel" variant="secondary" @click="emit('cancel')">
            {{ cancelText || t('common.cancel') }}
          </Button>
          <Button 
            :variant="isDanger ? 'danger' : 'primary'"
            @click="emit('confirm')"
          >
            {{ confirmText || t('common.confirm') }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Vue Transition Classes */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .confirm-modal-content,
.modal-leave-active .confirm-modal-content {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .confirm-modal-content,
.modal-leave-to .confirm-modal-content {
  transform: translateY(20px) scale(0.95);
  opacity: 0;
}
</style>

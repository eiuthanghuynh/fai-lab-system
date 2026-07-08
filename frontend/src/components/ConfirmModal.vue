<script setup lang="ts">
import { useI18n } from 'vue-i18n';

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
    <div v-if="isOpen" class="modal-overlay" @mousedown.self="emit('cancel')">
      <div class="modal-content confirm-modal">
        <h3 :class="['modal-title', isDanger ? 'text-danger' : 'text-primary']">
          {{ title || t('common.warning') }}
        </h3>
        <p class="modal-message">{{ message }}</p>
        
        <div class="modal-actions">
          <button v-if="!hideCancel" class="btn-cancel" @click="emit('cancel')">
            {{ cancelText || t('common.cancel') }}
          </button>
          <button 
            :class="['btn', isDanger ? 'btn-danger-solid' : 'btn-primary']" 
            @click="emit('confirm')"
          >
            {{ confirmText || t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.confirm-modal {
  background: var(--color-bg-surface);
  padding: 1.5rem;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

/* Vue Transition Classes */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .confirm-modal,
.modal-leave-active .confirm-modal {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .confirm-modal,
.modal-leave-to .confirm-modal {
  transform: translateY(20px) scale(0.95);
  opacity: 0;
}

.modal-title {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.text-danger {
  color: #ff5555;
}

.text-primary {
  color: var(--color-primary);
}

.modal-message {
  margin: 0 0 1.5rem 0;
  color: var(--color-text);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn-cancel {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-primary-text);
}

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-danger-solid {
  background: #ff5555;
  color: #fff;
}

.btn-danger-solid:hover {
  background: #ff3333;
}
</style>

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
  <Teleport to="body">
    <Transition 
      enter-active-class="transition-opacity duration-300 ease-out"
      leave-active-class="transition-opacity duration-300 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]" @mousedown.self="emit('cancel')">
        <div class="bg-bg-surface p-6 rounded-lg w-[90%] max-w-[400px] border border-border shadow-[0_4px_15px_rgba(0,0,0,0.3)] transition-transform duration-300 scale-100">
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
  </Teleport>
</template>


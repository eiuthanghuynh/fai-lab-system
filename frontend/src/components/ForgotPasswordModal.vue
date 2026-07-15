<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../services/api';
import Button from './ui/Button.vue';
import Input from './ui/Input.vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();

const email = ref('');
const employeeId = ref('');
const isLoading = ref(false);
const message = ref('');
const isError = ref(false);

const handleClose = () => {
  email.value = '';
  employeeId.value = '';
  message.value = '';
  isError.value = false;
  emit('close');
};

const handleSubmit = async () => {
  if (!email.value || !employeeId.value) return;
  
  isLoading.value = true;
  message.value = '';
  isError.value = false;
  
  try {
    const res = await api.post('/auth/forgot-password', {
      email: email.value,
      employee_id: employeeId.value
    });
    
    // Always show success message to prevent email enumeration
    message.value = res.data.message || t('login.forgot_password_success');
  } catch (err: any) {
    // If backend returns an explicit error (e.g., 400 missing fields)
    isError.value = true;
    message.value = err.response?.data?.error || t('login.internal_error');
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <Transition 
    enter-active-class="transition-opacity duration-300 ease-out"
    leave-active-class="transition-opacity duration-300 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]" @mousedown.self="handleClose">
      <div class="bg-bg-surface rounded-lg w-[90%] max-w-[450px] shadow-xl overflow-hidden transition-transform duration-300 scale-100">
        <div class="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 class="m-0 text-text text-[1.2rem] font-semibold">{{ t('login.forgot_password_title') }}</h3>
          <button type="button" @click="handleClose" class="bg-transparent border-none text-[1.5rem] cursor-pointer text-text-muted hover:text-text transition-colors">&times;</button>
        </div>
        
        <div class="p-6">
          <p class="text-text-muted text-[0.95rem] mb-6">{{ t('login.forgot_password_desc') }}</p>
          
          <form @submit.prevent="handleSubmit">
            <div class="mb-4">
              <label class="block mb-2 text-text font-medium">{{ t('form.email') }}</label>
              <Input type="email" v-model="email" required />
            </div>
            
            <div class="mb-4">
              <label class="block mb-2 text-text font-medium">{{ t('form.employee_id') }}</label>
              <Input type="text" v-model="employeeId" required />
            </div>
            
            <div v-if="message" :class="['p-3 rounded mb-4 text-sm', isError ? 'bg-[#fee2e2] text-[#b91c1c] dark:bg-red-900/30 dark:text-red-400' : 'bg-[#dcfce7] text-[#15803d] dark:bg-green-900/30 dark:text-green-400']">
              {{ message }}
            </div>
            
            <div class="flex justify-end gap-4 mt-6">
              <Button type="button" variant="secondary" @click="handleClose">
                {{ t('action.cancel') }}
              </Button>
              <Button type="submit" variant="primary" :disabled="isLoading">
                {{ isLoading ? '...' : t('common.submit_request') }}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Transition>
</template>

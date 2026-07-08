<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../services/api';

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
  <Transition name="modal">
    <div v-if="isOpen" class="modal-backdrop" @mousedown.self="handleClose">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ t('login.forgot_password_title') }}</h3>
          <button type="button" @click="handleClose" class="close-btn">&times;</button>
        </div>
        
        <div class="modal-body">
          <p class="desc">{{ t('login.forgot_password_desc') }}</p>
          
          <form @submit.prevent="handleSubmit">
            <div class="form-group">
              <label>{{ t('form.email') }}</label>
              <input type="email" v-model="email" class="input-field" required />
            </div>
            
            <div class="form-group">
              <label>{{ t('form.employee_id') }}</label>
              <input type="text" v-model="employeeId" class="input-field" required />
            </div>
            
            <div v-if="message" :class="['alert', isError ? 'alert-error' : 'alert-success']">
              {{ message }}
            </div>
            
            <div class="modal-actions">
              <button type="button" @click="handleClose" class="btn-secondary">
                {{ t('action.cancel') }}
              </button>
              <button type="submit" class="btn-primary" :disabled="isLoading">
                {{ isLoading ? '...' : t('common.submit_request') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg-surface);
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

/* Vue Transition Classes */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: translateY(-20px) scale(0.95);
  opacity: 0;
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 1.2rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-muted);
}

.modal-body {
  padding: 1.5rem;
}

.desc {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-text);
  font-weight: 500;
}

.input-field {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
}

.alert {
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.alert-error {
  background-color: #fee2e2;
  color: #b91c1c;
}

.alert-success {
  background-color: #dcfce7;
  color: #15803d;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.btn-secondary {
  padding: 0.6rem 1.2rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  cursor: pointer;
}

.btn-primary {
  padding: 0.6rem 1.2rem;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  color: var(--color-primary-text);
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>

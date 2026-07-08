<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '../services/api';
import XpLogo from '../assets/XP-logo-white.svg';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const token = ref('');
const email = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const message = ref('');
const isError = ref(false);
const isLoading = ref(false);
const success = ref(false);
const isInvalidLink = ref(false);
const isVerifying = ref(true);

onMounted(async () => {
  token.value = route.query.token as string || '';
  email.value = route.query.email as string || '';
  
  if (!token.value || !email.value) {
    isError.value = true;
    isInvalidLink.value = true;
    message.value = 'login.invalid_link';
    isVerifying.value = false;
    return;
  }

  try {
    const res = await api.get(`/auth/verify-reset-token?email=${encodeURIComponent(email.value)}&token=${encodeURIComponent(token.value)}`);
    if (!res.data.valid) {
      throw new Error('Invalid token');
    }
  } catch (err: any) {
    isError.value = true;
    isInvalidLink.value = true;
    message.value = 'login.invalid_link';
  } finally {
    isVerifying.value = false;
  }
});

const validatePassword = (pass: string) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;
  return regex.test(pass);
};

const handleReset = async () => {
  if (!token.value || !email.value) return;
  
  if (newPassword.value !== confirmPassword.value) {
    isError.value = true;
    message.value = 'login.password_mismatch';
    return;
  }
  
  if (!validatePassword(newPassword.value)) {
    isError.value = true;
    message.value = 'error.password_format';
    return;
  }
  
  isLoading.value = true;
  isError.value = false;
  message.value = '';
  
  try {
    const res = await api.post('/auth/reset-password', {
      email: email.value,
      token: token.value,
      new_password: newPassword.value
    });
    
    success.value = true;
    message.value = 'login.reset_success';
  } catch (err: any) {
    isError.value = true;
    // Map backend error to translation key if possible, else generic internal error
    if (err.response?.status === 400 && err.response?.data?.error?.includes('Token')) {
      isInvalidLink.value = true;
    } else {
      message.value = 'login.internal_error';
    }
  } finally {
    isLoading.value = false;
  }
};

const goToLogin = () => {
  router.push({ name: 'login' });
};
</script>

<template>
  <div class="reset-wrapper">
    <div class="reset-card">
      <div class="logo-wrapper">
        <img :src="XpLogo" alt="XP Power Logo" class="xp-logo" />
      </div>
      
      <h2 class="title">{{ t('login.reset_password_title') }}</h2>
      
      <div v-if="success" class="success-box">
        <p>{{ t(message) }}</p>
        <button @click="goToLogin" class="btn-primary w-full mt-1">{{ t('login.title') }}</button>
      </div>
      
      <div v-else-if="isVerifying" class="text-center mt-2" style="color: var(--color-text-muted);">
        <p>Verifying link...</p>
      </div>
      
      <form v-else-if="!isError || (isError && !isInvalidLink)" @submit.prevent="handleReset">
        <div class="form-group">
          <label>{{ t('login.new_password') }}</label>
          <input type="password" v-model="newPassword" class="input-field" required />
          <small class="hint">{{ t('error.password_format') }}</small>
        </div>
        
        <div class="form-group">
          <label>{{ t('login.confirm_password') }}</label>
          <input type="password" v-model="confirmPassword" class="input-field" required />
        </div>
        
        <div v-if="message && isError && !isInvalidLink" class="error-msg">{{ t(message) }}</div>
        
        <button type="submit" class="btn-primary w-full" :disabled="isLoading">
          {{ isLoading ? '...' : t('action.save') }}
        </button>
      </form>
      
      <div v-else class="error-msg text-center mt-2">
        {{ isInvalidLink ? t('login.invalid_link') : t(message) }}
        <button @click="goToLogin" class="btn-secondary w-full mt-1">{{ t('login.back_to_login') }}</button>
      </div>
      
      <div class="lang-switcher-wrapper mt-2">
        <LanguageSwitcher />
      </div>
    </div>
  </div>
</template>

<style scoped>
.reset-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--color-bg);
  padding: 1rem;
}

.reset-card {
  background: var(--color-bg-surface);
  padding: 2.5rem 2rem;
  border-radius: 12px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.logo-wrapper {
  background-color: #000;
  border-radius: 8px;
  padding: 15px 20px;
  margin-bottom: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.xp-logo {
  max-width: 150px;
}

.title {
  text-align: center;
  margin-bottom: 1.5rem;
  color: var(--color-text);
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
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

.hint {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.error-msg {
  color: #e53e3e;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.success-box {
  background-color: #dcfce7;
  color: #15803d;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  margin-bottom: 1rem;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-weight: bold;
}

.btn-secondary {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  cursor: pointer;
}

.w-full {
  width: 100%;
}

.mt-1 { margin-top: 1rem; }
.mt-2 { margin-top: 2rem; }
.text-center { text-align: center; }

.lang-switcher-wrapper {
  display: flex;
  justify-content: center;
}
</style>

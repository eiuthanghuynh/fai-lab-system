<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '../services/api';
import XpLogo from '../assets/XP-logo-white.svg';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

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
  <div class="flex justify-center items-center min-h-screen bg-bg p-4">
    <div class="bg-bg-surface px-8 py-10 rounded-xl w-full max-w-[420px] shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
      <div class="bg-black rounded-lg py-[15px] px-[20px] mb-8 flex justify-center items-center">
        <img :src="XpLogo" alt="XP Power Logo" class="max-w-[150px]" />
      </div>
      
      <h2 class="text-center mb-6 text-text text-2xl font-semibold">{{ t('login.reset_password_title') }}</h2>
      
      <div v-if="success" class="bg-[#dcfce7] text-[#15803d] p-4 rounded-lg text-center mb-4">
        <p>{{ t(message) }}</p>
        <Button @click="goToLogin" class="w-full mt-4">{{ t('login.title') }}</Button>
      </div>
      
      <div v-else-if="isVerifying" class="text-center mt-8 text-text-muted">
        <p>Verifying link...</p>
      </div>
      
      <form v-else-if="!isError || (isError && !isInvalidLink)" @submit.prevent="handleReset">
        <div class="mb-6">
          <label class="block mb-2 text-text font-medium">{{ t('login.new_password') }}</label>
          <Input type="password" v-model="newPassword" required />
          <small class="block mt-2 text-sm text-text-muted">{{ t('error.password_format') }}</small>
        </div>
        
        <div class="mb-6">
          <label class="block mb-2 text-text font-medium">{{ t('login.confirm_password') }}</label>
          <Input type="password" v-model="confirmPassword" required />
        </div>
        
        <div v-if="message && isError && !isInvalidLink" class="text-[#e53e3e] mb-4 text-[0.9rem]">{{ t(message) }}</div>
        
        <Button type="submit" class="w-full" :disabled="isLoading">
          {{ isLoading ? '...' : t('action.save') }}
        </Button>
      </form>
      
      <div v-else class="text-[#e53e3e] mb-4 text-[0.9rem] text-center mt-8">
        {{ isInvalidLink ? t('login.invalid_link') : t(message) }}
        <Button @click="goToLogin" variant="secondary" class="w-full mt-4">{{ t('login.back_to_login') }}</Button>
      </div>
      
      <div class="flex justify-center mt-8">
        <LanguageSwitcher />
      </div>
    </div>
  </div>
</template>

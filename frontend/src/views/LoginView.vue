<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import XpLogo from '../assets/XP-logo-white.svg';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import ForgotPasswordModal from '../components/ForgotPasswordModal.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';

const username = ref('');
const password = ref('');
const keepLoggedIn = ref(localStorage.getItem('keep_logged_in_preference') === 'true');
const error = ref('');
const isLoading = ref(false);
const showForgotModal = ref(false);

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const handleLogin = async () => {
  error.value = '';
  isLoading.value = true;
  
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        username: username.value, 
        password: password.value,
        keep_logged_in: keepLoggedIn.value
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      if (res.status === 429) {
        error.value = 'login.rate_limit_error';
      } else if (res.status === 401 || res.status === 400) {
        error.value = 'login.error';
      } else {
        error.value = 'login.internal_error';
      }
      return;
    }
    
    // Save preference
    localStorage.setItem('keep_logged_in_preference', String(keepLoggedIn.value));

    authStore.setAuth(data.token, data.user, data.user.permissions);
    router.push({ name: 'home' });
  } catch (err) {
    error.value = 'login.internal_error';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen w-full bg-bg transition-colors duration-300 ease-in-out">
    <div class="flex-1 flex flex-col items-center justify-center relative p-8">
      <div class="bg-black rounded-lg py-[15px] px-[20px] mb-12 flex justify-center items-center shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
        <img :src="XpLogo" alt="XP Power Logo" class="max-w-[200px]" />
      </div>
      
      <div class="bg-bg-surface p-12 max-sm:p-8 rounded-lg w-full max-w-[520px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] text-text border border-border">
        <div class="text-primary font-bold text-[29px] mb-2 text-center tracking-[1px]">FAI/LAB System</div>
        <h1 class="text-center mb-8 text-[19px] text-text font-semibold">{{ t('login.title') }}</h1>
        
        <form @submit.prevent="handleLogin">
          <div class="mb-6">
            <label class="block mb-2 text-text font-medium text-[0.95rem]">{{ t('login.username') }}</label>
            <Input type="text" v-model="username" required />
          </div>
          
          <div class="mb-6">
            <label class="block mb-2 text-text font-medium text-[0.95rem]">{{ t('login.password') }}</label>
            <Input type="password" v-model="password" required />
          </div>

          <div class="mt-[-0.5rem] mb-6 flex justify-between items-center">
            <label class="flex items-center gap-2 cursor-pointer font-normal text-text-muted">
              <Checkbox v-model="keepLoggedIn" />
              <span>{{ t('login.keep_logged_in') }}</span>
            </label>
            <a href="#" @click.prevent="showForgotModal = true" class="text-primary no-underline text-[0.9rem] font-medium transition-opacity duration-200 hover:opacity-80 hover:underline">
              {{ t('login.forgot_password') }}
            </a>
          </div>
          
          <div v-if="error" class="text-[#e53e3e] mb-4 text-[0.875rem] text-center">{{ t(error) }}</div>
          
          <Button type="submit" class="w-full" :disabled="isLoading">
            {{ isLoading ? '...' : t('login.submit') }}
          </Button>
        </form>
      </div>
      
      <div class="mt-8 w-full max-w-[520px] flex justify-center">
        <LanguageSwitcher class="login-lang-switcher !justify-center !gap-4" showText />
      </div>
    </div>

    <div class="flex-1 p-8 hidden md:flex">
      <div class="flex-1 bg-[url('../assets/login_bg.jpg')] bg-cover bg-right bg-no-repeat rounded-[36px] shadow-[0_10px_40px_rgba(0,0,0,0.2)]"></div>
    </div>
    
    <ForgotPasswordModal :is-open="showForgotModal" @close="showForgotModal = false" />
  </div>
</template>

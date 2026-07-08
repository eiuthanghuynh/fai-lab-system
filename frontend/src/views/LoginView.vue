<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import XpLogo from '../assets/XP-logo-white.svg';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import ForgotPasswordModal from '../components/ForgotPasswordModal.vue';

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
  <div class="login-wrapper">
    <div class="login-left">
      <div class="logo-wrapper">
        <img :src="XpLogo" alt="XP Power Logo" class="xp-logo" />
      </div>
      
      <div class="login-card">
        <div class="logo">FAI/LAB System</div>
        <h1 class="title">{{ t('login.title') }}</h1>
        
        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label>{{ t('login.username') }}</label>
            <input type="text" v-model="username" class="input-field" required />
          </div>
          
          <div class="form-group">
            <label>{{ t('login.password') }}</label>
            <input type="password" v-model="password" class="input-field" required />
          </div>

          <div class="form-group checkbox-group flex-between">
            <label class="checkbox-label">
              <input type="checkbox" v-model="keepLoggedIn" />
              <span>{{ t('login.keep_logged_in') }}</span>
            </label>
            <a href="#" @click.prevent="showForgotModal = true" class="forgot-link">
              {{ t('login.forgot_password') }}
            </a>
          </div>
          
          <div v-if="error" class="error-msg">{{ t(error) }}</div>
          
          <button type="submit" class="btn-primary w-full" :disabled="isLoading">
            {{ isLoading ? '...' : t('login.submit') }}
          </button>
        </form>
      </div>
      
      <div class="lang-switcher-wrapper">
        <LanguageSwitcher class="login-lang-switcher" showText />
      </div>
    </div>

    <div class="login-right">
      <div class="login-hero-image"></div>
    </div>
    
    <ForgotPasswordModal :is-open="showForgotModal" @close="showForgotModal = false" />
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  min-height: 100vh;
  width: 100%;
  background-color: var(--color-bg);
  transition: background-color var(--transition-speed) ease;
}

.login-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 2rem;
}

.login-right {
  flex: 1;
  padding: 2rem;
  display: flex;
}

.login-hero-image {
  flex: 1;
  background-image: url('../assets/login_bg.jpg');
  background-size: cover;
  background-position: right center;
  background-repeat: no-repeat;
  border-radius: 36px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}

.logo-wrapper {
  background-color: #000;
  border-radius: 8px;
  padding: 15px 20px;
  margin-bottom: 3rem;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.xp-logo {
  max-width: 200px;
}

.login-card {
  background-color: var(--color-bg-surface);
  padding: 3rem;
  border-radius: 8px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.lang-switcher-wrapper {
  margin-top: 2rem;
  width: 100%;
  max-width: 520px;
}

:deep(.login-lang-switcher) {
  justify-content: center !important;
  gap: 1rem !important;
}

.logo {
  color: var(--color-primary);
  font-weight: 700;
  font-size: 29px;
  margin-bottom: 0.5rem;
  text-align: center;
  letter-spacing: 1px;
}

.title {
  text-align: center;
  margin-bottom: 2rem;
  font-size: 19px;
  color: var(--color-text);
  font-weight: 600;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-text);
  font-weight: 500;
  font-size: 0.95rem;
}

.checkbox-group {
  margin-top: -0.5rem;
  margin-bottom: 1.5rem;
}

.form-group label.checkbox-label {
  display: flex;
  align-items: center;
  margin-bottom: 0;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
  color: var(--color-text-muted);
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.forgot-link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: opacity 0.2s;
}

.forgot-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
  width: 1rem;
  height: 1rem;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.input-field {
  width: 100%;
  padding: 0.75rem;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: inherit;
  transition: border-color 0.3s ease, background-color 0.3s ease;
}

.input-field:focus {
  outline: none;
  border-color: var(--color-primary);
  background-color: var(--color-bg-surface);
}

.w-full {
  width: 100%;
}

.error-msg {
  color: #e53e3e;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  text-align: center;
}

@media (max-width: 768px) {
  .login-wrapper {
    flex-direction: column;
  }
  .login-right {
    display: none;
  }
}
</style>

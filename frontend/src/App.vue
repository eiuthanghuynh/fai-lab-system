<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useIdle, useDark } from '@vueuse/core'
import { useAuthStore } from './stores/auth'
import api from './services/api'
import ConfirmModal from './components/ConfirmModal.vue'
import { useI18n } from 'vue-i18n'

// Initialize global dark mode
useDark({ 
  initialValue: 'light',
  disableTransition: false
});

const { t } = useI18n()
const { idle } = useIdle(30 * 60 * 1000) // 30 minutes in milliseconds
const authStore = useAuthStore()
const router = useRouter()

const showSessionAlert = ref(false)
const sessionAlertMessage = ref('')

const handleSessionExpired = (event: Event) => {
  const customEvent = event as CustomEvent;
  if (customEvent.detail === 'idle') {
    sessionAlertMessage.value = t('session.idle_expired');
  } else {
    sessionAlertMessage.value = t('session.invalidated');
  }
  showSessionAlert.value = true;
};

onMounted(() => {
  window.addEventListener('session-expired', handleSessionExpired);
});

onUnmounted(() => {
  window.removeEventListener('session-expired', handleSessionExpired);
});

watch(idle, async (isIdle) => {
  if (isIdle && authStore.isAuthenticated) {
    try {
      await api.post('/auth/logout')
    } catch (err) {
      // Ignore if network error or already invalidated
    } finally {
      authStore.logout()
      window.dispatchEvent(new CustomEvent('session-expired', { detail: 'idle' }))
    }
  }
})

import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

const closeAlertAndRedirect = () => {
  showSessionAlert.value = false;
  router.push({ name: 'login' });
};
</script>

<template>
  <Toaster position="top-center" richColors />
  <router-view v-slot="{ Component }">
    <Transition 
      mode="out-in"
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-2"
      leave-to-class="opacity-0 translate-y-2"
    >
      <component :is="Component" />
    </Transition>
  </router-view>
  
  <ConfirmModal
    :is-open="showSessionAlert"
    :title="t('common.warning')"
    :message="sessionAlertMessage"
    :confirm-text="t('common.confirm')"
    :hide-cancel="true"
    @confirm="closeAlertAndRedirect"
    @cancel="closeAlertAndRedirect"
  />
</template>



<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const { t } = useI18n();

const goHome = () => {
  router.push({ name: 'home' });
};
</script>

<template>
  <div class="notfound-container flex flex-col items-center justify-center text-center">
    <h1 class="error-code text-9xl font-bold text-gray-800 dark:text-gray-200">{{ t('error_page.notfound_title') }}</h1>
    <h2 class="error-subtitle text-4xl font-semibold text-gray-600 dark:text-gray-400 mt-4">{{ t('error_page.notfound_subtitle') }}</h2>
    <p class="error-desc text-lg text-gray-500 dark:text-gray-400 mt-6 max-w-md">{{ t('error_page.notfound_desc') }}</p>
    
    <button @click="goHome" class="btn-primary px-6 py-3 rounded-lg hover:shadow-lg transition-all duration-300" style="margin-top: 2rem;">
      {{ t('error_page.back_to_home') }}
    </button>
  </div>
</template>

<style scoped>
.notfound-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.error-code {
  font-size: 8rem;
  letter-spacing: -0.02em;
  color: var(--color-text);
}
.error-subtitle {
  color: var(--color-text-muted);
}
.error-desc {
  color: var(--color-text-muted);
}
</style>

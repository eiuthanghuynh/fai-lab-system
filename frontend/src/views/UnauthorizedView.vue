<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
const { t } = useI18n();

const goHome = () => {
  router.push({ name: 'home' });
};
</script>

<template>
  <div class="h-full w-full flex flex-col items-center justify-center text-center">
    <h1 class="text-[8rem] tracking-tight text-text font-bold">{{ t('error_page.unauthorized_title') }}</h1>
    <h2 class="text-4xl font-semibold text-text-muted mt-4">{{ t('error_page.unauthorized_subtitle') }}</h2>
    <p class="text-lg text-text-muted mt-6 max-w-md">{{ t('error_page.unauthorized_desc') }}</p>
    
    <Button @click="goHome" class="mt-8 px-6 py-3">
      {{ t('error_page.back_to_home') }}
    </Button>
  </div>
</template>

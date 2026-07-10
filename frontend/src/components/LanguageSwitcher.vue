<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import vnFlag from '../assets/flags/vn.svg';
import gbFlag from '../assets/flags/gb.svg';

const { t, locale } = useI18n();
const isOpen = ref(false);

const props = defineProps({
  showText: {
    type: Boolean,
    default: false
  }
});

const languages = [
  { code: 'vi', name: 'Tiếng Việt', flag: vnFlag },
  { code: 'en', name: 'English', flag: gbFlag }
];

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const selectLanguage = (code: string) => {
  locale.value = code;
  localStorage.setItem('language_preference', code);
  isOpen.value = false;
};

const closeDropdown = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.lang-switcher-container')) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeDropdown);
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
});
</script>

<template>
  <div class="flex justify-between items-center px-1 py-2 w-full font-sans relative z-50 lang-switcher-container">
    <span class="text-sm text-text font-medium">{{ t('common.choose_language') }}</span>
    <div :class="['relative bg-transparent border border-border rounded cursor-pointer select-none', props.showText ? 'min-w-[150px]' : 'min-w-[60px]']" @click="toggleDropdown">
      <div class="flex justify-between items-center px-3 py-2 text-text text-sm font-medium">
        <span class="flex items-center gap-2">
          <img :src="languages.find(l => l.code === locale)?.flag" class="w-5 h-auto rounded-sm shadow-[0_0_2px_rgba(0,0,0,0.2)]" alt="flag" />
          <span v-if="props.showText" class="name">{{ languages.find(l => l.code === locale)?.name }}</span>
        </span>
        <span class="text-[0.6rem] text-text-muted transition-transform duration-300" :class="{ 'rotate-180': isOpen }">▼</span>
      </div>
      <transition name="dropdown">
        <ul v-if="isOpen" class="absolute top-full left-0 right-0 mt-1 p-0 m-0 list-none bg-bg-surface border border-border rounded shadow-[0_4px_12px_rgba(0,0,0,0.15)] overflow-hidden z-[101] origin-top">
          <li 
            v-for="lang in languages" 
            :key="lang.code" 
            @click.stop="selectLanguage(lang.code)"
            :class="[
              'p-2 flex items-center gap-2 text-text text-sm transition-colors cursor-pointer hover:bg-black/10 dark:hover:bg-white/10',
              !props.showText ? 'justify-center' : '',
              locale === lang.code ? 'bg-primary/10 font-semibold' : ''
            ]"
          >
            <img :src="lang.flag" class="w-5 h-auto rounded-sm shadow-[0_0_2px_rgba(0,0,0,0.2)]" alt="flag" />
            <span v-if="props.showText" class="name">{{ lang.name }}</span>
          </li>
        </ul>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

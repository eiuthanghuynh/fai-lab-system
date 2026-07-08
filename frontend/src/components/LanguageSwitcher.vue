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
  <div class="lang-switcher-container">
    <span class="lang-label">{{ t('common.choose_language') }}</span>
    <div class="custom-select" :class="{ open: isOpen, 'has-text': props.showText }" @click="toggleDropdown">
      <div class="select-trigger">
        <span class="flag-text">
          <img :src="languages.find(l => l.code === locale)?.flag" class="flag-icon" alt="flag" />
          <span v-if="props.showText" class="name">{{ languages.find(l => l.code === locale)?.name }}</span>
        </span>
        <span class="arrow">▼</span>
      </div>
      <transition name="dropdown">
        <ul v-if="isOpen" class="options-list">
          <li 
            v-for="lang in languages" 
            :key="lang.code" 
            @click.stop="selectLanguage(lang.code)"
            :class="{ active: locale === lang.code }"
          >
            <img :src="lang.flag" class="flag-icon" alt="flag" />
            <span v-if="props.showText" class="name">{{ lang.name }}</span>
          </li>
        </ul>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.lang-switcher-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.25rem;
  width: 100%;
  font-family: 'Inter', sans-serif;
  position: relative;
  z-index: 100;
}

.lang-label {
  font-size: 0.875rem;
  color: var(--color-text);
  font-weight: 500;
}

.custom-select {
  position: relative;
  min-width: 60px;
  background: transparent;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.custom-select.has-text {
  min-width: 150px;
}

.select-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  color: var(--color-text, #333);
  font-size: 0.875rem;
  font-weight: 500;
}

.flag-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.flag-icon {
  width: 20px;
  height: auto;
  border-radius: 2px;
  box-shadow: 0 0 2px rgba(0,0,0,0.2);
}

.arrow {
  font-size: 0.6rem;
  color: var(--color-text-muted, #888);
  transition: transform 0.3s;
}

.custom-select.open .arrow {
  transform: rotate(180deg);
}

.options-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin: 4px 0 0 0;
  padding: 0;
  list-style: none;
  background: var(--color-bg-surface, #fff);
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  overflow: hidden;
  z-index: 101;
}

.options-list li {
  padding: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text, #333);
  font-size: 0.875rem;
  transition: background 0.2s;
}

.options-list li:not(:has(.name)) {
  justify-content: center;
}

.options-list li:hover {
  background: rgba(128, 128, 128, 0.1);
}

.options-list li.active {
  background: rgba(99, 224, 121, 0.1);
  font-weight: 600;
}

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

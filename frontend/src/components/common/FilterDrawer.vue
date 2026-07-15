<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { onClickOutside, useEventListener } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import Button from '@/components/ui/Button.vue';

const props = defineProps<{
  activeCount?: number;
}>();

const { t } = useI18n();

const isOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const popupRef = ref<HTMLElement | null>(null);

const dropdownStyle = ref({});

const updatePosition = () => {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    right: `${window.innerWidth - rect.right}px`,
    width: '580px',
    maxHeight: `min(95vh, calc(100vh - ${rect.bottom + 16}px))`
  };
};

const toggle = async () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    await nextTick();
    updatePosition();
  }
};



const onScroll = (e: Event) => {
  if (!isOpen.value) return;
  const target = e.target as HTMLElement;
  if (triggerRef.value?.contains(target) || popupRef.value?.contains(target) || (target.closest && target.closest('.dropdown-menu-teleport') !== null)) {
    return;
  }
  // Instead of closing, just update position so it follows the scroll
  updatePosition();
};

useEventListener(document, 'scroll', onScroll, true);
useEventListener(window, 'resize', onScroll);

onClickOutside(
  popupRef,
  () => { isOpen.value = false; },
  { ignore: [triggerRef, '.dropdown-menu-teleport'] }
);

defineExpose({
  close: () => isOpen.value = false
});
</script>

<template>
  <div class="relative inline-block" ref="triggerRef">
    <Button variant="secondary" class="gap-2" @click.stop="toggle">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </svg>
      {{ t('action.filter') || 'Filters' }}
      <span v-if="activeCount && activeCount > 0" class="bg-primary text-bg rounded-full px-1.5 py-0.5 text-xs font-bold ml-1">{{ activeCount }}</span>
    </Button>

    <Teleport to="body">
      <transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <div
          v-show="isOpen"
          ref="popupRef"
          :style="dropdownStyle"
          class="z-[9999] bg-bg-surface shadow-lg rounded-md ring-1 ring-primary ring-opacity-5 focus:outline-none border border-border origin-top-right flex flex-col max-h-[95vh]"
        >
          <div class="flex justify-between items-center p-4 border-b border-border bg-bg-surface shrink-0 rounded-t-md">
            <h3 class="m-0 text-[1.1rem] font-semibold text-text">{{ t('fai.advanced_filters') || 'Advanced Filters' }}</h3>
            <button class="bg-transparent border-none text-2xl text-text-muted cursor-pointer leading-none hover:text-text" @click="isOpen = false">&times;</button>
          </div>
          
          <div class="p-5 overflow-y-auto">
            <slot></slot>
          </div>
          
          <div class="flex justify-end gap-3 p-4 border-t border-border bg-bg-surface shrink-0 rounded-b-md">
            <slot name="footer"></slot>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

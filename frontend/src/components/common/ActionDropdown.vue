<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref({})
const isUpwards = ref(false)

const updatePosition = () => {
  if (!dropdownRef.value) return;
  const rect = dropdownRef.value.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  if (spaceBelow < 200 && spaceAbove > spaceBelow) {
    isUpwards.value = true;
    dropdownStyle.value = {
      position: 'fixed',
      bottom: `${window.innerHeight - rect.top + 4}px`,
      right: `${window.innerWidth - rect.right}px`,
      minWidth: '130px'
    }
  } else {
    isUpwards.value = false;
    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      right: `${window.innerWidth - rect.right}px`,
      minWidth: '130px'
    }
  }
}

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    updatePosition()
  }
}

const closeDropdown = (e: MouseEvent) => {
  const target = e.target as Node;
  if (!dropdownRef.value?.contains(target) && !menuRef.value?.contains(target)) {
    isOpen.value = false;
  }
}

const onScroll = (e: Event) => {
  if (!isOpen.value) return;
  const target = e.target as HTMLElement;
  if (dropdownRef.value?.contains(target) || menuRef.value?.contains(target)) return;
  isOpen.value = false;
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
  document.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
  document.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div class="relative inline-block text-left" ref="dropdownRef">
    <button 
      type="button" 
      @click="toggleDropdown" 
      class="p-4 rounded-md hover:bg-bg text-text-muted hover:text-text transition-colors focus:outline-none"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
    </button>
    
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
          ref="menuRef" 
          :style="dropdownStyle" 
          :class="[
            'z-[9999] bg-bg-surface shadow-lg rounded-md py-1 border border-border flex flex-col',
            isUpwards ? 'origin-bottom' : 'origin-top'
          ]"
          @click="isOpen = false"
        >
          <slot></slot>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onClickOutside, useEventListener } from '@vueuse/core'

const props = defineProps<{
  options: { label: string | number; value: string | number }[]
  placeholder?: string
}>()

const modelValue = defineModel<(string | number)[]>({ required: true })

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const isUpwards = ref(false)
const dropdownStyle = ref({})

const updatePosition = () => {
  if (!dropdownRef.value) return;
  const rect = dropdownRef.value.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  
  if (spaceBelow < 260 && spaceAbove > spaceBelow) {
    isUpwards.value = true;
    dropdownStyle.value = {
      position: 'fixed',
      bottom: `${window.innerHeight - rect.top + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`
    }
  } else {
    isUpwards.value = false;
    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`
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

const onScroll = (e: Event) => {
  if (!isOpen.value) return;
  const target = e.target as HTMLElement;
  if (dropdownRef.value?.contains(target) || menuRef.value?.contains(target)) {
    return;
  }
  isOpen.value = false;
};

useEventListener(document, 'scroll', onScroll, true)
useEventListener(window, 'resize', onScroll)

onClickOutside(
  dropdownRef,
  () => { isOpen.value = false; },
  { ignore: [menuRef] }
)

const isSelected = (value: string | number) => {
  return modelValue.value.includes(value)
}

const toggleSelection = (value: string | number) => {
  const newValue = [...modelValue.value]
  const index = newValue.indexOf(value)
  if (index === -1) {
    newValue.push(value)
  } else {
    newValue.splice(index, 1)
  }
  modelValue.value = newValue
}

import Checkbox from '../ui/Checkbox.vue'

const displayValue = computed(() => {
  if (modelValue.value.length === 0) {
    return props.placeholder || 'Select...'
  }
  // Map values back to labels
  const selectedLabels = modelValue.value.map(val => {
    const opt = props.options.find(o => o.value === val)
    return opt ? opt.label : val
  })
  return selectedLabels.join(', ')
})
</script>

<template>
  <div class="relative w-full" ref="dropdownRef">
    <!-- Dropdown Trigger -->
    <button
      type="button"
      @click="toggleDropdown"
      class="form-select w-full bg-bg-surface border border-border px-3 py-2 text-text rounded-md shadow-sm focus:ring-primary focus:border-primary text-left flex justify-between items-center cursor-pointer min-w-[120px]"
    >
      <span class="truncate block w-full pr-4" :class="{'text-text-muted': modelValue.length === 0}">
        {{ displayValue }}
      </span>
      <span class="absolute right-3 pointer-events-none">
        <svg class="h-4 w-4 text-text-muted transition-transform duration-200" :class="{ 'rotate-180': isOpen }" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>
    </button>

    <!-- Dropdown Menu -->
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
            'z-[9999] bg-bg-surface shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-primary ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-border',
            isUpwards ? 'origin-bottom' : 'origin-top'
          ]"
        >
        <div v-if="options.length === 0" class="px-3 py-2 text-text-muted text-sm">
          No options available
        </div>
        <div
          v-for="option in options"
          :key="option.value"
          class="hover:bg-bg"
        >
          <Checkbox
            :model-value="isSelected(option.value)"
            @update:model-value="toggleSelection(option.value)"
            class="w-full"
          >
            <span class="block truncate text-text">{{ option.label }}</span>
          </Checkbox>
        </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: string | number
  options: { label: string | number; value: string | number }[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})

const selectOption = (value: string | number) => {
  emit('update:modelValue', value)
  isOpen.value = false
}

const displayValue = computed(() => {
  const opt = props.options.find(o => o.value === props.modelValue)
  return opt ? opt.label : props.placeholder || 'Select...'
})
</script>

<template>
  <div class="relative w-full sm:w-auto" ref="dropdownRef">
    <!-- Dropdown Trigger -->
    <button
      type="button"
      @click="toggleDropdown"
      class="form-select w-full sm:w-32 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white rounded-md shadow-sm focus:ring-primary focus:border-primary text-left flex justify-between items-center cursor-pointer min-w-[100px]"
    >
      <span class="truncate block w-full pr-4" :class="{'text-gray-500 dark:text-gray-400': !modelValue}">
        {{ displayValue }}
      </span>
      <span class="absolute right-3 pointer-events-none">
        <svg class="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>
    </button>

    <!-- Dropdown Menu -->
    <div
      v-show="isOpen"
      class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-gray-200 dark:border-gray-700"
    >
      <div v-if="options.length === 0" class="px-3 py-2 text-gray-500 text-sm">
        No options available
      </div>
      <div
        v-for="option in options"
        :key="option.value"
        @click="selectOption(option.value)"
        class="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-200"
        :class="{'bg-gray-50 dark:bg-gray-700 font-medium text-primary dark:text-primary': modelValue === option.value}"
      >
        <span class="block truncate">
          {{ option.label }}
        </span>
      </div>
    </div>
  </div>
</template>

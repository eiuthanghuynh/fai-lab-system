<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: (string | number)[]
  options: { label: string | number; value: string | number }[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: (string | number)[]): void
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

const isSelected = (value: string | number) => {
  return props.modelValue.includes(value)
}

const toggleSelection = (value: string | number) => {
  const newValue = [...props.modelValue]
  const index = newValue.indexOf(value)
  if (index === -1) {
    newValue.push(value)
  } else {
    newValue.splice(index, 1)
  }
  emit('update:modelValue', newValue)
}

const displayValue = computed(() => {
  if (props.modelValue.length === 0) {
    return props.placeholder || 'Select...'
  }
  // Map values back to labels
  const selectedLabels = props.modelValue.map(val => {
    const opt = props.options.find(o => o.value === val)
    return opt ? opt.label : val
  })
  return selectedLabels.join(', ')
})
</script>

<template>
  <div class="relative w-full sm:w-auto" ref="dropdownRef">
    <!-- Dropdown Trigger -->
    <button
      type="button"
      @click="toggleDropdown"
      class="form-select w-full sm:w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white rounded-md shadow-sm focus:ring-primary focus:border-primary text-left flex justify-between items-center cursor-pointer min-w-[120px]"
    >
      <span class="truncate block w-full pr-4" :class="{'text-gray-500 dark:text-gray-400': modelValue.length === 0}">
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
      <label
        v-for="option in options"
        :key="option.value"
        class="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      >
        <input
          type="checkbox"
          :checked="isSelected(option.value)"
          @change="toggleSelection(option.value)"
          class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
        />
        <span class="ml-3 block truncate text-gray-700 dark:text-gray-200">
          {{ option.label }}
        </span>
      </label>
    </div>
  </div>
</template>

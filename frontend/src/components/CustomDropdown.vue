<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean],
    default: ''
  },
  options: {
    type: Array as () => Array<{ value: any, label: string }>,
    required: true
  },
  placeholder: {
    type: String,
    default: 'Select'
  },
  direction: {
    type: String,
    default: 'down'
  },
  variant: {
    type: String,
    default: 'pill'
  },
  multiple: {
    type: Boolean,
    default: false
  },
  rows: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const optionsRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref<Record<string, string>>({ top: '0px', left: '0px', width: '0px' });
const isUpwards = ref(false);

const updatePosition = () => {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  
  if (spaceBelow < 260 && spaceAbove > spaceBelow) {
    isUpwards.value = true;
    dropdownStyle.value = {
      top: 'auto',
      bottom: `${window.innerHeight - rect.top + 4}px`,
      left: `${rect.left}px`,
      minWidth: `${rect.width}px`,
      width: props.rows > 0 ? 'max-content' : `${rect.width}px`
    };
  } else {
    isUpwards.value = false;
    dropdownStyle.value = {
      top: `${rect.bottom + 4}px`,
      bottom: 'auto',
      left: `${rect.left}px`,
      minWidth: `${rect.width}px`,
      width: props.rows > 0 ? 'max-content' : `${rect.width}px`
    };
  }
};

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    await nextTick();
    updatePosition();
  }
};

const selectOption = (val: any) => {
  if (props.multiple) {
    let currentVal = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    const index = currentVal.findIndex(v => String(v) === String(val));
    if (index === -1) {
      currentVal.push(val);
    } else {
      currentVal.splice(index, 1);
    }
    emit('update:modelValue', currentVal);
  } else {
    emit('update:modelValue', val);
    isOpen.value = false;
  }
};

const isSelected = (val: any) => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.some(v => String(v) === String(val));
  }
  return String(props.modelValue) === String(val);
};

const getSelectedText = () => {
  if (props.multiple) {
    if (Array.isArray(props.modelValue) && props.modelValue.length > 0) {
      if (props.modelValue.length === props.options.length && props.options.length > 0) {
        return 'All selected';
      }
      return `${props.modelValue.length} selected`;
    }
    return props.placeholder;
  }
  return props.options.find(o => String(o.value) === String(props.modelValue))?.label || props.placeholder;
};

const closeDropdown = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const isTrigger = containerRef.value?.contains(target);
  const isOptions = optionsRef.value?.contains(target);
  if (!isTrigger && !isOptions) {
    isOpen.value = false;
  }
};

const onScroll = (e: Event) => {
  if (!isOpen.value) return;
  const target = e.target as HTMLElement;
  // Ignore scrolling inside the dropdown itself
  if (optionsRef.value && (optionsRef.value === target || optionsRef.value.contains(target))) {
    return;
  }
  isOpen.value = false;
};

onMounted(() => {
  document.addEventListener('click', closeDropdown);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
  document.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', onScroll);
});
</script>

<template>
  <div class="relative inline-block select-none font-sans z-50 custom-dropdown-container" :class="{ 'block w-full': variant === 'form' }" ref="containerRef" @click="toggleDropdown">
    <div :class="[
      'flex items-center gap-2 cursor-pointer transition-all text-text text-base border',
      variant === 'pill' ? 'bg-bg-surface rounded-[20px] px-4 py-1 h-[44px] border-border' : '',
      variant === 'form' ? 'bg-bg rounded p-3 w-full border-border' : '',
      isOpen ? '!border-primary shadow-[0_0_0_2px_rgba(99,224,121,0.2)]' : 'hover:bg-black/5 dark:hover:bg-white/5'
    ]">
      <slot name="icon"></slot>
      <span class="whitespace-nowrap">
        {{ getSelectedText() }}
      </span>
      <span class="text-[0.6rem] text-text-muted transition-transform ml-1" :class="{ 'rotate-180': isOpen }">▼</span>
    </div>
    
    <Teleport to="body">
      <transition name="dropdown">
        <ul 
          v-if="isOpen" 
          class="fixed bg-bg-surface border border-border list-none py-2 m-0 shadow-[0_10px_25px_rgba(0,0,0,0.5)] max-h-[250px] overflow-y-auto z-[9999] rounded-xl" 
          :class="[
            isUpwards ? 'origin-bottom' : 'origin-top',
            rows > 0 ? 'grid grid-flow-col max-w-[90vw] overflow-x-auto p-2 gap-0 !grid-cols-[minmax(180px,1fr)]' : '',
            variant === 'form' ? '!rounded' : ''
          ]"
          ref="optionsRef"
          :style="[dropdownStyle, rows > 0 ? { gridTemplateRows: `repeat(${rows}, auto)` } : {}]"
        >
          <li 
            v-for="opt in options" 
            :key="String(opt.value)" 
            @click.stop="selectOption(opt.value)"
            :class="[
              'px-4 py-2 cursor-pointer transition-colors',
              rows > 0 ? 'px-3 py-2 rounded-md m-[2px]' : '',
              isSelected(opt.value) ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-black/5 dark:hover:bg-white/5'
            ]"
          >
            <div style="display: flex; align-items: center; gap: 8px;">
              <input v-if="multiple" type="checkbox" :checked="isSelected(opt.value)" style="pointer-events: none; flex-shrink: 0;" />
              <span style="white-space: nowrap;">{{ opt.label }}</span>
            </div>
          </li>
        </ul>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
:deep(svg) {
  color: var(--color-text-muted);
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

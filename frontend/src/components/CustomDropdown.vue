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
  <div class="custom-dropdown-container" :class="[`variant-${variant}`]" ref="containerRef" @click="toggleDropdown">
    <div class="dropdown-trigger" :class="{ open: isOpen }">
      <slot name="icon"></slot>
      <span class="selected-text">
        {{ getSelectedText() }}
      </span>
      <span class="arrow" :class="{ open: isOpen }">▼</span>
    </div>
    
    <Teleport to="body">
      <transition name="dropdown">
        <ul 
          v-if="isOpen" 
          class="options-list teleported-options-list" 
          :class="[{ 'options-up': isUpwards, 'grid-mode': rows > 0 }, `variant-${variant}`]"
          ref="optionsRef"
          :style="[dropdownStyle, rows > 0 ? { gridTemplateRows: `repeat(${rows}, auto)` } : {}]"
        >
          <li 
            v-for="opt in options" 
            :key="String(opt.value)" 
            @click.stop="selectOption(opt.value)"
            :class="{ active: isSelected(opt.value) }"
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
.custom-dropdown-container {
  position: relative;
  display: inline-block;
  user-select: none;
  font-family: 'Inter', sans-serif;
  z-index: 100;
}

.custom-dropdown-container.variant-form {
  display: block;
  width: 100%;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text);
  font-size: 1rem;
}

.variant-pill .dropdown-trigger {
  background: var(--color-bg-surface);
  border-radius: 20px;
  padding: 0.25rem 1rem;
  height: 44px;
}

.variant-form .dropdown-trigger {
  background: var(--color-bg);
  border-radius: 4px;
  padding: 0.75rem;
  width: 100%;
}

.dropdown-trigger:hover {
  background: rgba(128, 128, 128, 0.05);
}

.dropdown-trigger.open {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(99, 224, 121, 0.2);
}

::v-deep(svg) {
  color: var(--color-text-muted);
}

.selected-text {
  white-space: nowrap;
}

.arrow {
  font-size: 0.6rem;
  color: var(--color-text-muted);
  transition: transform 0.3s;
  margin-left: 0.25rem;
}

.arrow.open {
  transform: rotate(180deg);
}

.teleported-options-list {
  position: fixed;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  list-style: none;
  padding: 0.5rem 0;
  margin: 0;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  max-height: 250px;
  overflow-y: auto;
  z-index: 9999;
  border-radius: 12px;
  transform-origin: top center;
}

.teleported-options-list.grid-mode {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(180px, 1fr);
  gap: 0;
  max-width: 90vw;
  overflow-x: auto;
  padding: 0.5rem;
}

.teleported-options-list.options-up {
  transform-origin: bottom center;
}

.teleported-options-list.variant-form {
  border-radius: 4px;
}

.teleported-options-list li {
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.teleported-options-list.grid-mode li {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin: 2px;
}

.options-list li.active {
  background: rgba(99, 224, 121, 0.1);
  font-weight: 600;
  color: var(--color-primary);
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

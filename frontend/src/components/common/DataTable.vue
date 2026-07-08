<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue';

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  sticky?: 'left' | 'right';
  width?: string;
  minWidth?: string;
}

const props = defineProps<{
  columns: DataTableColumn[];
  data: any[];
  isLoading?: boolean;
  selectable?: boolean;
  selectedRows?: any[];
  rowKey?: string; // e.g. 'id'
  sortBy?: string;
  sortDesc?: boolean;
  rowClass?: (item: any) => string;
}>();

const emit = defineEmits<{
  (e: 'update:selectedRows', value: any[]): void;
  (e: 'sort', columnKey: string): void;
}>();

const rowKeyProp = computed(() => props.rowKey || 'id');

// Scrollbar auto-hide logic
const tableContainerRef = ref<HTMLElement | null>(null);
const tableRef = ref<HTMLElement | null>(null);
const scrollTimeout = ref<number | null>(null);

const wakeScrollbar = () => {
  if (tableContainerRef.value) {
    tableContainerRef.value.classList.remove('is-scrollbar-idle');
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value);
    }
    scrollTimeout.value = window.setTimeout(() => {
      if (tableContainerRef.value) {
        tableContainerRef.value.classList.add('is-scrollbar-idle');
      }
    }, 1000);
  }
};

// Selection logic
const isAllSelected = computed(() => {
  if (!props.data || props.data.length === 0) return false;
  return props.selectedRows?.length === props.data.length;
});

const isSomeSelected = computed(() => {
  return props.selectedRows && props.selectedRows.length > 0 && props.selectedRows.length < props.data.length;
});

const toggleSelectAll = (e: Event) => {
  const isChecked = (e.target as HTMLInputElement).checked;
  if (!isChecked) {
    emit('update:selectedRows', []);
  } else {
    emit('update:selectedRows', props.data.map(item => item[rowKeyProp.value]));
  }
};

const toggleSelectRow = (rowId: any) => {
  const current = [...(props.selectedRows || [])];
  const index = current.indexOf(rowId);
  if (index === -1) {
    current.push(rowId);
  } else {
    current.splice(index, 1);
  }
  emit('update:selectedRows', current);
};

// Check if intermediate state needs to be set on DOM manually
const selectAllCheckbox = ref<HTMLInputElement | null>(null);
watch([isAllSelected, isSomeSelected], () => {
  if (selectAllCheckbox.value) {
    selectAllCheckbox.value.indeterminate = !!(isSomeSelected.value && !isAllSelected.value);
  }
});

const stickyOffsets = ref<Record<string, string>>({});

const updateStickyOffsets = () => {
  if (!tableRef.value) return;
  const thElements = tableRef.value.querySelectorAll('thead th');
  if (!thElements.length) return;
  
  const newOffsets: Record<string, string> = {};
  let currentLeftOffset = 0;
  
  thElements.forEach((th, index) => {
    if (th.classList.contains('sticky-left')) {
      newOffsets[`left-${index}`] = `${currentLeftOffset}px`;
      currentLeftOffset += th.getBoundingClientRect().width;
    }
  });

  let currentRightOffset = 0;
  const thArray = Array.from(thElements);
  for (let i = thArray.length - 1; i >= 0; i--) {
    const th = thArray[i];
    if (th.classList.contains('sticky-right')) {
      newOffsets[`right-${i}`] = `${currentRightOffset}px`;
      currentRightOffset += th.getBoundingClientRect().width;
    }
  }

  const changed = JSON.stringify(stickyOffsets.value) !== JSON.stringify(newOffsets);
  if (changed) {
    stickyOffsets.value = newOffsets;
  }
};

import { onUpdated } from 'vue';

onUpdated(() => {
  updateStickyOffsets();
});

watch(() => props.data, () => {
  nextTick(() => {
    updateStickyOffsets();
    wakeScrollbar();
  });
}, { deep: true });

onMounted(() => {
  window.addEventListener('resize', updateStickyOffsets);
  if (tableContainerRef.value) {
    tableContainerRef.value.classList.add('is-scrollbar-idle');
  }
  nextTick(() => {
    updateStickyOffsets();
    if (selectAllCheckbox.value) {
      selectAllCheckbox.value.indeterminate = !!(isSomeSelected.value && !isAllSelected.value);
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', updateStickyOffsets);
});

const getSortIcon = (columnKey: string) => {
  if (props.sortBy !== columnKey) return '↕';
  return props.sortDesc ? '↓' : '↑';
};
</script>

<template>
  <div class="data-table-root">
    <div class="table-container is-scrollbar-idle" ref="tableContainerRef" @scroll="wakeScrollbar" @mousemove="wakeScrollbar">
      
      <!-- Loading Overlay -->
      <transition name="fade">
        <div v-if="isLoading" class="loading-overlay">
          <svg class="spinner" viewBox="0 0 50 50">
            <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
          </svg>
        </div>
      </transition>

      <table class="data-table" :class="{ 'is-loading-content': isLoading }" ref="tableRef">
        <thead>
          <tr>
            <th v-if="selectable" class="sticky-left nowrap col-checkbox" :style="{ minWidth: '50px', width: '50px', left: stickyOffsets['left-0'] }">
              <input 
                type="checkbox" 
                ref="selectAllCheckbox"
                :checked="isAllSelected" 
                @change="toggleSelectAll" 
              />
            </th>
            <th 
              v-for="(col, index) in columns" 
              :key="col.key"
              :class="[
                col.sticky === 'left' ? 'sticky-left' : '',
                col.sticky === 'right' ? 'sticky-right' : '',
                col.sortable ? 'sortable-header' : '',
                'nowrap'
              ]"
              :style="{ 
                width: col.width, minWidth: col.minWidth || col.width, maxWidth: col.width,
                left: col.sticky === 'left' ? stickyOffsets[`left-${selectable ? index + 1 : index}`] : undefined,
                right: col.sticky === 'right' ? stickyOffsets[`right-${selectable ? index + 1 : index}`] : undefined
              }"
              @click="col.sortable ? $emit('sort', col.key) : null"
            >
              {{ col.label }}
              <span v-if="col.sortable" class="sort-icon">{{ getSortIcon(col.key) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="data.length === 0">
            <td :colspan="selectable ? columns.length + 1 : columns.length" class="text-center py-4">
              {{ $t ? $t('table.no_data') : 'No data available' }}
            </td>
          </tr>
          <tr v-for="(item, index) in data" :key="item[rowKeyProp]" :class="rowClass ? rowClass(item) : ''">
            <td v-if="selectable" class="sticky-left col-checkbox" :style="{ left: stickyOffsets['left-0'] }">
              <input 
                type="checkbox" 
                :checked="selectedRows?.includes(item[rowKeyProp])" 
                @change="toggleSelectRow(item[rowKeyProp])" 
              />
            </td>
            <td 
              v-for="(col, colIndex) in columns" 
              :key="col.key"
              :class="[
                col.sticky === 'left' ? 'sticky-left' : '',
                col.sticky === 'right' ? 'sticky-right' : '',
              ]"
              :style="{ 
                left: col.sticky === 'left' ? stickyOffsets[`left-${selectable ? colIndex + 1 : colIndex}`] : undefined,
                right: col.sticky === 'right' ? stickyOffsets[`right-${selectable ? colIndex + 1 : colIndex}`] : undefined
              }"
            >
              <slot :name="`cell-${col.key}`" :item="item" :index="index">
                {{ item[col.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.data-table-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.table-container {
  overflow-x: auto;
  overflow-y: auto;
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  position: relative;
  min-height: 200px;
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  transition: opacity 0.3s ease;
}

.data-table.is-loading-content {
  opacity: 0.4;
  pointer-events: none;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(var(--color-bg-surface-rgb, 255, 255, 255), 0.3);
  z-index: 50;
  backdrop-filter: blur(1px);
}

.spinner {
  animation: rotate 2s linear infinite;
  z-index: 2;
  width: 40px;
  height: 40px;
}
  
.spinner .path {
  stroke: var(--color-primary);
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.data-table th, .data-table td {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  z-index: 1;
}

.data-table th {
  font-weight: 600;
  color: var(--color-bg);
  background-color: var(--color-primary);
  position: sticky;
  top: 0;
  z-index: 10;
}

.sticky-left, .sticky-right {
  position: sticky;
}

.data-table tbody .sticky-left, 
.data-table tbody .sticky-right {
  z-index: 2;
}

.data-table thead .sticky-left, 
.data-table thead .sticky-right {
  z-index: 11;
}

.nowrap {
  white-space: nowrap;
}

.sortable-header {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s, filter 0.2s;
}

.sortable-header:hover {
  filter: brightness(0.85);
}

.sort-icon {
  display: inline-block;
  margin-left: 0.5rem;
  color: var(--color-bg);
  opacity: 0.8;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
}

.text-center {
  text-align: center;
}

.py-4 {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.col-checkbox {
  text-align: center;
  padding-right: 0.5rem !important;
}

.data-table tbody tr:hover td {
  filter: brightness(0.97);
}
</style>

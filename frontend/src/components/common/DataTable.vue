<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed } from 'vue';
import { useEventListener } from '@vueuse/core';
import Checkbox from '@/components/ui/Checkbox.vue';

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

const toggleSelectAll = (isChecked: boolean) => {
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

useEventListener(window, 'resize', updateStickyOffsets);

onMounted(() => {
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


const getSortIcon = (columnKey: string) => {
  if (props.sortBy !== columnKey) return '↕';
  return props.sortDesc ? '↓' : '↑';
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="overflow-x-auto overflow-y-auto flex-1 border border-border rounded-lg bg-bg-surface relative min-h-[200px]" ref="tableContainerRef" @scroll="wakeScrollbar" @mousemove="wakeScrollbar">
      
      <!-- Loading Overlay -->
      <transition 
        enter-active-class="transition-opacity duration-300"
        leave-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-bg-surface/30 z-[50] backdrop-blur-[1px]">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-primary animate-spin z-[2]"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
        </div>
      </transition>

      <table class="w-full border-collapse border-spacing-0 text-left transition-opacity duration-300" :class="{ 'opacity-40 pointer-events-none': isLoading }" ref="tableRef">
        <thead>
          <tr>
            <th v-if="selectable" class="sticky-left sticky top-0 z-[11] p-4 border-b border-border font-semibold text-bg bg-primary whitespace-nowrap text-center pr-2" :style="{ minWidth: '50px', width: '50px', left: stickyOffsets['left-0'] }">
              <Checkbox 
                ref="selectAllCheckbox"
                :model-value="isAllSelected" 
                @update:model-value="toggleSelectAll" 
                class="flex justify-center"
              />
            </th>
            <th 
              v-for="(col, index) in columns" 
              :key="col.key"
              :class="[
                col.sticky === 'left' ? 'sticky-left' : '',
                col.sticky === 'right' ? 'sticky-right' : '',
                col.sticky === 'left' || col.sticky === 'right' ? 'sticky z-[11]' : 'sticky z-[10]',
                col.sortable ? 'cursor-pointer select-none transition-all duration-200 hover:brightness-90' : '',
                'p-4 border-b border-border font-semibold text-bg bg-primary whitespace-nowrap top-0'
              ]"
              :style="{ 
                width: col.width, minWidth: col.minWidth || col.width, maxWidth: col.width,
                left: col.sticky === 'left' ? stickyOffsets[`left-${selectable ? index + 1 : index}`] : undefined,
                right: col.sticky === 'right' ? stickyOffsets[`right-${selectable ? index + 1 : index}`] : undefined
              }"
              @click="col.sortable ? $emit('sort', col.key) : null"
            >
              {{ col.label }}
              <span v-if="col.sortable" class="inline-block ml-2 text-bg opacity-80">{{ getSortIcon(col.key) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="data.length === 0">
            <td :colspan="selectable ? columns.length + 1 : columns.length" class="text-center py-4 p-4 border-b border-border bg-bg-surface z-[1] text-text-muted">
              {{ $t ? $t('table.no_data') : 'No data available' }}
            </td>
          </tr>
          <tr v-for="(item, index) in data" :key="item[rowKeyProp]" class="hover:brightness-[0.97] transition-all" :class="rowClass ? rowClass(item) : ''">
            <td v-if="selectable" class="sticky z-[2] p-4 border-b border-border bg-bg-surface text-center pr-2" :style="{ left: stickyOffsets['left-0'] }">
              <Checkbox 
                :model-value="selectedRows?.includes(item[rowKeyProp])" 
                @update:model-value="toggleSelectRow(item[rowKeyProp])" 
                class="flex justify-center"
              />
            </td>
            <td 
              v-for="(col, colIndex) in columns" 
              :key="col.key"
              :class="[
                col.sticky === 'left' || col.sticky === 'right' ? 'sticky z-[2]' : 'z-[1]',
                'p-4 border-b border-border bg-bg-surface text-text'
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

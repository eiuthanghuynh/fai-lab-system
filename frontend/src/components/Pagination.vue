<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';

const { t } = useI18n();

const props = defineProps({
  total: {
    type: Number,
    required: true
  },
  modelValue: {
    type: Number,
    required: true
  },
  rowsPerPage: {
    type: Number,
    required: true
  },
  rowsPerPageOptions: {
    type: Array as () => number[],
    default: () => [10, 25, 50, 100]
  }
});

const emit = defineEmits(['update:modelValue', 'update:rowsPerPage']);

const dropdownOptions = computed(() => {
  return props.rowsPerPageOptions.map(opt => ({
    value: opt,
    label: String(opt)
  }));
});

const totalPages = computed(() => Math.ceil(props.total / props.rowsPerPage) || 1);

const onRowsPerPageChange = (newLimit: number) => {
  emit('update:rowsPerPage', newLimit);
  emit('update:modelValue', 1);
};

const changePage = (page: number | string) => {
  if (typeof page === 'number' && page >= 1 && page <= totalPages.value) {
    emit('update:modelValue', page);
  }
};

const pages = computed(() => {
  const current = props.modelValue;
  const total = totalPages.value;
  const delta = 2; // How many pages to show around current page
  
  let left = current - delta;
  let right = current + delta;
  const range = [];
  const rangeWithDots = [];
  let l;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= left && i <= right)) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l !== 1) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots;
});
</script>

<template>
  <div class="flex justify-between items-center p-4 border-t border-border bg-bg-surface rounded-b-lg text-text-muted text-sm">
    <div class="flex items-center gap-3">
      <span class="font-medium text-text-muted">{{ t('pagination.rows_per_page') }}</span>
      <div class="w-20 [&_button]:h-8 [&_button]:min-h-[32px] [&_button]:py-1 [&_button]:text-sm [&_button]:min-w-0">
        <SingleSelectDropdown 
          :modelValue="rowsPerPage"
          :options="dropdownOptions"
          @update:modelValue="onRowsPerPageChange"
        />
      </div>
      <span v-if="t('pagination.of_rows', { total })" class="font-medium text-text-muted">{{ t('pagination.of_rows', { total }) }}</span>
    </div>

    <div class="flex items-center gap-2">
      <button class="flex items-center justify-center min-w-[32px] h-[32px] px-2 border border-transparent rounded-full bg-transparent text-text-muted font-semibold cursor-pointer transition-all hover:not(:disabled):bg-white/5 hover:not(:disabled):text-text disabled:opacity-30 disabled:cursor-not-allowed text-[1.2rem] leading-none" :disabled="modelValue === 1" @click="changePage(1)">«</button>
      <button class="flex items-center justify-center min-w-[32px] h-[32px] px-2 border border-transparent rounded-full bg-transparent text-text-muted font-semibold cursor-pointer transition-all hover:not(:disabled):bg-white/5 hover:not(:disabled):text-text disabled:opacity-30 disabled:cursor-not-allowed text-[1.2rem] leading-none" :disabled="modelValue === 1" @click="changePage(modelValue - 1)">‹</button>
      
      <button 
        v-for="(page, idx) in pages" 
        :key="idx" 
        :class="[
          'flex items-center justify-center min-w-[32px] h-[32px] px-2 border border-transparent rounded-full font-semibold transition-all',
          page === modelValue ? 'bg-primary text-bg' : 'bg-transparent text-text-muted',
          page === '...' ? 'cursor-default' : 'cursor-pointer hover:not(:disabled):bg-white/5 hover:not(:disabled):text-text disabled:opacity-30 disabled:cursor-not-allowed'
        ]"
        :disabled="page === '...'"
        @click="changePage(page)"
      >
        {{ page }}
      </button>

      <button class="flex items-center justify-center min-w-[32px] h-[32px] px-2 border border-transparent rounded-full bg-transparent text-text-muted font-semibold cursor-pointer transition-all hover:not(:disabled):bg-white/5 hover:not(:disabled):text-text disabled:opacity-30 disabled:cursor-not-allowed text-[1.2rem] leading-none" :disabled="modelValue === totalPages" @click="changePage(modelValue + 1)">›</button>
      <button class="flex items-center justify-center min-w-[32px] h-[32px] px-2 border border-transparent rounded-full bg-transparent text-text-muted font-semibold cursor-pointer transition-all hover:not(:disabled):bg-white/5 hover:not(:disabled):text-text disabled:opacity-30 disabled:cursor-not-allowed text-[1.2rem] leading-none" :disabled="modelValue === totalPages" @click="changePage(totalPages)">»</button>
    </div>
  </div>
</template>

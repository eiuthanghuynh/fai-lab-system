<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CustomDropdown from '@/components/CustomDropdown.vue';

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
  <div class="pagination-container">
    <div class="pagination-left">
      <span class="rows-label">{{ t('pagination.rows_per_page') }}</span>
      <CustomDropdown 
        class="pagination-dropdown"
        :modelValue="rowsPerPage"
        :options="dropdownOptions"
        direction="up"
        @update:modelValue="onRowsPerPageChange"
      />
      <span v-if="t('pagination.of_rows', { total })" class="total-label">{{ t('pagination.of_rows', { total }) }}</span>
    </div>

    <div class="pagination-right">
      <button class="page-btn nav-btn" :disabled="modelValue === 1" @click="changePage(1)">«</button>
      <button class="page-btn nav-btn" :disabled="modelValue === 1" @click="changePage(modelValue - 1)">‹</button>
      
      <button 
        v-for="(page, idx) in pages" 
        :key="idx" 
        class="page-btn" 
        :class="{ active: page === modelValue, dots: page === '...' }"
        :disabled="page === '...'"
        @click="changePage(page)"
      >
        {{ page }}
      </button>

      <button class="page-btn nav-btn" :disabled="modelValue === totalPages" @click="changePage(modelValue + 1)">›</button>
      <button class="page-btn nav-btn" :disabled="modelValue === totalPages" @click="changePage(totalPages)">»</button>
    </div>
  </div>
</template>

<style scoped>
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  border-radius: 0 0 8px 8px;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.pagination-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rows-label {
  font-weight: 500;
  color: var(--color-text-muted);
}

:deep(.pagination-dropdown .dropdown-trigger) {
  height: 32px;
  padding: 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
}

:deep(.pagination-dropdown .options-list li) {
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
}

.total-label {
  font-weight: 500;
  color: var(--color-text-muted);
}

.pagination-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 0.5rem;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled):not(.dots) {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text);
}

.page-btn.active {
  background: var(--color-primary);
  color: var(--color-bg);
}

.page-btn.dots {
  cursor: default;
  background: transparent;
}

.page-btn:disabled:not(.dots) {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn {
  font-size: 1.2rem;
  line-height: 1;
}
</style>

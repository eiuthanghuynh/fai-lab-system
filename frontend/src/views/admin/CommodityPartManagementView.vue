<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import ConfirmModal from '@/components/ConfirmModal.vue';
import Pagination from '@/components/Pagination.vue';

// Refactored Common Components
import BaseModal from '@/components/common/BaseModal.vue';
import DataTableToolbar from '@/components/common/DataTableToolbar.vue';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import { useDataTable } from '@/composables/useDataTable';
import { toast } from 'vue-sonner';

const { t } = useI18n();
const { page, limit, sortBy, sortDesc, searchQuery, toggleSort } = useDataTable('id', false);

const items = ref<any[]>([]);
const totalItems = ref(0);
const isLoading = ref(false);

const isModalOpen = ref(false);
const isEditing = ref(false);

const confirmModalState = ref({
  isOpen: false,
  message: '',
  isDanger: false,
  onConfirm: () => {}
});

const formData = ref({
  id: 0,
  name: ''
});

const columns = computed<DataTableColumn[]>(() => [
  { key: 'id', label: t('table.id', 'ID'), sortable: true, sticky: 'left', width: '80px' },
  { key: 'name', label: t('form.name', 'Name'), sortable: true, sticky: 'left', minWidth: '150px' },
  { key: 'actions', label: t('admin.actions', 'Actions'), sticky: 'right', minWidth: '150px', width: '150px' }
]);

watch([searchQuery, page, limit, sortBy, sortDesc], () => {
  fetchItems();
}, { deep: true });

const fetchItems = async () => {
  isLoading.value = true;
  try {
    const params: any = {
      page: page.value,
      limit: limit.value,
      sort_by: sortBy.value,
      sort_desc: sortDesc.value
    };
    if (searchQuery.value) params.search = searchQuery.value;

    const res = await api.get(`/commodity-parts`, { params });
    items.value = res.data?.data || (Array.isArray(res.data) ? res.data : []);
    totalItems.value = res.data?.total || (res.data?.data ? res.data.data.length : 0);
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchItems();
});

const openModal = (item: any = null) => {
  if (item) {
    isEditing.value = true;
    formData.value = { 
      id: item.id,
      name: item.name
    };
  } else {
    isEditing.value = false;
    formData.value = {
      id: 0,
      name: ''
    };
  }
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const saveItem = async () => {
  try {
    if (isEditing.value) {
      await api.put(`/commodity-parts/${formData.value.id}`, formData.value);
      toast.success(t('toast.edit_success', 'Updated successfully'));
    } else {
      await api.post('/commodity-parts', formData.value);
      toast.success(t('toast.create_success', 'Created successfully'));
    }
    closeModal();
    fetchItems();
  } catch (err) {
    console.error(err);
    toast.error(t('toast.action_failed', 'Action failed'));
  }
};

const deleteItem = async (item: any) => {
  confirmModalState.value = {
    isOpen: true,
    message: t('common.delete_confirm', 'Are you sure you want to delete this item?'),
    isDanger: true,
    onConfirm: async () => {
      try {
        await api.delete(`/commodity-parts/${item.id}`);
        toast.success(t('toast.delete_success', 'Deleted successfully'));
        fetchItems();
      } catch (err) {
        console.error(err);
        toast.error(t('toast.action_failed', 'Action failed'));
      } finally {
        confirmModalState.value.isOpen = false;
      }
    }
  };
};
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('admin.commodity_parts', 'Commodity Parts') }}</h1>
    </div>

    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('action.search', 'Search...')"
    >
      <template #actions>
        <button class="pill-btn btn-primary" @click="openModal(null)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          {{ t('action.add', 'Add') }}
        </button>
      </template>
    </DataTableToolbar>

    <div class="table-wrapper">
      <DataTable 
        :columns="columns" 
        :data="items" 
        :isLoading="isLoading"
        rowKey="id"
        :sortBy="sortBy"
        :sortDesc="sortDesc"
        @sort="toggleSort"
      >
        <template #cell-actions="{ item }">
          <div class="action-buttons">
            <button class="btn-sm btn-edit" @click="openModal(item)">{{ t('action.edit', 'Edit') }}</button>
            <button class="btn-sm btn-danger" @click="deleteItem(item)">
              {{ t('action.delete', 'Delete') }}
            </button>
          </div>
        </template>
      </DataTable>
    </div>
    
    <Pagination :total="totalItems" v-model="page" v-model:rowsPerPage="limit" />

    <BaseModal :isOpen="isModalOpen" :title="isEditing ? t('action.edit', 'Edit') : t('action.add', 'Add')" maxWidth="600px" @close="closeModal">
      <form id="itemForm" @submit.prevent="saveItem" class="form-layout-5050">
        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.name', 'Name') }}</label>
              <span class="tag-required">{{ t('form.required', 'Required') }}</span>
            </div>
          </div>
          <div class="form-col-right">
            <input type="text" v-model="formData.name" required />
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-cancel" @click="closeModal">{{ t('action.cancel', 'Cancel') }}</button>
        <button type="submit" form="itemForm" class="btn-primary">{{ t('action.save', 'Save') }}</button>
      </template>
    </BaseModal>

    <ConfirmModal :is-open="confirmModalState.isOpen" :message="confirmModalState.message" :is-danger="confirmModalState.isDanger" @confirm="confirmModalState.onConfirm" @cancel="confirmModalState.isOpen = false" />
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
  padding: 2rem;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.table-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-edit {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
  border-color: var(--color-border);
}

.btn-danger {
  background: rgba(255, 85, 85, 0.1);
  color: #ff5555;
  border-color: #ff5555;
}

.form-layout-5050 {
  display: flex;
  flex-direction: column;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 2rem;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--color-border);
  align-items: center;
}

.form-row:first-child {
  padding-top: 0;
  border-bottom: none;
}

.form-col-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-col-right {
  display: flex;
  flex-direction: column;
}

.label-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.label-header label {
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.tag-required {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  background-color: rgba(99, 224, 121, 0.15);
  color: var(--color-primary);
  border-radius: 4px;
  font-weight: 600;
  line-height: 1;
}

.form-col-right input[type="text"] {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 4px;
  transition: border-color 0.2s;
  outline: none;
}

.form-col-right input[type="text"]:focus {
  border-color: var(--color-primary);
}

.btn-cancel {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.pill-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  height: 44px;
  font-size: 1rem;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-bg);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}
.pill-btn.btn-primary {
  border-radius: 20px;
}
.btn-primary:hover {
  filter: brightness(0.9);
}
</style>

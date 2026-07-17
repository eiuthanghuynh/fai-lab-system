<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAsyncState } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import ConfirmModal from '@/components/ConfirmModal.vue';
import Pagination from '@/components/Pagination.vue';

// Refactored Common Components
import BaseModal from '@/components/common/BaseModal.vue';
import DataTableToolbar from '@/components/common/DataTableToolbar.vue';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import { useDataTable } from '@/composables/useDataTable';
import { toast } from 'vue-sonner';

const { t } = useI18n();
const { page, limit, sortBy, sortDesc, searchQuery, toggleSort } = useDataTable('id', false);

const items = ref<any[]>([]);
const totalItems = ref(0);


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

const { isLoading, execute: fetchItems } = useAsyncState(async () => {
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
}, null, { immediate: false, resetOnExecute: false });

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
  <div class="flex flex-col gap-6 h-full p-8 overflow-hidden">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl">{{ t('admin.commodity_parts', 'Commodity Parts') }}</h1>
    </div>

    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('action.search', 'Search...')"
    >
      <template #actions>
        <Button class="gap-2" @click="openModal(null)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          {{ t('action.add', 'Add') }}
        </Button>
      </template>
    </DataTableToolbar>

    <div class="flex-1 overflow-hidden flex flex-col">
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
          <div class="flex gap-2">
            <Button variant="secondary" size="sm" @click="openModal(item)">{{ t('action.edit', 'Edit') }}</Button>
            <Button variant="danger" size="sm" @click="deleteItem(item)">
              {{ t('action.delete', 'Delete') }}
            </Button>
          </div>
        </template>
      </DataTable>
    </div>
    
    <Pagination :total="totalItems" v-model="page" v-model:rowsPerPage="limit" />

    <BaseModal :isOpen="isModalOpen" :title="isEditing ? t('action.edit', 'Edit') : t('action.add', 'Add')" maxWidth="600px" @close="closeModal">
      <form id="itemForm" @submit.prevent="saveItem" class="flex flex-col gap-4">
        <div class="grid grid-cols-[1fr_2fr] gap-8 items-center">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text">{{ t('form.name', 'Name') }}</label>
              <span class="text-[0.7rem] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold leading-none">{{ t('form.required', 'Required') }}</span>
            </div>
          </div>
          <div class="flex flex-col">
            <Input v-model="formData.name" required />
          </div>
        </div>
      </form>
      <template #footer>
        <Button variant="secondary" @click="closeModal">{{ t('action.cancel', 'Cancel') }}</Button>
        <Button type="submit" form="itemForm">{{ t('action.save', 'Save') }}</Button>
      </template>
    </BaseModal>

    <ConfirmModal :is-open="confirmModalState.isOpen" :message="confirmModalState.message" :is-danger="confirmModalState.isDanger" @confirm="confirmModalState.onConfirm" @cancel="confirmModalState.isOpen = false" />
  </div>
</template>



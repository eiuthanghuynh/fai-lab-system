<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAsyncState } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import { getContrastColor } from '../../utils/color';
import api from '@/services/api';
import ConfirmModal from '@/components/ConfirmModal.vue';
import Pagination from '@/components/Pagination.vue';

// Refactored Common Components
import BaseModal from '@/components/common/BaseModal.vue';
import DataTableToolbar from '@/components/common/DataTableToolbar.vue';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';
import ActionDropdown from '@/components/common/ActionDropdown.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import { useDataTable } from '@/composables/useDataTable';
import { toast } from 'vue-sonner';

const { t } = useI18n();
const { page, limit, sortBy, sortDesc, searchQuery, toggleSort } = useDataTable('id', false);

const roles = ref<any[]>([]);
const totalRoles = ref(0);
const allPermissions = ref<any[]>([]);


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
  name: '',
  description: '',
  badge_color: '#63e079',
  permission_ids: [] as number[]
});



const columns = computed<DataTableColumn[]>(() => [
  { key: 'id', label: t('table.id'), sortable: true, sticky: 'left', width: '60px' },
  { key: 'name', label: t('form.name'), sortable: true, sticky: 'left', minWidth: '150px' },
  { key: 'description', label: t('table.description'), minWidth: '200px' },
  { key: 'badge_color', label: t('table.badge_color'), minWidth: '100px' },
  { key: 'permissions', label: t('table.permissions'), minWidth: '300px' },
  { key: 'status', label: t('table.status'), sortable: true, sticky: 'right', minWidth: '170px', width: '170px' },
  { key: 'actions', label: t('admin.actions'), sticky: 'right', minWidth: '120px', width: '120px', align: 'center' }
]);

const filterPermissionIds = ref<number[]>([]);
const filterStatus = ref('');

const statusOptions = computed(() => [
  { value: '', label: t('filter.status_all') },
  { value: 'true', label: t('status.active') },
  { value: 'false', label: t('status.inactive') }
]);

const permissionOptions = computed(() => {
  return allPermissions.value.map((p: any) => ({
    value: p.id,
    label: p.name
  }));
});

watch([searchQuery, page, limit, sortBy, sortDesc, filterPermissionIds, filterStatus], () => {
  fetchRoles();
}, { deep: true });

const resetFilters = () => {
  searchQuery.value = '';
  filterPermissionIds.value = [];
  filterStatus.value = '';
  sortBy.value = 'id';
  sortDesc.value = false;
};

const { isLoading, execute: fetchRoles } = useAsyncState(async () => {
  const params = new URLSearchParams({
    page: page.value.toString(),
    limit: limit.value.toString(),
    sort_by: sortBy.value,
    sort_desc: sortDesc.value.toString()
  });
  if (searchQuery.value) params.append('search', searchQuery.value);
  if (filterStatus.value !== '') params.append('is_active', filterStatus.value);
  if (filterPermissionIds.value.length > 0) {
    params.append('permission_ids', filterPermissionIds.value.join(','));
  }

  const res = await api.get(`/roles?${params.toString()}`);
  roles.value = res.data?.data || (Array.isArray(res.data) ? res.data : []);
  totalRoles.value = res.data?.total || (Array.isArray(res.data) ? res.data.length : 0);
}, null, { immediate: false });

const fetchPermissions = async () => {
  try {
    const res = await api.get('/roles/permissions');
    allPermissions.value = res.data;
  } catch (err) {
    console.error(err);
  }
};

onMounted(() => {
  fetchRoles();
  fetchPermissions();
});

const openModal = (role: any = null) => {
  if (role) {
    isEditing.value = true;
    formData.value = { 
      id: role.id,
      name: role.name,
      description: role.description || '',
      badge_color: role.badge_color || '#63e079',
      permission_ids: role.permissions.map((p: any) => p.permission_id)
    };
  } else {
    isEditing.value = false;
    formData.value = {
      id: 0,
      name: '',
      description: '',
      badge_color: '#63e079',
      permission_ids: []
    };
  }
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const saveRole = async () => {
  try {
    if (isEditing.value) {
      await api.put(`/roles/${formData.value.id}`, formData.value);
      toast.success(t('toast.edit_success'));
    } else {
      await api.post('/roles', formData.value);
      toast.success(t('toast.create_success'));
    }
    closeModal();
    fetchRoles();
  } catch (err) {
    console.error(err);
    toast.error(t('toast.action_failed'));
  }
};

const toggleActive = async (role: any) => {
  try {
    if (role.is_active) {
      confirmModalState.value = {
        isOpen: true,
        message: t('common.delete_confirm'),
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete(`/roles/${role.id}`);
            toast.success(t('toast.delete_success'));
            fetchRoles();
          } catch (err) {
            console.error(err);
            toast.error(t('toast.action_failed'));
          } finally {
            confirmModalState.value.isOpen = false;
          }
        }
      };
    } else {
      await api.patch(`/roles/${role.id}/restore`);
      toast.success(t('toast.restore_success'));
      fetchRoles();
    }
  } catch (err) {
    console.error(err);
    toast.error(t('toast.action_failed'));
  }
};


</script>

<template>
  <div class="flex flex-col gap-6 h-full p-8 overflow-hidden">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl">{{ t('admin.roles') }}</h1>
    </div>

    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('action.search_roles')"
    >
      <template #filters>
        <div class="w-64">
          <MultiSelectDropdown 
            v-model="filterPermissionIds" 
            :options="permissionOptions" 
            :placeholder="t('form.permissions')"
          />
        </div>

        <div class="w-48">
          <SingleSelectDropdown 
            v-model="filterStatus" 
            :options="statusOptions" 
            :placeholder="t('filter.status_all')" 
          />
        </div>

        <Button variant="secondary" @click="resetFilters" class="px-3 gap-2" :title="t('action.reset')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          {{ t('action.reset') }}
        </Button>
      </template>

      <template #actions>
        <Button class="gap-2" @click="openModal(null)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          {{ t('admin.create_role') }}
        </Button>
      </template>
    </DataTableToolbar>

    <div class="flex-1 overflow-hidden flex flex-col">
      <DataTable 
        :columns="columns" 
        :data="roles" 
        :isLoading="isLoading"
        rowKey="id"
        :sortBy="sortBy"
        :sortDesc="sortDesc"
        @sort="toggleSort"
      >
        <template #cell-name="{ item }">
          <span class="inline-block whitespace-nowrap px-2 py-1 rounded-full text-xs font-bold" :style="{ backgroundColor: item.badge_color || '#63e079', color: getContrastColor(item.badge_color || '#63e079') }">
            {{ item.name }}
          </span>
        </template>
        <template #cell-permissions="{ item }">
          <div class="flex flex-wrap gap-1">
            <span v-for="p in item.permissions" :key="p.permission_id" class="bg-white/10 text-text-muted text-xs px-2 py-0.5 rounded">
              {{ p.permission.name }}
            </span>
          </div>
        </template>
        <template #cell-status="{ item }">
          <StatusBadge :isActive="item.is_active" :activeText="t('status.active')" :inactiveText="t('status.inactive')" />
        </template>
        <template #cell-actions="{ item }">
          <div class="flex justify-center w-full">
            <ActionDropdown>
              <button 
                @click="openModal(item)"
                class="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-primary transition-colors"
              >
                {{ t('admin.edit_role') }}
              </button>
              <div class="h-px bg-border my-1"></div>
              <button 
                @click="toggleActive(item)"
                class="w-full text-left px-4 py-2 text-sm font-medium transition-colors"
                :class="item.is_active ? 'text-danger hover:bg-red-50 hover:text-red-700' : 'text-primary hover:bg-bg hover:text-primary-dark'"
              >
                {{ item.is_active ? t('admin.delete_role') : t('admin.restore_role') }}
              </button>
            </ActionDropdown>
          </div>
        </template>
      </DataTable>
    </div>
    
    <Pagination :total="totalRoles" v-model="page" v-model:rowsPerPage="limit" />

    <BaseModal :isOpen="isModalOpen" :title="isEditing ? t('admin.edit_role') : t('admin.create_role')" maxWidth="690px" @close="closeModal">
      <form id="roleForm" @submit.prevent="saveRole" class="flex flex-col">
        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.name') }}</label>
              <span class="text-[0.7rem] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold leading-none">{{ t('form.required') }}</span>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">{{ t('form.role_name_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <Input v-model="formData.name" required />
          </div>
        </div>
        
        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.description') }}</label>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">{{ t('form.role_desc_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <Input v-model="formData.description" />
          </div>
        </div>
        
        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.badge_color') }}</label>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">{{ t('form.badge_color_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <input type="color" v-model="formData.badge_color" class="w-full h-11 p-1 bg-bg border border-border rounded cursor-pointer" />
          </div>
        </div>
        
        <div class="py-5 flex flex-col gap-2">
          <div class="flex items-center mb-2">
            <label class="font-semibold text-text m-0">{{ t('form.permissions') }}</label>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-5 border border-border rounded-lg bg-bg max-h-[250px] overflow-y-auto">
            <Checkbox 
              v-for="perm in allPermissions" 
              :key="perm.id"
              v-model="formData.permission_ids"
              :value="perm.id"
              :label="perm.name"
              class="!px-2 !py-1.5 hover:bg-white/5 transition-colors rounded"
            />
          </div>
        </div>
      </form>
      <template #footer>
        <Button variant="secondary" @click="closeModal">{{ t('action.cancel') }}</Button>
        <Button type="submit" form="roleForm">{{ t('action.save') }}</Button>
      </template>
    </BaseModal>

    <ConfirmModal :is-open="confirmModalState.isOpen" :message="confirmModalState.message" :is-danger="confirmModalState.isDanger" @confirm="confirmModalState.onConfirm" @cancel="confirmModalState.isOpen = false" />
  </div>
</template>



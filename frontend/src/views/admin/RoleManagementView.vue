<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
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
import CustomDropdown from '@/components/CustomDropdown.vue';
import { useDataTable } from '@/composables/useDataTable';
import { toast } from 'vue-sonner';

const { t } = useI18n();
const { page, limit, sortBy, sortDesc, searchQuery, toggleSort } = useDataTable('id', false);

const roles = ref<any[]>([]);
const totalRoles = ref(0);
const allPermissions = ref<any[]>([]);
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
  { key: 'actions', label: t('admin.actions'), sticky: 'right', minWidth: '200px', width: '200px' }
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

const fetchRoles = async () => {
  isLoading.value = true;
  try {
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
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

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

const togglePermission = (permId: number) => {
  const index = formData.value.permission_ids.indexOf(permId);
  if (index === -1) {
    formData.value.permission_ids.push(permId);
  } else {
    formData.value.permission_ids.splice(index, 1);
  }
};
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('admin.roles') }}</h1>
    </div>

    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('action.search_roles')"
    >
      <template #filters>
        <CustomDropdown 
          :v-model="filterPermissionIds" 
          :options="permissionOptions" 
          :placeholder="t('form.permissions')"
          :multiple="true"
          :rows="5"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </template>
        </CustomDropdown>

        <CustomDropdown v-model="filterStatus" :options="statusOptions" :placeholder="t('filter.status_all')">
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
          </template>
        </CustomDropdown>

        <button class="pill-btn btn-secondary" @click="resetFilters" style="padding: 0.5rem 0.75rem;" :title="t('action.reset')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          {{ t('action.reset') }}
        </button>
      </template>

      <template #actions>
        <button class="pill-btn btn-primary" @click="openModal(null)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          {{ t('admin.create_role') }}
        </button>
      </template>
    </DataTableToolbar>

    <div class="table-wrapper">
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
          <span class="badge" :style="{ backgroundColor: item.badge_color || '#63e079', color: getContrastColor(item.badge_color || '#63e079') }">
            {{ item.name }}
          </span>
        </template>
        <template #cell-permissions="{ item }">
          <div class="perm-list">
            <span v-for="p in item.permissions" :key="p.permission_id" class="perm-tag">
              {{ p.permission.name }}
            </span>
          </div>
        </template>
        <template #cell-status="{ item }">
          <StatusBadge :isActive="item.is_active" :activeText="t('status.active')" :inactiveText="t('status.inactive')" />
        </template>
        <template #cell-actions="{ item }">
          <div class="action-buttons">
            <button class="btn-sm btn-edit" @click="openModal(item)">{{ t('admin.edit_role') }}</button>
            <button class="btn-sm" :class="item.is_active ? 'btn-danger' : 'btn-success'" @click="toggleActive(item)">
              {{ item.is_active ? t('admin.delete_role') : t('admin.restore_role') }}
            </button>
          </div>
        </template>
      </DataTable>
    </div>
    
    <Pagination :total="totalRoles" v-model="page" v-model:rowsPerPage="limit" />

    <BaseModal :isOpen="isModalOpen" :title="isEditing ? t('admin.edit_role') : t('admin.create_role')" maxWidth="690px" @close="closeModal">
      <form id="roleForm" @submit.prevent="saveRole" class="form-layout-5050">
        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.name') }}</label>
              <span class="tag-required">{{ t('form.required') }}</span>
            </div>
            <p class="field-desc">{{ t('form.role_name_desc') }}</p>
          </div>
          <div class="form-col-right">
            <input type="text" v-model="formData.name" required />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.description') }}</label>
            </div>
            <p class="field-desc">{{ t('form.role_desc_desc') }}</p>
          </div>
          <div class="form-col-right">
            <input type="text" v-model="formData.description" />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.badge_color') }}</label>
            </div>
            <p class="field-desc">{{ t('form.badge_color_desc') }}</p>
          </div>
          <div class="form-col-right">
            <input type="color" v-model="formData.badge_color" class="color-picker-input" />
          </div>
        </div>
        
        <div class="form-row-full">
          <div class="label-header mb-2">
            <label>{{ t('form.permissions') }}</label>
          </div>
          <div class="perm-grid-box">
            <label v-for="perm in allPermissions" :key="perm.id" class="perm-checkbox-item">
              <input 
                type="checkbox" 
                :checked="formData.permission_ids.includes(perm.id)"
                @change="togglePermission(perm.id)"
              />
              <span class="perm-name">{{ perm.name }}</span>
            </label>
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-cancel" @click="closeModal">{{ t('action.cancel') }}</button>
        <button type="submit" form="roleForm" class="btn-primary">{{ t('action.save') }}</button>
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

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #000;
  display: inline-block;
  white-space: nowrap;
}

.perm-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.perm-tag {
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  color: var(--color-text-muted);
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

.btn-success {
  background: rgba(99, 224, 121, 0.1);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.form-layout-5050 {
  display: flex;
  flex-direction: column;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 2rem;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--color-border);
  align-items: center;
}

.form-row:first-child {
  padding-top: 0;
}

.form-row-full {
  padding: 1.25rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.field-desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.4;
}

.mb-2 {
  margin-bottom: 0.5rem;
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

.color-picker-input {
  width: 100%;
  height: 44px;
  padding: 0.25rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
}

.perm-grid-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  max-height: 250px;
  overflow-y: auto;
}

.perm-checkbox-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--color-text);
  padding: 0.25rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.perm-checkbox-item:hover {
  background: rgba(128,128,128,0.1);
}

.perm-checkbox-item input[type="checkbox"] {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin-top: 0.1rem;
}

.perm-name {
  line-height: 1.4;
}

.btn-cancel {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

</style>

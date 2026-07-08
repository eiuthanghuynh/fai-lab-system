<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getContrastColor } from '../../utils/color';
import api from '@/services/api';
import ConfirmModal from '@/components/ConfirmModal.vue';
import Pagination from '@/components/Pagination.vue';
import CustomDropdown from '@/components/CustomDropdown.vue';

// Refactored Common Components
import BaseModal from '@/components/common/BaseModal.vue';
import DataTableToolbar from '@/components/common/DataTableToolbar.vue';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import RoleBadgeList from '@/components/common/RoleBadgeList.vue';
import { useDataTable } from '@/composables/useDataTable';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'vue-sonner';

const authStore = useAuthStore();
const { t } = useI18n();
const { page, limit, sortBy, sortDesc, searchQuery, toggleSort } = useDataTable('id', false);

const users = ref<any[]>([]);
const totalUsers = ref(0);
const roles = ref<any[]>([]);
const isLoading = ref(false);

const isModalOpen = ref(false);
const isEditing = ref(false);

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const passwordError = computed(() => {
  if (isEditing.value && !formData.value.password) return false;
  if (!formData.value.password) return false;
  return !passwordRegex.test(formData.value.password);
});

const confirmModalState = ref({
  isOpen: false,
  message: '',
  isDanger: false,
  onConfirm: () => {}
});

const formData = ref({
  id: 0,
  username: '',
  password: '',
  email: '',
  full_name: '',
  employee_id: '',
  department: '',
  role_ids: [] as number[]
});

const filterRoleIds = ref<number[]>([]);
const filterStatus = ref('');
const filterDateType = ref('created_at');
const filterStartDate = ref('');
const filterEndDate = ref('');



const columns = computed<DataTableColumn[]>(() => [
  { key: 'id', label: t('user.id'), sortable: true, sticky: 'left', width: '60px' },
  { key: 'username', label: t('user.username'), sortable: true, sticky: 'left', minWidth: '120px', width: '120px' },
  { key: 'full_name', label: t('user.full_name'), sortable: true, sticky: 'left', minWidth: '200px', width: '200px' },
  { key: 'role', label: t('user.role'), sticky: 'left', minWidth: '180px', width: '180px' },
  { key: 'employee_id', label: t('user.employee_id'), minWidth: '120px' },
  { key: 'email', label: t('user.email'), minWidth: '150px' },
  { key: 'department', label: t('user.department'), sortable: true, minWidth: '130px' },
  { key: 'created_at', label: t('filter.created_date'), sortable: true, minWidth: '150px' },
  { key: 'updated_at', label: t('filter.updated_date'), sortable: true, minWidth: '150px' },
  { key: 'status', label: t('user.status'), sortable: true, sticky: 'right', minWidth: '170px', width: '170px' },
  { key: 'actions', label: t('user.actions'), sticky: 'right', minWidth: '260px', width: '260px' }
]);

// Dropdown options
const roleOptions = computed(() => [
  ...roles.value.map(r => ({ value: r.id, label: r.name }))
]);

const statusOptions = computed(() => [
  { value: '', label: t('filter.status_all') },
  { value: 'true', label: t('status.active') },
  { value: 'false', label: t('status.inactive') }
]);

const dateTypeOptions = computed(() => [
  { value: 'created_at', label: t('filter.created_date') },
  { value: 'updated_at', label: t('filter.updated_date') }
]);

watch([searchQuery, page, limit, sortBy, sortDesc, filterRoleIds, filterStatus], () => {
  fetchUsers();
}, { deep: true });

watch([filterStartDate, filterEndDate], () => {
  if (
    (filterStartDate.value && filterEndDate.value) || 
    (!filterStartDate.value && !filterEndDate.value)
  ) {
    fetchUsers();
  }
});

const resetFilters = () => {
  searchQuery.value = '';
  filterRoleIds.value = [];
  filterStatus.value = '';
  filterStartDate.value = '';
  filterEndDate.value = '';
  filterDateType.value = '';
  sortBy.value = 'id';
  sortDesc.value = false;
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fetchUsers = async () => {
  isLoading.value = true;
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: limit.value.toString(),
      sort_by: sortBy.value,
      sort_desc: sortDesc.value.toString()
    });

    if (searchQuery.value) params.append('search', searchQuery.value);
    if (filterRoleIds.value.length > 0) params.append('role_ids', filterRoleIds.value.join(','));
    if (filterStatus.value !== '') params.append('is_active', filterStatus.value);
    if (filterStartDate.value) params.append('start_date', filterStartDate.value);
    if (filterEndDate.value) params.append('end_date', filterEndDate.value);
    if (filterDateType.value) params.append('date_type', filterDateType.value);

    const res = await api.get(`/users?${params.toString()}`);
    users.value = res.data?.data || (Array.isArray(res.data) ? res.data : []);
    totalUsers.value = res.data?.total || (Array.isArray(res.data) ? res.data.length : 0);
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

const fetchRoles = async () => {
  try {
    const res = await api.get('/roles');
    const allRoles = res.data?.data || (Array.isArray(res.data) ? res.data : []);
    roles.value = allRoles.filter((r: any) => r.is_active);
  } catch (err) {
    console.error(err);
  }
};

onMounted(() => {
  fetchUsers();
  fetchRoles();
});

const openModal = (user: any = null) => {
  if (user) {
    isEditing.value = true;
    formData.value = { ...user, password: '', role_ids: user.roles ? user.roles.map((r: any) => r.id) : [] };
  } else {
    isEditing.value = false;
    formData.value = { id: 0, username: '', password: '', email: '', full_name: '', employee_id: '', department: '', role_ids: [] };
  }
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const saveUser = async () => {
  if (passwordError.value) return;

  if (!formData.value.role_ids || formData.value.role_ids.length === 0) {
    confirmModalState.value = {
      isOpen: true,
      message: t('error.role_required') || 'Vui lòng chọn ít nhất 1 quyền (Role).',
      isDanger: true,
      onConfirm: () => { confirmModalState.value.isOpen = false; },
      hideCancel: true
    };
    return;
  }

  try {
    if (isEditing.value) {
      await api.put(`/users/${formData.value.id}`, formData.value);
      if (formData.value.id === authStore.user?.id) {
        await authStore.autoLogin();
      }
      toast.success(t('toast.edit_success'));
    } else {
      await api.post('/users', formData.value);
      toast.success(t('toast.create_success'));
    }
    closeModal();
    fetchUsers();
  } catch (err: any) {
    console.error(err);
    let errorCode = err.response?.data?.error || 'save_failed';
    // If backend returns a string with spaces or unmapped error, fallback to save_failed
    if (!['password_format', 'username_exists', 'email_exists', 'employee_id_exists'].includes(errorCode)) {
      errorCode = 'save_failed';
    }
    const message = t(`error.${errorCode}`);
    toast.error(message);
  }
};

const toggleActive = async (user: any) => {
  try {
    if (user.is_active) {
      confirmModalState.value = {
        isOpen: true, message: t('common.delete_confirm'), isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete(`/users/${user.id}`);
            toast.success(t('toast.delete_success'));
            fetchUsers();
          } catch (err) {
            console.error(err);
            toast.error(t('toast.action_failed'));
          } finally {
            confirmModalState.value.isOpen = false;
          }
        }
      };
    } else {
      await api.patch(`/users/${user.id}/restore`);
      toast.success(t('toast.restore_success'));
      fetchUsers();
    }
  } catch (err) {
    console.error(err);
    toast.error(t('toast.action_failed'));
  }
};
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('admin.users') }}</h1>
    </div>

    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('action.search_users')"
    >
      <template #filters>
        <CustomDropdown multiple :rows="5" v-model="filterRoleIds" :options="roleOptions" :placeholder="t('filter.role_all')">
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </template>
        </CustomDropdown>

        <CustomDropdown v-model="filterStatus" :options="statusOptions" :placeholder="t('filter.status_all')">
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
          </template>
        </CustomDropdown>

        <div class="pill-select-wrapper date-filter-wrapper">
          <CustomDropdown v-model="filterDateType" :options="dateTypeOptions" :placeholder="t('filter.created_date')">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </template>
          </CustomDropdown>
          <input type="date" v-model="filterStartDate" class="pill-date" title="Start Date" />
          <span style="color: var(--color-text-muted); font-size: 1rem;">-</span>
          <input type="date" v-model="filterEndDate" class="pill-date" title="End Date" />
        </div>
        <button class="pill-btn btn-secondary" @click="resetFilters" style="padding: 0.5rem 0.75rem;" :title="t('action.reset')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          {{ t('action.reset') }}
        </button>
      </template>

      <template #actions>
        <button class="pill-btn btn-primary" @click="openModal(null)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          {{ t('admin.create_user') }}
        </button>
      </template>
    </DataTableToolbar>

    <div class="table-wrapper">
      <DataTable 
        :columns="columns" 
        :data="users" 
        :isLoading="isLoading"
        rowKey="id"
        :sortBy="sortBy"
        :sortDesc="sortDesc"
        @sort="toggleSort"
      >
        <template #cell-username="{ item }">
          <div class="wrap-text">{{ item.username }}</div>
        </template>
        <template #cell-full_name="{ item }">
          <div class="wrap-text">{{ item.full_name }}</div>
        </template>
        <template #cell-role="{ item }">
          <div style="display: flex; align-items: center; width: 100%; max-width: 180px;">
            <RoleBadgeList v-if="item.roles && item.roles.length > 0" :roles="item.roles" />
            <span v-else class="badge" style="background-color: #666; color: #fff;">
              No Role
            </span>
          </div>
        </template>
        <template #cell-department="{ item }">
          {{ item.department || '-' }}
        </template>
        <template #cell-created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>
        <template #cell-updated_at="{ item }">
          {{ formatDate(item.updated_at) }}
        </template>
        <template #cell-status="{ item }">
          <StatusBadge :isActive="item.is_active" :activeText="t('status.active')" :inactiveText="t('status.inactive')" />
        </template>
        <template #cell-actions="{ item }">
          <div class="action-buttons">
            <button class="btn-sm btn-edit" @click="openModal(item)">{{ t('admin.edit_user') }}</button>
            <button class="btn-sm" :class="item.is_active ? 'btn-danger' : 'btn-success'" @click="toggleActive(item)">
              {{ item.is_active ? t('admin.delete_user') : t('admin.restore_user') }}
            </button>
          </div>
        </template>
      </DataTable>
    </div>

    <Pagination :total="totalUsers" v-model="page" v-model:rowsPerPage="limit" />

    <BaseModal :isOpen="isModalOpen" :title="isEditing ? t('admin.edit_user') : t('admin.create_user')" maxWidth="690px" @close="closeModal">
      <form id="userForm" @submit.prevent="saveUser" class="form-layout-5050">
        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.username') }}</label>
              <span class="tag-required">{{ t('form.required') }}</span>
            </div>
            <p class="field-desc">{{ t('form.username_desc') }}</p>
          </div>
          <div class="form-col-right">
            <input type="text" v-model="formData.username" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.password') }}</label>
              <span v-if="!isEditing" class="tag-required">{{ t('form.required') }}</span>
            </div>
            <p class="field-desc">
              {{ t('form.password_desc') }}
              <span v-if="isEditing"><br/>{{ t('form.password_hint') }}</span>
            </p>
          </div>
          <div class="form-col-right">
            <input 
              type="password" 
              v-model="formData.password" 
              :required="!isEditing" 
              :class="{ 'input-error': passwordError }"
            />
            <p v-if="passwordError" class="field-desc error-text mt-1">{{ t('error.password_format') }}</p>
          </div>
        </div>

        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.full_name') }}</label>
              <span class="tag-required">{{ t('form.required') }}</span>
            </div>
            <p class="field-desc">{{ t('form.full_name_desc') }}</p>
          </div>
          <div class="form-col-right">
            <input type="text" v-model="formData.full_name" :placeholder="t('form.full_name_placeholder')" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.employee_id') }}</label>
              <span class="tag-required">{{ t('form.required') }}</span>
            </div>
            <p class="field-desc">{{ t('form.employee_id_desc') }}</p>
          </div>
          <div class="form-col-right">
            <input type="text" v-model="formData.employee_id" :placeholder="t('form.employee_id_placeholder')" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.email') }}</label>
              <span class="tag-required">{{ t('form.required') }}</span>
            </div>
            <p class="field-desc">{{ t('form.email_desc') }}</p>
          </div>
          <div class="form-col-right">
            <input type="email" v-model="formData.email" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.department') }}</label>
            </div>
            <p class="field-desc">{{ t('form.department_desc') }}</p>
          </div>
          <div class="form-col-right">
            <input type="text" v-model="formData.department" :placeholder="t('form.department_placeholder')" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('form.role') }}</label>
              <span class="tag-required">{{ t('form.required') }}</span>
            </div>
            <p class="field-desc">{{ t('form.role_desc') }}</p>
          </div>
          <div class="form-col-right">
            <CustomDropdown 
              multiple
              :rows="5"
              v-model="formData.role_ids" 
              :options="roles.map((r: any) => ({ value: r.id, label: r.name }))" 
              variant="form" 
            />
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-cancel" @click="closeModal">{{ t('action.cancel') }}</button>
        <button type="submit" form="userForm" class="btn-primary">{{ t('action.save') }}</button>
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

/* Specific styling for the buttons/badges remaining */
.wrap-text {
  white-space: normal;
  word-break: break-word;
  min-width: 150px;
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

.pill-select-wrapper {
  display: flex;
  align-items: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 0.25rem 0.5rem 0.25rem 1rem;
  gap: 0.5rem;
  height: 44px;
}

.pill-icon {
  color: var(--color-text-muted);
}

.date-filter-wrapper {
  gap: 0.5rem;
  padding-left: 0;
  border: none;
  background: transparent;
}

.pill-date {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  outline: none;
  color: var(--color-text);
  font-family: inherit;
  font-size: 1rem;
  cursor: pointer;
  height: 44px;
  padding: 0 1rem;
}
.pill-date::-webkit-calendar-picker-indicator {
  filter: invert(0.5);
  cursor: pointer;
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

.form-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.form-row:first-child {
  padding-top: 0;
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

.form-col-right input {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 4px;
  transition: border-color 0.2s;
  outline: none;
}

.form-col-right input:focus {
  border-color: var(--color-primary);
}

.form-col-right input.input-error {
  border-color: #ef4444;
}

.form-col-right input.input-error:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}

.error-text {
  color: #ef4444;
}

.mt-1 {
  margin-top: 0.25rem;
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

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAsyncState } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import { formatDate } from '@/utils/dateFormatter';
import api from '@/services/api';
import ConfirmModal from '@/components/ConfirmModal.vue';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import Pagination from '@/components/Pagination.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import RoleBadgeList from '@/components/common/RoleBadgeList.vue';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';
import ActionDropdown from '@/components/common/ActionDropdown.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import { useDataTable } from '@/composables/useDataTable';
import { useAuthStore } from '@/stores/auth';
import { useFormValidation } from '@/composables/useFormValidation';
import { toast } from 'vue-sonner';
import { z } from 'zod';

const authStore = useAuthStore();
const { t } = useI18n();
const { page, limit, sortBy, sortDesc, searchQuery, toggleSort } = useDataTable('id', false);

const users = ref<any[]>([]);
const totalUsers = ref(0);
const roles = ref<any[]>([]);


const isModalOpen = ref(false);
const isEditing = ref(false);

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const { formErrors, validate, setApiError, clearError, clearAllErrors } = useFormValidation();

const getUserSchema = () => z.object({
  username: z.string().min(1, 'form.required'),
  email: z.string().min(1, 'form.required').email('error.email_format'),
  full_name: z.string().min(1, 'form.required'),
  employee_id: z.string().min(1, 'form.required'),
  password: isEditing.value 
    ? z.union([z.string().regex(passwordRegex, 'error.password_format'), z.literal('')])
    : z.string().regex(passwordRegex, 'error.password_format'),
  role_ids: z.array(z.number()).min(1, 'error.role_required'),
  department: z.string().optional()
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
  { key: 'actions', label: t('user.actions'), sticky: 'right', minWidth: '120px', width: '120px', align: 'center' }
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


const { isLoading, execute: fetchUsers } = useAsyncState(async () => {
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
}, null, { immediate: false, resetOnExecute: false });

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
    formData.value = { ...user, department: user.department || '', password: '', role_ids: user.roles ? user.roles.map((r: any) => r.id) : [] };
  } else {
    isEditing.value = false;
    formData.value = { id: 0, username: '', password: '', email: '', full_name: '', employee_id: '', department: '', role_ids: [] };
  }
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  clearAllErrors();
};

const saveUser = async () => {
  const schema = getUserSchema();
  if (!validate(schema, formData.value)) {
    toast.error(t('error.validation_failed') || 'Vui lòng kiểm tra lại thông tin');
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
    const errorCode = err.response?.data?.error || 'save_failed';
    
    if (errorCode === 'username_exists') setApiError('username', 'error.username_exists');
    else if (errorCode === 'email_exists') setApiError('email', 'error.email_exists');
    else if (errorCode === 'employee_id_exists') setApiError('employee_id', 'error.employee_id_exists');
    else {
      toast.error(t(`error.${errorCode}`));
    }
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
  <div class="flex flex-col gap-6 h-full p-8 overflow-hidden">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl">{{ t('admin.users') }}</h1>
    </div>

    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('action.search_users')"
    >
      <template #filters>
        <div class="w-56">
          <MultiSelectDropdown v-model="filterRoleIds" :options="roleOptions" :placeholder="t('filter.role_all')" />
        </div>

        <div class="w-48">
          <SingleSelectDropdown v-model="filterStatus" :options="statusOptions" :placeholder="t('filter.status_all')" />
        </div>

        <div class="flex items-center gap-2">
          <div class="w-48">
            <SingleSelectDropdown v-model="filterDateType" :options="dateTypeOptions" :placeholder="t('filter.created_date')" />
          </div>
          <div class="w-40">
            <Input type="date" v-model="filterStartDate" class="[&_input::-webkit-calendar-picker-indicator]:invert-[0.5] [&_input::-webkit-calendar-picker-indicator]:cursor-pointer" title="Start Date" />
          </div>
          <span class="text-text-muted">-</span>
          <div class="w-40">
            <Input type="date" v-model="filterEndDate" class="[&_input::-webkit-calendar-picker-indicator]:invert-[0.5] [&_input::-webkit-calendar-picker-indicator]:cursor-pointer" title="End Date" />
          </div>
        </div>
        
        <Button variant="secondary" @click="resetFilters" class="px-3 gap-2" :title="t('action.reset')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          {{ t('action.reset') }}
        </Button>
      </template>

      <template #actions>
        <Button class="gap-2" @click="openModal(null)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          {{ t('admin.create_user') }}
        </Button>
      </template>
    </DataTableToolbar>

    <div class="flex-1 overflow-hidden flex flex-col">
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
          <div class="whitespace-normal break-words min-w-[150px]">{{ item.username }}</div>
        </template>
        <template #cell-full_name="{ item }">
          <div class="whitespace-normal break-words min-w-[150px]">{{ item.full_name }}</div>
        </template>
        <template #cell-role="{ item }">
          <div class="flex items-center w-full max-w-[180px]">
            <RoleBadgeList v-if="item.roles && item.roles.length > 0" :roles="item.roles" />
            <span v-else class="inline-block whitespace-nowrap px-2 py-1 rounded-full text-xs font-bold bg-[#666] text-white">
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
          <div class="flex justify-center w-full">
            <ActionDropdown>
              <button 
                @click="openModal(item)"
                class="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-primary transition-colors"
              >
                {{ t('admin.edit_user') }}
              </button>
              <div class="h-px bg-border my-1"></div>
              <button 
                @click="toggleActive(item)"
                class="w-full text-left px-4 py-2 text-sm font-medium transition-colors"
                :class="item.is_active ? 'text-danger hover:bg-red-50 hover:text-red-700' : 'text-primary hover:bg-bg hover:text-primary-dark'"
              >
                {{ item.is_active ? t('admin.delete_user') : t('admin.restore_user') }}
              </button>
            </ActionDropdown>
          </div>
        </template>
      </DataTable>
    </div>

    <Pagination :total="totalUsers" v-model="page" v-model:rowsPerPage="limit" />

    <BaseModal :isOpen="isModalOpen" :title="isEditing ? t('admin.edit_user') : t('admin.create_user')" maxWidth="690px" @close="closeModal">
      <form id="userForm" @submit.prevent="saveUser" class="flex flex-col">
        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.username') }}</label>
              <span class="text-[0.7rem] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold leading-none">{{ t('form.required') }}</span>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">{{ t('form.username_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <Input v-model="formData.username" :error="formErrors.username ? t(formErrors.username) : ''" @clear-error="clearError('username')" />
          </div>
        </div>

        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.password') }}</label>
              <span v-if="!isEditing" class="text-[0.7rem] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold leading-none">{{ t('form.required') }}</span>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">
              {{ t('form.password_desc') }}
              <span v-if="isEditing"><br/>{{ t('form.password_hint') }}</span>
            </p>
          </div>
          <div class="flex flex-col">
            <Input 
              type="password" 
              v-model="formData.password" 
              :error="formErrors.password ? t(formErrors.password) : ''" 
              @clear-error="clearError('password')"
            />
          </div>
        </div>

        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.full_name') }}</label>
              <span class="text-[0.7rem] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold leading-none">{{ t('form.required') }}</span>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">{{ t('form.full_name_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <Input v-model="formData.full_name" :placeholder="t('form.full_name_placeholder')" :error="formErrors.full_name ? t(formErrors.full_name) : ''" @clear-error="clearError('full_name')" />
          </div>
        </div>

        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.employee_id') }}</label>
              <span class="text-[0.7rem] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold leading-none">{{ t('form.required') }}</span>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">{{ t('form.employee_id_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <Input v-model="formData.employee_id" :placeholder="t('form.employee_id_placeholder')" :error="formErrors.employee_id ? t(formErrors.employee_id) : ''" @clear-error="clearError('employee_id')" />
          </div>
        </div>

        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.email') }}</label>
              <span class="text-[0.7rem] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold leading-none">{{ t('form.required') }}</span>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">{{ t('form.email_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <Input type="email" v-model="formData.email" :error="formErrors.email ? t(formErrors.email) : ''" @clear-error="clearError('email')" />
          </div>
        </div>

        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.department') }}</label>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">{{ t('form.department_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <Input v-model="formData.department" :placeholder="t('form.department_placeholder')" :error="formErrors.department ? t(formErrors.department) : ''" @clear-error="clearError('department')" />
          </div>
        </div>

        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center py-5">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('form.role') }}</label>
              <span class="text-[0.7rem] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold leading-none">{{ t('form.required') }}</span>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-snug">{{ t('form.role_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <MultiSelectDropdown 
              v-model="formData.role_ids" 
              :options="roles.map((r: any) => ({ value: r.id, label: r.name }))" 
              variant="form"
              @update:modelValue="clearError('role_ids')"
            />
            <p v-if="formErrors.role_ids" class="text-[0.8rem] text-danger mt-1 m-0">{{ t(formErrors.role_ids) }}</p>
          </div>
        </div>
      </form>
      <template #footer>
        <Button variant="secondary" @click="closeModal">{{ t('action.cancel') }}</Button>
        <Button type="submit" form="userForm">{{ t('action.save') }}</Button>
      </template>
    </BaseModal>

    <ConfirmModal :is-open="confirmModalState.isOpen" :message="confirmModalState.message" :is-danger="confirmModalState.isDanger" @confirm="confirmModalState.onConfirm" @cancel="confirmModalState.isOpen = false" />
  </div>
</template>



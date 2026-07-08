<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { socketService } from '@/services/socket';
import DataTableToolbar from '@/components/common/DataTableToolbar.vue';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import Pagination from '@/components/Pagination.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import CustomDropdown from '@/components/CustomDropdown.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import { useDataTable } from '@/composables/useDataTable';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'vue-sonner';

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const canAssignLab = computed(() => authStore.hasPermission('ASSIGN_LAB'));
const canInspectLab = computed(() => authStore.hasPermission('INSPECT_LAB'));
const canManageRequestList = computed(() => authStore.hasPermission('MANAGE_REQUEST_LIST'));

const { page, limit, sortBy, sortDesc, searchQuery, toggleSort } = useDataTable('id', false);

const requests = ref<any[]>([]);
const totalRequests = ref(0);
const isLoading = ref(false);

const columns = computed<DataTableColumn[]>(() => [
  { key: 'id', label: 'ID', sortable: true, sticky: 'left', width: '60px' },
  { key: 'test_no', label: 'Test No.', sortable: true, minWidth: '120px' },
  { key: 'requestor_id', label: t('lab.columns.requestor'), sortable: true, minWidth: '150px' },
  { key: 'model_no', label: t('lab.columns.model_no'), sortable: true, minWidth: '130px' },
  { key: 'model_description', label: t('lab.columns.model_description'), sortable: true, minWidth: '180px' },
  { key: 'quantity', label: t('lab.columns.quantity'), sortable: true, minWidth: '100px' },
  { key: 'product_sn', label: t('lab.columns.product_sn'), sortable: true, minWidth: '130px' },
  { key: 'project_name', label: t('lab.columns.project_name'), sortable: true, minWidth: '150px' },
  { key: 'revision', label: t('fai.columns.revision'), sortable: true, minWidth: '100px' },
  { key: 'stage', label: t('lab.columns.stage'), sortable: true, minWidth: '120px' },
  { key: 'priority', label: t('lab.columns.priority'), sortable: true, minWidth: '120px' },
  { key: 'priority_reason', label: 'Priority Reason', sortable: true, minWidth: '150px' },
  { key: 'estimated_date', label: t('fai.columns.estimated_date'), sortable: true, minWidth: '150px' },
  { key: 'inspector_name', label: t('fai.inspector', 'Inspector'), sortable: false, minWidth: '150px' },
  { key: 'approved_by', label: 'Approved By', sortable: false, minWidth: '150px' },
  { key: 'receive_date', label: t('fai.columns.receive_date'), sortable: true, minWidth: '150px' },
  { key: 'return_date', label: 'Return Date', sortable: true, minWidth: '150px' },
  { key: 'result', label: t('fai.columns.result'), sortable: true, sticky: 'right', minWidth: '120px' },
  { key: 'status', label: t('lab.columns.status'), sortable: true, sticky: 'right', minWidth: '160px', width: '160px' },
  { key: 'actions', label: t('lab.columns.actions'), sticky: 'right', minWidth: '220px', width: '220px' }
]);

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Draft': return 'secondary';
    case 'Backlog': return 'danger';
    case 'Assigned': return 'warning';
    case 'Ongoing': return 'info';
    case 'Closed': return 'success';
    default: return 'secondary';
  }
};

const assignModalState = ref({
  isOpen: false,
  requestId: null as number | null,
  priority: 'High'
});
const priorityOptions = computed(() => [
  { value: 'High', label: t('nav.priority_high', 'High') },
  { value: 'Low', label: t('nav.priority_low', 'Low') }
]);

const openAssignModal = (item: any) => {
  assignModalState.value.requestId = item.id;
  assignModalState.value.priority = 'High';
  assignModalState.value.isOpen = true;
};

const handleAssign = async () => {
  try {
    const { requestId, priority } = assignModalState.value;
    await api.post(`/lab/requests/${requestId}/assign`, { priority });
    toast.success('Assigned successfully');
    assignModalState.value.isOpen = false;
    fetchRequests();
  } catch (e) {
    console.error(e);
    toast.error('Assign failed');
  }
};

const handleAction = (item: any) => {
  if (item.status === 'Draft') {
    router.push({ name: 'lab-create-request', query: { id: item.id } });
  } else {
    router.push({ name: 'lab-request-detail', params: { id: item.id } });
  }
};

const fetchRequests = async () => {
  isLoading.value = true;
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: limit.value.toString(),
      sort_by: sortBy.value,
      sort_desc: sortDesc.value.toString()
    });

    if (searchQuery.value) {
      params.append('search', searchQuery.value);
    }

    const response = await api.get('/lab/requests', { params });
    requests.value = response.data.data;
    totalRequests.value = response.data.total;
  } catch (error) {
    console.error('Failed to fetch lab requests:', error);
  } finally {
    isLoading.value = false;
  }
};

watch([searchQuery, page, limit, sortBy, sortDesc], () => {
  fetchRequests();
});

onMounted(() => {
  fetchRequests();
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('lab-request-created', fetchRequests);
    socket.on('lab-request-updated', fetchRequests);
    socket.on('lab-request-deleted', fetchRequests);
  }
});

onUnmounted(() => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.off('lab-request-created', fetchRequests);
    socket.off('lab-request-updated', fetchRequests);
    socket.off('lab-request-deleted', fetchRequests);
  }
});

const confirmModalState = ref({
  isOpen: false,
  message: '',
  isDanger: false,
  onConfirm: () => {}
});

const deleteDraft = (id: number) => {
  confirmModalState.value = {
    isOpen: true,
    message: t('common.delete_confirm') || 'Are you sure you want to delete this request? This action cannot be undone.',
    isDanger: true,
    onConfirm: async () => {
      try {
        await api.delete(`/lab/requests/${id}/draft`);
        toast.success('Request deleted successfully');
        fetchRequests();
      } catch (err: any) {
        console.error('Delete draft failed:', err);
        toast.error(err.response?.data?.error || 'Failed to delete request');
      } finally {
        confirmModalState.value.isOpen = false;
      }
    }
  };
};

const formatDateOnly = (dateString: string) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('lab.list_title') }}</h1>
    </div>

    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('lab.search_placeholder')"
    />

    <div class="table-wrapper">
      <DataTable 
        :columns="columns" 
        :data="requests" 
        :isLoading="isLoading"
        rowKey="id"
        :sortBy="sortBy"
        :sortDesc="sortDesc"
        @sort="toggleSort"
      >
        <template #cell-test_no="{ item }">
          {{ item.test_no || '-' }}
        </template>

        <template #cell-requestor_id="{ item }">
          {{ item.requestor?.full_name || item.requestor_id || '-' }}
        </template>

        
        <template #cell-priority="{ item }">
          <span v-if="item.priority" :class="[
            'badge', 
            item.priority === 'High' ? 'badge-danger' : 
            (item.priority === 'Medium' ? 'badge-warning' : 'badge-success')
          ]">
            {{ item.priority }}
          </span>
          <span v-else class="text-muted">-</span>
        </template>

        <template #cell-estimated_date="{ item }">
          {{ formatDateOnly(item.estimated_date) }}
        </template>

        <template #cell-inspector_name="{ item }">
          {{ item.workOrders && item.workOrders.length > 0 && item.workOrders[0].technician ? item.workOrders[0].technician.full_name : '-' }}
        </template>

        <template #cell-approved_by="{ item }">
          {{ item.approver?.full_name || '-' }}
        </template>

        <template #cell-receive_date="{ item }">
          {{ formatDateOnly(item.sample_received_date) }}
        </template>

        <template #cell-return_date="{ item }">
          {{ formatDateOnly(item.sample_return_date) }}
        </template>
        
        <template #cell-result="{ item }">
          <span v-if="item.result" :class="[
            'badge',
            item.result === 'PASS' ? 'badge-success' : 'badge-danger'
          ]">{{ item.result }}</span>
          <span v-else>-</span>
        </template>

        <template #cell-status="{ item }">
          <StatusBadge 
            :isActive="true" 
            :activeText="item.status" 
            inactiveText="" 
            :variant="getStatusVariant(item.status)"
          />
        </template>

        <template #cell-actions="{ item }">
          <div class="action-buttons">
            <button 
              class="btn-sm" 
              :class="item.status === 'Draft' ? 'btn-edit' : 'btn-details'" 
              @click="handleAction(item)"
            >
              {{ item.status === 'Draft' ? t('fai.edit_draft') : t('lab.details') }}
            </button>
            <button 
              v-if="(item.status === 'Draft' && item.requestor_id === authStore.user?.id) || canManageRequestList"
              class="btn-sm btn-delete" 
              @click="deleteDraft(item.id)"
            >
              {{ item.status === 'Draft' ? t('fai.delete_draft') : t('action.delete') }}
            </button>
            <button 
              v-if="canAssignLab && item.status === 'Backlog'"
              class="btn-sm btn-primary" 
              @click="openAssignModal(item)"
            >
              {{ t('lab.assign') }}
            </button>
            <button 
              v-if="canInspectLab && item.status === 'Ongoing'"
              class="btn-sm btn-primary" 
              @click="handleAction(item)"
            >
              {{ t('fai.make_report') }}
            </button>
          </div>
        </template>
      </DataTable>
    </div>

    <Pagination :total="totalRequests" v-model="page" v-model:rowsPerPage="limit" />

    <!-- Assign Modal -->
    <BaseModal :isOpen="assignModalState.isOpen" title="Assign Priority" maxWidth="400px" @close="assignModalState.isOpen = false">
      <form id="assignForm" @submit.prevent="handleAssign" class="form-layout-vertical">
        <div class="form-group">
          <label>Priority <span class="required">*</span></label>
          <CustomDropdown 
            v-model="assignModalState.priority" 
            :options="priorityOptions" 
            placeholder="Select priority" 
          />
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-cancel" @click="assignModalState.isOpen = false">{{ t('action.cancel') }}</button>
        <button type="submit" form="assignForm" class="btn-primary" :disabled="isLoading">Save</button>
      </template>
    </BaseModal>


    <ConfirmModal 
      :is-open="confirmModalState.isOpen" 
      :message="confirmModalState.message" 
      :is-danger="confirmModalState.isDanger" 
      @confirm="confirmModalState.onConfirm" 
      @cancel="confirmModalState.isOpen = false" 
    />
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
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
}

.table-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 4px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-speed) ease;
}

.btn-details {
  background-color: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.btn-details:hover { background-color: var(--color-border); }

.btn-edit {
  background-color: var(--color-primary);
  color: var(--color-primary-text);
}
.btn-edit:hover { filter: brightness(0.9); }


.btn-delete {
  background-color: rgba(255, 85, 85, 0.1);
  color: #ff5555;
  border: 1px solid #ff5555;
}
.btn-delete:hover {
  background-color: rgba(255, 85, 85, 0.2);
}

.form-layout-vertical {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-control {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
}
.required { color: #ff5555; }
</style>

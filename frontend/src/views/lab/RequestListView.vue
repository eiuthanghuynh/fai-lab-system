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
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import Button from '@/components/ui/Button.vue';
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
    case 'Backlog': return 'secondary';
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
  <div class="flex flex-col gap-6 h-full p-8 overflow-hidden box-border">
    <div class="flex justify-between items-center">
      <h1 class="m-0 text-2xl font-semibold text-text">{{ t('lab.list_title') }}</h1>
    </div>

    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('lab.search_placeholder')"
    />

    <div class="flex-1 overflow-hidden flex flex-col bg-bg-surface rounded-lg border border-border">
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
          <div class="flex gap-2">
            <Button 
              size="sm" 
              :variant="item.status === 'Draft' ? 'primary' : 'secondary'" 
              @click="handleAction(item)"
            >
              {{ item.status === 'Draft' ? t('fai.edit_draft') : t('lab.details') }}
            </Button>
            <Button 
              v-if="(item.status === 'Draft' && item.requestor_id === authStore.user?.id) || canManageRequestList"
              size="sm" variant="danger" 
              @click="deleteDraft(item.id)"
            >
              {{ item.status === 'Draft' ? t('fai.delete_draft') : t('action.delete') }}
            </Button>
            <Button 
              v-if="canAssignLab && item.status === 'Backlog'"
              size="sm" variant="primary" 
              @click="openAssignModal(item)"
            >
              {{ t('lab.assign') }}
            </Button>
            <Button 
              v-if="canInspectLab && item.status === 'Ongoing'"
              size="sm" variant="primary" 
              @click="handleAction(item)"
            >
              {{ t('fai.make_report') }}
            </Button>
          </div>
        </template>
      </DataTable>
    </div>

    <Pagination :total="totalRequests" v-model="page" v-model:rowsPerPage="limit" />

    <!-- Assign Modal -->
    <BaseModal :isOpen="assignModalState.isOpen" title="Assign Priority" maxWidth="400px" @close="assignModalState.isOpen = false">
      <form id="assignForm" @submit.prevent="handleAssign" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-[0.85rem] font-semibold text-text">Priority <span class="text-[#ef4444]">*</span></label>
          <SingleSelectDropdown 
            v-model="assignModalState.priority" 
            :options="priorityOptions" 
            placeholder="Select priority" 
          />
        </div>
      </form>
      <template #footer>
        <Button type="button" variant="ghost" @click="assignModalState.isOpen = false">{{ t('action.cancel') }}</Button>
        <Button type="submit" form="assignForm" :loading="isLoading">Save</Button>
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


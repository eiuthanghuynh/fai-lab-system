<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useAsyncState } from '@vueuse/core';
import { useRouter } from 'vue-router';
import { formatDate } from '@/utils/dateFormatter';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { socketService } from '@/services/socket';
import DataTableToolbar from '@/components/common/DataTableToolbar.vue';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import Pagination from '@/components/Pagination.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ResultBadge from '@/components/common/ResultBadge.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import ActionDropdown from '@/components/common/ActionDropdown.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import { useDataTable } from '@/composables/useDataTable';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'vue-sonner';

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const canAssignLab = computed(() => authStore.hasPermission('ASSIGN_LAB'));
const canInspectLab = computed(() => authStore.hasPermission('INSPECT_LAB'));
const canManageRequestList = computed(() => authStore.hasPermission('MANAGE_REQUEST_LIST'));
const canApproveLab = computed(() => authStore.hasPermission('APPROVE_LAB_ENGINEER') || authStore.hasPermission('APPROVE_LAB_MANAGER'));

const handleApproveNavigation = (item: any) => {
  router.push(`/lab/request/${item.id}?mode=approve`);
};

const { page, limit, sortBy, sortDesc, searchQuery, toggleSort } = useDataTable('id', false);

const requests = ref<any[]>([]);
const totalRequests = ref(0);


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
  { key: 'week_no', label: 'Week', sortable: true, minWidth: '100px' },
  { key: 'estimated_date', label: t('fai.columns.estimated_date'), sortable: true, minWidth: '150px' },
  { key: 'complete_date', label: 'Complete Date', sortable: true, minWidth: '150px' },
  { key: 'receive_date', label: t('fai.columns.receive_date'), sortable: true, minWidth: '150px' },
  { key: 'return_date', label: 'Return Date', sortable: true, minWidth: '150px' },
  { key: 'created_at', label: t('fai.columns.created_at'), sortable: true, minWidth: '180px' },
  { key: 'updated_at', label: t('fai.columns.updated_at'), sortable: true, minWidth: '180px' },
  { key: 'result', label: t('fai.columns.result'), sortable: true, sticky: 'right', minWidth: '120px' },
  { key: 'status', label: t('lab.columns.status'), sortable: true, sticky: 'right', minWidth: '160px', width: '160px' },
  { key: 'actions', label: t('lab.columns.actions'), sticky: 'right', minWidth: '120px', width: '120px', align: 'center' }
]);

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Draft': return 'secondary';
    case 'Backlog': return 'secondary';
    case 'Assigned': return 'warning';
    case 'Ongoing': return 'warning';
    case 'Closed': return 'success';
    default: return 'secondary';
  }
};


const handleAction = (item: any) => {
  if (item.status === 'Draft') {
    router.push({ name: 'lab-request-create', query: { id: item.id } });
  } else {
    router.push({ name: 'lab-request-detail', params: { id: item.id } });
  }
};

const handleExecute = (item: any) => {
  router.push({ name: 'lab-request-detail', params: { id: item.id }, query: { mode: 'execute' } });
};

const handleAssignNavigation = (item: any) => {
  router.push({ name: 'lab-request-detail', params: { id: item.id }, query: { mode: 'assign' } });
};

const { isLoading, execute: fetchRequests } = useAsyncState(async () => {
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
}, null, { immediate: false, resetOnExecute: false });

const handleFetchRequests = () => fetchRequests();

watch([searchQuery, page, limit, sortBy, sortDesc], () => {
  handleFetchRequests();
});

onMounted(() => {
  handleFetchRequests();
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('lab-request-created', handleFetchRequests);
    socket.on('lab-request-updated', handleFetchRequests);
    socket.on('lab-request-deleted', handleFetchRequests);
  }
});

onUnmounted(() => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.off('lab-request-created', handleFetchRequests);
    socket.off('lab-request-updated', handleFetchRequests);
    socket.off('lab-request-deleted', handleFetchRequests);
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


</script>

<template>
  <div class="flex flex-col gap-6 h-full p-8 overflow-hidden box-border">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl">{{ t('lab.list_title') }}</h1>
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
          <span v-if="item.priority" :class="item.priority === 'Urgent' ? 'text-danger font-semibold' : ''">
            {{ item.priority }}
          </span>
          <span v-else class="text-muted">-</span>
        </template>

        <template #cell-priority_reason="{ item }">
          <span 
            class="block max-w-[150px] truncate" 
            :class="item.priority === 'Urgent' ? 'text-danger font-semibold' : ''"
            :title="item.priority_reason || ''"
          >
            {{ item.priority_reason || '-' }}
          </span>
        </template>

        <template #cell-estimated_date="{ item }">
          {{ formatDate(item.estimated_date) }}
        </template>

        <template #cell-receive_date="{ item }">
          {{ formatDate(item.sample_received_date) }}
        </template>
        <template #cell-return_date="{ item }">
          {{ formatDate(item.sample_return_date) }}
        </template>

        <template #cell-complete_date="{ item }">
          {{ formatDate(item.complete_date) }}
        </template>
        
        <template #cell-created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <template #cell-updated_at="{ item }">
          {{ formatDate(item.updated_at) }}
        </template>
        
        <template #cell-result="{ item }">
          <ResultBadge :result="item.result" />
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
          <ActionDropdown>
            <button 
              @click="handleAction(item)"
              class="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-primary transition-colors"
            >
              {{ item.status === 'Draft' ? t('fai.edit_draft') : t('lab.details') }}
            </button>
            <button 
              v-if="canAssignLab && item.status !== 'Draft' && item.status !== 'Closed'"
              @click="handleAssignNavigation(item)"
              class="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-primary transition-colors"
            >
              Set Priority & Assign
            </button>

            <button 
              v-if="canInspectLab && (item.status === 'Assigned' || item.status === 'Ongoing') && item.workOrders?.some((wo: any) => wo.technician_id === authStore.user?.id)"
              @click="handleExecute(item)"
              class="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-primary transition-colors"
            >
              {{ t('lab.execute_test') }}
            </button>
            <button 
              v-if="canApproveLab && item.complete_date && item.result !== 'PASS' && item.result !== 'FAIL'"
              @click="handleApproveNavigation(item)"
              class="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 hover:text-danger font-medium transition-colors"
            >
              {{ t('approval.lab.approve') }}
            </button>
            <div v-if="(item.status === 'Draft' && item.requestor_id === authStore.user?.id) || canManageRequestList" class="h-px bg-border my-1"></div>
            <button 
              v-if="(item.status === 'Draft' && item.requestor_id === authStore.user?.id) || canManageRequestList"
              @click="deleteDraft(item.id)"
              class="w-full text-left px-4 py-2 text-sm text-danger hover:bg-red-50 hover:text-red-700 font-medium transition-colors"
            >
              {{ item.status === 'Draft' ? t('fai.delete_draft') : t('action.delete') }}
            </button>
          </ActionDropdown>
        </template>
      </DataTable>
    </div>

    <Pagination :total="totalRequests" v-model="page" v-model:rowsPerPage="limit" />


    <ConfirmModal 
      :is-open="confirmModalState.isOpen" 
      :message="confirmModalState.message" 
      :is-danger="confirmModalState.isDanger" 
      @confirm="confirmModalState.onConfirm" 
      @cancel="confirmModalState.isOpen = false" 
    />
  </div>
</template>


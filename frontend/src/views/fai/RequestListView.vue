<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import DataTableToolbar from '@/components/common/DataTableToolbar.vue';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import Pagination from '@/components/Pagination.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import { useDataTable } from '@/composables/useDataTable';
import { useAuthStore } from '@/stores/auth';
import { useRequestListStateStore } from '@/stores/requestListState';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import ActionDropdown from '@/components/common/ActionDropdown.vue';
import FilterDrawer from '@/components/common/FilterDrawer.vue';
import { toast } from 'vue-sonner';

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const canManageRequestList = computed(() => authStore.hasPermission('MANAGE_REQUEST_LIST'));
const canAssignFai = computed(() => authStore.hasPermission('ASSIGN_FAI'));
const canInspectFai = computed(() => authStore.hasPermission('INSPECT_FAI'));

const stateStore = useRequestListStateStore();

// Advanced Filters Popover State
const showFiltersPopover = ref(false); // Can be kept or removed if not used elsewhere, but not needed for FilterDrawer itself
const filterDrawerRef = ref<any>(null);

const localFilters = ref({
  projectName: '',
  partNo: '',
  commodityPart: '' as number | '',
  supplierId: '' as number | '',
  trackingNo: '',
  receiveDateFrom: '',
  receiveDateTo: '',
  completeDateFrom: '',
  completeDateTo: '',
  estDateFrom: '',
  estDateTo: '',
  inspectorId: '' as number | '',
  status: '',
  result: ''
});

const commodityPartOptions = ref<{ value: number, label: string }[]>([]);
const supplierOptions = ref<{ value: number, label: string }[]>([]);
const inspectorOptions = ref<{ value: number, label: string }[]>([]);

const statusOptions = computed(() => [
  { value: 'Draft', label: t('fai.status_draft') || 'Draft' },
  { value: 'Backlog', label: t('fai.status_backlog') || 'Backlog' },
  { value: 'Assigned', label: t('fai.status_assigned') || 'Assigned' },
  { value: 'Ongoing', label: t('fai.status_ongoing') || 'Ongoing' },
  { value: 'Closed', label: t('fai.status_closed') || 'Closed' }
]);

const resultOptions = computed(() => [
  { value: 'Pass', label: 'Pass' },
  { value: 'Fail', label: 'Fail' },
  { value: 'TBD', label: 'TBD' }
]);

const activeFiltersCount = computed(() => {
  let count = 0;
  const lf = localFilters.value;
  if (lf.projectName) count++;
  if (lf.partNo) count++;
  if (lf.commodityPart) count++;
  if (lf.supplierId) count++;
  if (lf.trackingNo) count++;
  if (lf.receiveDateFrom || lf.receiveDateTo) count++;
  if (lf.completeDateFrom || lf.completeDateTo) count++;
  if (lf.estDateFrom || lf.estDateTo) count++;
  if (lf.inspectorId) count++;
  if (lf.status) count++;
  if (lf.result) count++;
  return count;
});

const onDocumentClick = (e: MouseEvent) => {
  if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
    const trigger = document.querySelector('.filter-trigger');
    if (trigger && trigger.contains(e.target as Node)) return;
    showFiltersPopover.value = false;
  }
};

watch(showFiltersPopover, (newVal) => {
  if (newVal) {
    document.addEventListener('click', onDocumentClick);
  } else {
    document.removeEventListener('click', onDocumentClick);
  }
});

// DataTable composable
const { page, limit, sortBy, sortDesc, searchQuery, toggleSort } = useDataTable('id', false);

// Restore saved states from store
searchQuery.value = stateStore.searchQuery;
const overdueTargetDate = ref<string | null>(stateStore.overdueTargetDate);

// Watch and persist input values to stateStore
watch(searchQuery, (newVal) => {
  stateStore.searchQuery = newVal;
});
watch(overdueTargetDate, (newVal) => {
  stateStore.overdueTargetDate = newVal;
});

// Clear filters if navigating away from FAI Request List to any page other than Detail
onBeforeRouteLeave((to) => {
  if (to.name !== 'fai-request-detail') {
    stateStore.clear();
  }
});

const requests = ref<any[]>([]);
const totalRequests = ref(0);
const isLoading = ref(false);

const columns = computed<DataTableColumn[]>(() => [
  { key: 'id', label: 'ID', sortable: true, sticky: 'left', width: '60px' },
  { key: 'test_no', label: 'Test No.', sortable: true, minWidth: '150px' },
  { key: 'requestor_id', label: 'Requestor Name', sortable: true, minWidth: '150px' },
  { key: 'project_name', label: 'Project Name', sortable: true, minWidth: '160px' },
  { key: 'part_no', label: 'Part Number', sortable: true, minWidth: '150px' },
  { key: 'revision', label: 'Revision', sortable: true, minWidth: '120px' },
  { key: 'part_name', label: 'Part Name', sortable: true, minWidth: '200px' },
  { key: 'tracking_no', label: 'Tracking No.', sortable: true, minWidth: '150px' },
  { key: 'commodity_part', label: 'Commodity Part', sortable: true, minWidth: '160px' },
  { key: 'supplier_id', label: 'Supplier Name', sortable: true, minWidth: '180px' },
  { key: 'part_type', label: 'Part Type', sortable: true, minWidth: '120px' },
  { key: 'reason_for_submission', label: 'Reason for Submission', sortable: true, minWidth: '250px' },
  { key: 'receive_date', label: 'Receive Date', sortable: true, minWidth: '150px' },
  { key: 'sample_qty', label: 'Sample Qty', sortable: true, minWidth: '120px' },
  { key: 'submission_time', label: 'Submission Time', sortable: true, minWidth: '150px' },
  { key: 'priority', label: 'Priority', sortable: true, minWidth: '120px' },
  { key: 'priority_reason', label: 'Priority Reason', sortable: true, minWidth: '150px' },
  { key: 'week_no', label: 'Week', sortable: true, minWidth: '100px' },
  { key: 'complete_date', label: 'Complete Date', sortable: true, minWidth: '150px' },
  { key: 'failure_details', label: 'Failure Details', sortable: false, minWidth: '200px' },
  { key: 'improvement_plan', label: 'Improvement Plan', sortable: false, minWidth: '200px' },
  { key: 'inspector_id', label: 'Inspector Name', sortable: true, minWidth: '150px' },
  { key: 'fai_failure_mode', label: 'FAI Failure Mode', sortable: true, minWidth: '180px' },
  { key: 'remark', label: 'Remark', sortable: true, minWidth: '200px' },
  { key: 'estimated_date', label: 'Estimated Date', sortable: true, minWidth: '150px' },
  { key: 'created_at', label: t('fai.columns.created_at'), sortable: true, minWidth: '180px' },
  { key: 'updated_at', label: t('fai.columns.updated_at'), sortable: true, minWidth: '180px' },
  { key: 'result', label: t('fai.columns.result'), sortable: true, sticky: 'right', minWidth: '120px' },
  { key: 'status', label: t('fai.columns.status'), sortable: true, sticky: 'right', minWidth: '160px', width: '160px' },
  { key: 'actions', label: t('fai.columns.actions'), sticky: 'right', minWidth: '120px', width: '120px', align: 'center' }
]);

const formatOrdinal = (n: number) => {
  if (!n) return '-';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Draft': return 'secondary';
    case 'Backlog': return 'secondary';
    case 'Ongoing': return 'warning';
    case 'Approved': return 'success';
    case 'Rejected': return 'danger';
    default: return 'secondary';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'Draft': return t('fai.status_draft');
    case 'Backlog': return t('fai.status_backlog');
    case 'Ongoing': return t('fai.status_ongoing');
    case 'Approved': return t('fai.status_approved');
    case 'Rejected': return t('fai.status_rejected');
    default: return status;
  }
};

const applyFilters = () => {
  page.value = 1;
  if (filterDrawerRef.value) filterDrawerRef.value.close();
  fetchRequests();
};

const resetFilters = () => {
  localFilters.value = {
    projectName: '',
    partNo: '',
    commodityPart: '',
    supplierId: '',
    trackingNo: '',
    receiveDateFrom: '',
    receiveDateTo: '',
    completeDateFrom: '',
    completeDateTo: '',
    estDateFrom: '',
    estDateTo: '',
    inspectorId: '',
    status: '',
    result: ''
  };
  page.value = 1;
  fetchRequests();
};

const assignModalState = ref({
  isOpen: false,
  requestId: null as number | null,
  inspectorId: '' as number | string,
  priority: 'Normal',
  priorityReason: ''
});
const priorityOptions = computed(() => [
  { value: 'Urgent', label: t('fai.priority_urgent') },
  { value: 'Normal', label: t('fai.priority_normal') }
]);

const openAssignModal = async (item: any) => {
  assignModalState.value.requestId = item.id;
  assignModalState.value.inspectorId = '';
  assignModalState.value.priority = 'Normal';
  assignModalState.value.priorityReason = '';
  assignModalState.value.isOpen = true;
  if (inspectorOptions.value.length === 0) {
    try {
      const res = await api.get('/fai/inspectors/list');
      inspectorOptions.value = res.data.data.map((u: any) => ({
        value: u.id,
        label: u.full_name
      }));
    } catch (e) {
      console.error(e);
    }
  }
};

const handleAssign = async () => {
  try {
    const { requestId, inspectorId, priority, priorityReason } = assignModalState.value;
    if (!inspectorId || !priority) {
      toast.error(t('form.required'));
      return;
    }
    if (priority === 'Urgent' && (!priorityReason || priorityReason.trim() === '')) {
      toast.error(t('form.required'));
      return;
    }
    await api.post(`/fai/${requestId}/assign`, { inspector_id: inspectorId, priority, priority_reason: priorityReason });
    toast.success(t('toast.edit_success'));
    assignModalState.value.isOpen = false;
    fetchRequests();
  } catch (e) {
    console.error(e);
    toast.error(t('error.save_failed'));
  }
};

const handleMakeReport = (item: any) => {
  toast.info('Make report action coming soon');
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

    // Append advanced filters
    const lf = localFilters.value;
    if (lf.projectName) params.append('project_name', lf.projectName);
    if (lf.partNo) params.append('part_no', lf.partNo);
    if (lf.commodityPart) params.append('commodity_part', lf.commodityPart.toString());
    if (lf.supplierId) params.append('supplier_id', lf.supplierId.toString());
    if (lf.trackingNo) params.append('tracking_no', lf.trackingNo);
    if (lf.receiveDateFrom) params.append('receive_date_from', lf.receiveDateFrom);
    if (lf.receiveDateTo) params.append('receive_date_to', lf.receiveDateTo);
    if (lf.completeDateFrom) params.append('complete_date_from', lf.completeDateFrom);
    if (lf.completeDateTo) params.append('complete_date_to', lf.completeDateTo);
    if (lf.estDateFrom) params.append('est_date_from', lf.estDateFrom);
    if (lf.estDateTo) params.append('est_date_to', lf.estDateTo);
    if (lf.inspectorId) params.append('inspector_id', lf.inspectorId.toString());
    if (lf.status) params.append('status', lf.status);
    if (lf.result) params.append('result', lf.result);

    const res = await api.get(`/fai?${params.toString()}`);
    requests.value = res.data.data;
    totalRequests.value = res.data.total;
  } catch (err) {
    console.error('Fetch FAI requests failed:', err);
  } finally {
    isLoading.value = false;
  }
};

watch([searchQuery, page, limit, sortBy, sortDesc], () => {
  fetchRequests();
});

onMounted(async () => {
  fetchRequests();

  // Fetch commodity parts
  try {
    const res = await api.get('/commodity-parts?limit=100');
    if (res.data && res.data.data) {
      commodityPartOptions.value = res.data.data.map((part: any) => ({
        value: part.id,
        label: part.name
      }));
    }
  } catch (err) {
    console.error('Failed to load commodity parts:', err);
  }

  // Fetch suppliers
  try {
    const res = await api.get('/suppliers?limit=100');
    if (res.data && res.data.data) {
      supplierOptions.value = res.data.data.map((sup: any) => ({
        value: sup.id,
        label: sup.name
      }));
    }
  } catch (err) {
    console.error('Failed to load suppliers:', err);
  }

  // Fetch inspectors (users with MANAGE_FAI_REQUEST permission)
  try {
    const res = await api.get('/fai/inspectors/list');
    if (res.data && res.data.data) {
      inspectorOptions.value = res.data.data.map((user: any) => ({
        value: user.id,
        label: user.full_name || user.username
      }));
    }
  } catch (err) {
    console.error('Failed to load inspectors:', err);
  }
});

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDateOnly = (dateString: string) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const handleAction = (item: any) => {
  if (item.status === 'Draft') {
    // Navigate to create page with query parameter id to load the draft
    router.push({ name: 'fai-request-create', query: { id: item.id } });
  } else {
    // Navigate to request details page
    router.push({ name: 'fai-request-detail', params: { id: item.id } });
  }
};

const confirmModalState = ref({
  isOpen: false,
  message: '',
  isDanger: false,
  onConfirm: () => {}
});

const handleDelete = async (item: any) => {
  if (item.status !== 'Draft' && !canManageRequestList.value) return;
  
  confirmModalState.value = {
    isOpen: true,
    message: t('common.delete_confirm') || 'Are you sure you want to delete this request? This action cannot be undone.',
    isDanger: true,
    onConfirm: async () => {
      try {
        const res = await api.delete(`/fai/${item.id}`);
        if (res.data.success) {
          toast.success(t('toast.delete_success'));
          fetchRequests(); // Reload the list
        } else {
          toast.error(t('toast.action_failed'));
        }
      } catch (err) {
        console.error('Delete draft failed:', err);
        toast.error(t('toast.action_failed'));
      } finally {
        confirmModalState.value.isOpen = false;
      }
    }
  };
};


const getRowClass = (item: any) => {
  if (!overdueTargetDate.value) return '';
  if (item.status !== 'Draft' && item.status !== 'Backlog') return '';
  
  const createdDate = new Date(item.created_at);
  const targetDate = new Date(overdueTargetDate.value);
  
  // Reset hours to compare dates only
  createdDate.setHours(0,0,0,0);
  targetDate.setHours(0,0,0,0);
  
  return createdDate < targetDate ? 'overdue-row' : '';
};
</script>

<template>
  <div class="flex flex-col gap-6 h-full p-8 overflow-hidden box-border">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl">{{ t('fai.list_title') }}</h1>
    </div>

    <!-- Toolbar containing only search bar and filters -->
    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('fai.search_placeholder')"
    >
      <template #filters>
        <FilterDrawer ref="filterDrawerRef" :activeCount="activeFiltersCount">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.85rem] font-semibold text-text">Project Name</label>
              <Input type="text" v-model="localFilters.projectName" :placeholder="t('fai.placeholder.search_project')" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.85rem] font-semibold text-text">Part No.</label>
              <Input type="text" v-model="localFilters.partNo" :placeholder="t('fai.placeholder.search_part_no')" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.85rem] font-semibold text-text">Category (Commodity)</label>
              <SingleSelectDropdown v-model="localFilters.commodityPart" :options="commodityPartOptions" :placeholder="t('fai.placeholder.all_categories')" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.85rem] font-semibold text-text">Supplier Name</label>
              <SingleSelectDropdown v-model="localFilters.supplierId" :options="supplierOptions" :placeholder="t('fai.placeholder.all_suppliers', 'All Suppliers')" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.85rem] font-semibold text-text">Tracking No.</label>
              <Input type="text" v-model="localFilters.trackingNo" :placeholder="t('fai.placeholder.search_tracking')" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.85rem] font-semibold text-text">Inspector By</label>
              <SingleSelectDropdown v-model="localFilters.inspectorId" :options="inspectorOptions" :placeholder="t('fai.placeholder.all_inspectors')" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.85rem] font-semibold text-text">Status</label>
              <SingleSelectDropdown v-model="localFilters.status" :options="statusOptions" :placeholder="t('fai.placeholder.all_status')" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.85rem] font-semibold text-text">Result</label>
              <SingleSelectDropdown v-model="localFilters.result" :options="resultOptions" :placeholder="t('fai.placeholder.all_results')" />
            </div>
          </div>

          <div class="flex flex-col gap-3 pt-4 border-t border-border mt-5">
            <div class="grid grid-cols-[120px_1fr] items-center">
              <label class="text-[0.85rem] font-semibold text-text">Receive Date</label>
              <div class="flex items-center gap-2">
                <Input type="date" v-model="localFilters.receiveDateFrom" class="flex-1 [&_input::-webkit-calendar-picker-indicator]:invert-[0.5] [&_input::-webkit-calendar-picker-indicator]:cursor-pointer" />
                <span class="text-text-muted text-sm">to</span>
                <Input type="date" v-model="localFilters.receiveDateTo" class="flex-1 [&_input::-webkit-calendar-picker-indicator]:invert-[0.5] [&_input::-webkit-calendar-picker-indicator]:cursor-pointer" />
              </div>
            </div>
            <div class="grid grid-cols-[120px_1fr] items-center">
              <label class="text-[0.85rem] font-semibold text-text">Complete Date</label>
              <div class="flex items-center gap-2">
                <Input type="date" v-model="localFilters.completeDateFrom" class="flex-1 [&_input::-webkit-calendar-picker-indicator]:invert-[0.5] [&_input::-webkit-calendar-picker-indicator]:cursor-pointer" />
                <span class="text-text-muted text-sm">to</span>
                <Input type="date" v-model="localFilters.completeDateTo" class="flex-1 [&_input::-webkit-calendar-picker-indicator]:invert-[0.5] [&_input::-webkit-calendar-picker-indicator]:cursor-pointer" />
              </div>
            </div>
            <div class="grid grid-cols-[120px_1fr] items-center">
              <label class="text-[0.85rem] font-semibold text-text">Est Date</label>
              <div class="flex items-center gap-2">
                <Input type="date" v-model="localFilters.estDateFrom" class="flex-1 [&_input::-webkit-calendar-picker-indicator]:invert-[0.5] [&_input::-webkit-calendar-picker-indicator]:cursor-pointer" />
                <span class="text-text-muted text-sm">to</span>
                <Input type="date" v-model="localFilters.estDateTo" class="flex-1 [&_input::-webkit-calendar-picker-indicator]:invert-[0.5] [&_input::-webkit-calendar-picker-indicator]:cursor-pointer" />
              </div>
            </div>
          </div>

          <template #footer>
            <Button variant="secondary" @click="resetFilters" class="gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
              {{ t('action.reset') || 'Reset' }}
            </Button>
            <Button variant="primary" @click="applyFilters">
              {{ t('action.apply') || 'Apply Filters' }}
            </Button>
          </template>
        </FilterDrawer>
      </template>
    </DataTableToolbar>

    <div class="flex-1 overflow-hidden flex flex-col bg-bg-surface rounded-lg border border-border">
      <DataTable 
        :columns="columns" 
        :data="requests" 
        :isLoading="isLoading"
        rowKey="id"
        :sortBy="sortBy"
        :sortDesc="sortDesc"
        :rowClass="getRowClass"
        @sort="toggleSort"
      >
        <template #cell-requestor_id="{ item }">
          {{ item.requestor?.full_name || item.requestor_id || '-' }}
        </template>
        
        <template #cell-inspector_id="{ item }">
          {{ item.inspector?.full_name || item.inspector_id || '-' }}
        </template>
        
        <template #cell-test_no="{ item }">
          <span class="font-mono text-sm text-primary">{{ item.test_no || '-' }}</span>
        </template>
        <template #cell-tracking_no="{ item }">
          {{ item.tracking_no || '-' }}
        </template>
        
        <template #cell-revision="{ item }">
          {{ item.revision || '-' }}
        </template>

        <template #cell-address="{ item }">
          {{ item.address || '-' }}
        </template>
        
        <!-- Priority Cell -->
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

        <template #cell-commodity_part="{ item }">
          {{ item.commodityPartRel?.name || item.commodity_part || '-' }}
        </template>

        <template #cell-supplier_id="{ item }">
          {{ item.supplier?.name || '-' }}
        </template>

        <template #cell-part_type="{ item }">
          {{ item.part_type || '-' }}
        </template>

        <template #cell-reason_for_submission="{ item }">
          {{ item.reason_for_submission || '-' }}
        </template>
        
        <template #cell-submission_time="{ item }">
          {{ formatOrdinal(item.submission_time) }}
        </template>
        
        <template #cell-complete_date="{ item }">
          {{ formatDateOnly(item.complete_date) }}
        </template>
        
        <template #cell-updated_at="{ item }">
          {{ formatDate(item.updated_at) }}
        </template>

        <template #cell-estimated_date="{ item }">
          {{ formatDateOnly(item.estimated_date) }}
        </template>

        <template #cell-receive_date="{ item }">
          {{ formatDateOnly(item.receive_date) }}
        </template>

        <template #cell-result="{ item }">
          {{ item.result || '-' }}
        </template>

        <template #cell-fai_failure_mode="{ item }">
          {{ item.fai_failure_mode || '-' }}
        </template>

        <template #cell-remark="{ item }">
          {{ item.remark || '-' }}
        </template>

        <template #cell-created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <template #cell-status="{ item }">
          <StatusBadge 
            :isActive="item.status !== 'Draft'" 
            :activeText="getStatusText(item.status)" 
            :inactiveText="t('fai.status_draft')" 
            :variant="getStatusVariant(item.status)"
          />
        </template>

        <template #cell-actions="{ item }">
          <ActionDropdown>
            <button 
              @click="handleAction(item)"
              class="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-primary transition-colors"
            >
              {{ item.status === 'Draft' ? t('fai.edit_draft') : t('fai.details') }}
            </button>
            <button 
              v-if="canAssignFai && item.status === 'Backlog'"
              @click="openAssignModal(item)"
              class="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-primary transition-colors"
            >
              {{ t('fai.assign') }}
            </button>
            <button 
              v-if="canInspectFai && item.status === 'Ongoing'"
              @click="handleMakeReport(item)"
              class="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-primary transition-colors"
            >
              {{ t('fai.make_report') }}
            </button>
            <div v-if="item.status === 'Draft' || canManageRequestList" class="h-px bg-border my-1"></div>
            <button 
              v-if="item.status === 'Draft' || canManageRequestList"
              @click="handleDelete(item)"
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

    <!-- Assign Modal -->
    <BaseModal :isOpen="assignModalState.isOpen" :title="t('fai.assign_title')" maxWidth="690px" @close="assignModalState.isOpen = false">
      <form id="assignForm" @submit.prevent="handleAssign" class="flex flex-col gap-6">
        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center pb-5 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('fai.inspector') }}</label>
              <span class="text-[0.7rem] px-1.5 py-0.5 bg-[rgba(99,224,121,0.15)] text-primary rounded font-semibold leading-none">{{ t('form.required') }}</span>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-[1.4]">{{ t('fai.assign_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <SingleSelectDropdown 
              v-model="assignModalState.inspectorId" 
              :options="inspectorOptions" 
              :placeholder="t('form.required')" 
            />
          </div>
        </div>
        
        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center pb-2">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('fai.priority') }}</label>
              <span class="text-[0.7rem] px-1.5 py-0.5 bg-[rgba(99,224,121,0.15)] text-primary rounded font-semibold leading-none">{{ t('form.required') }}</span>
            </div>
          </div>
          <div class="flex flex-col">
            <SingleSelectDropdown 
              v-model="assignModalState.priority" 
              :options="priorityOptions" 
              :placeholder="t('form.required')" 
            />
          </div>
        </div>
        
        <div v-if="assignModalState.priority === 'Urgent'" class="grid grid-cols-[1fr_1.5fr] gap-8 items-start pb-2">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('fai.priority_reason') }}</label>
              <span class="text-[0.7rem] px-1.5 py-0.5 bg-[rgba(99,224,121,0.15)] text-primary rounded font-semibold leading-none">{{ t('form.required') }}</span>
            </div>
          </div>
          <div class="flex flex-col">
            <Textarea 
              v-model="assignModalState.priorityReason"
              :placeholder="t('form.required')"
              :rows="3"
            />
          </div>
        </div>
      </form>
      <template #footer>
        <Button type="button" variant="secondary" @click="assignModalState.isOpen = false">{{ t('action.cancel') }}</Button>
        <Button type="submit" form="assignForm" :loading="isLoading">
          {{ t('action.save') }}
        </Button>
      </template>
    </BaseModal>
  </div>
</template>



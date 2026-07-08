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
import { toast } from 'vue-sonner';
import CustomDropdown from '@/components/CustomDropdown.vue';
import BaseModal from '@/components/common/BaseModal.vue';

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const canManageRequestList = computed(() => authStore.hasPermission('MANAGE_REQUEST_LIST'));
const canAssignFai = computed(() => authStore.hasPermission('ASSIGN_FAI'));
const canInspectFai = computed(() => authStore.hasPermission('INSPECT_FAI'));

const stateStore = useRequestListStateStore();

// Advanced Filters Popover State
const showFiltersPopover = ref(false);
const popoverRef = ref<HTMLElement | null>(null);

const localFilters = ref({
  projectName: '',
  partNo: '',
  commodityPart: '' as number | '',
  supplierName: '',
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
const inspectorOptions = ref<{ value: number, label: string }[]>([]);

const statusOptions = computed(() => [
  { value: 'Draft', label: t('fai.status_draft') },
  { value: 'Backlog', label: t('fai.status_backlog') },
  { value: 'Ongoing', label: t('fai.status_ongoing') },
  { value: 'Approved', label: t('fai.status_approved') },
  { value: 'Rejected', label: t('fai.status_rejected') }
]);

const resultOptions = computed(() => [
  { value: 'Backlog', label: 'Backlog' },
  { value: 'PASS', label: 'PASS' },
  { value: 'FAIL', label: 'FAIL' }
]);

const activeFiltersCount = computed(() => {
  let count = 0;
  const lf = localFilters.value;
  if (lf.projectName) count++;
  if (lf.partNo) count++;
  if (lf.commodityPart) count++;
  if (lf.supplierName) count++;
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
  { key: 'requestor_id', label: 'Requestor Name', sortable: true, minWidth: '150px' },
  { key: 'project_name', label: 'Project Name', sortable: true, minWidth: '160px' },
  { key: 'part_no', label: 'Part Number', sortable: true, minWidth: '150px' },
  { key: 'revision', label: 'Revision', sortable: true, minWidth: '120px' },
  { key: 'part_name', label: 'Part Name', sortable: true, minWidth: '200px' },
  { key: 'tracking_no', label: 'Tracking No.', sortable: true, minWidth: '200px' },
  { key: 'commodity_part', label: 'Commodity Part', sortable: true, minWidth: '160px' },
  { key: 'supplier_name', label: 'Supplier Name', sortable: true, minWidth: '180px' },
  { key: 'part_type', label: 'Part Type', sortable: true, minWidth: '150px' },
  { key: 'reason_for_submission', label: 'Reason for Submission', sortable: true, minWidth: '250px' },
  { key: 'receive_date', label: 'Receive Date', sortable: true, minWidth: '150px' },
  { key: 'sample_qty', label: 'Sample Qty', sortable: true, minWidth: '120px' },
  { key: 'submission_time', label: 'Submission Time', sortable: true, minWidth: '150px' },
  { key: 'priority', label: 'Priority', sortable: true, minWidth: '120px' },
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
  { key: 'actions', label: t('fai.columns.actions'), sticky: 'right', minWidth: '220px', width: '220px' }
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
    case 'Backlog': return 'danger';
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
  fetchRequests();
  showFiltersPopover.value = false;
};

const resetFilters = () => {
  localFilters.value = {
    projectName: '',
    partNo: '',
    commodityPart: '',
    supplierName: '',
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
  priority: 'High'
});
const priorityOptions = computed(() => [
  { value: 'High', label: t('fai.priority_high') },
  { value: 'Medium', label: t('fai.priority_medium') },
  { value: 'Low', label: t('fai.priority_low') }
]);

const openAssignModal = async (item: any) => {
  assignModalState.value.requestId = item.id;
  assignModalState.value.inspectorId = '';
  assignModalState.value.priority = 'High';
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
    const { requestId, inspectorId, priority } = assignModalState.value;
    if (!inspectorId || !priority) {
      toast.error(t('form.required'));
      return;
    }
    await api.post(`/fai/${requestId}/assign`, { inspector_id: inspectorId, priority });
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
    if (lf.supplierName) params.append('supplier_name', lf.supplierName);
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
  <div class="admin-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('fai.list_title') }}</h1>
    </div>

    <!-- Toolbar containing only search bar and filters -->
    <DataTableToolbar 
      v-model:searchQuery="searchQuery" 
      :searchPlaceholder="t('fai.search_placeholder')"
    >
      <template #filters>
        <div class="filters-container" ref="popoverRef">
          <button class="pill-btn btn-secondary filter-trigger" @click.stop="showFiltersPopover = !showFiltersPopover">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            {{ t('action.filter') || 'Filters' }}
            <span v-if="activeFiltersCount > 0" class="filter-badge">{{ activeFiltersCount }}</span>
          </button>

          <div v-if="showFiltersPopover" class="filters-popover">
            <div class="popover-header">
              <h3>{{ t('fai.advanced_filters') || 'Advanced Filters' }}</h3>
              <button class="btn-close" @click="showFiltersPopover = false">&times;</button>
            </div>
            
            <div class="popover-body">
              <div class="filter-grid">
                <!-- Project Name -->
                <div class="filter-item">
                  <label>Project Name</label>
                  <input type="text" v-model="localFilters.projectName" :placeholder="t('fai.placeholder.search_project')" class="pill-input-field" />
                </div>

                <!-- Part No. -->
                <div class="filter-item">
                  <label>Part No.</label>
                  <input type="text" v-model="localFilters.partNo" :placeholder="t('fai.placeholder.search_part_no')" class="pill-input-field" />
                </div>

                <!-- Category (Commodity) -->
                <div class="filter-item">
                  <label>Category (Commodity)</label>
                  <CustomDropdown v-model="localFilters.commodityPart" :options="commodityPartOptions" :placeholder="t('fai.placeholder.all_categories')" />
                </div>

                <!-- Supplier Name -->
                <div class="filter-item">
                  <label>Supplier Name</label>
                  <input type="text" v-model="localFilters.supplierName" :placeholder="t('fai.placeholder.search_supplier')" class="pill-input-field" />
                </div>

                <!-- Tracking No. -->
                <div class="filter-item">
                  <label>Tracking No.</label>
                  <input type="text" v-model="localFilters.trackingNo" :placeholder="t('fai.placeholder.search_tracking')" class="pill-input-field" />
                </div>

                <!-- Inspector By -->
                <div class="filter-item">
                  <label>Inspector By</label>
                  <CustomDropdown v-model="localFilters.inspectorId" :options="inspectorOptions" :placeholder="t('fai.placeholder.all_inspectors')" />
                </div>

                <!-- Status -->
                <div class="filter-item">
                  <label>Status</label>
                  <CustomDropdown v-model="localFilters.status" :options="statusOptions" :placeholder="t('fai.placeholder.all_status')" />
                </div>

                <!-- Result -->
                <div class="filter-item">
                  <label>Result</label>
                  <CustomDropdown v-model="localFilters.result" :options="resultOptions" :placeholder="t('fai.placeholder.all_results')" />
                </div>
              </div>

              <div class="date-filters-section">
                <!-- Receive Date Range -->
                <div class="date-range-item">
                  <label>Receive Date</label>
                  <div class="date-inputs">
                    <input type="date" v-model="localFilters.receiveDateFrom" class="pill-date-field" />
                    <span>to</span>
                    <input type="date" v-model="localFilters.receiveDateTo" class="pill-date-field" />
                  </div>
                </div>

                <!-- Complete Date Range -->
                <div class="date-range-item">
                  <label>Complete Date</label>
                  <div class="date-inputs">
                    <input type="date" v-model="localFilters.completeDateFrom" class="pill-date-field" />
                    <span>to</span>
                    <input type="date" v-model="localFilters.completeDateTo" class="pill-date-field" />
                  </div>
                </div>

                <!-- Est Date Range -->
                <div class="date-range-item">
                  <label>Est Date</label>
                  <div class="date-inputs">
                    <input type="date" v-model="localFilters.estDateFrom" class="pill-date-field" />
                    <span>to</span>
                    <input type="date" v-model="localFilters.estDateTo" class="pill-date-field" />
                  </div>
                </div>
              </div>
            </div>

            <div class="popover-footer">
              <button class="pill-btn btn-secondary" @click="resetFilters">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
                {{ t('action.reset') || 'Reset' }}
              </button>
              <button class="pill-btn btn-primary" @click="applyFilters">
                {{ t('action.apply') || 'Apply Filters' }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </DataTableToolbar>

    <div class="table-wrapper">
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
          <span v-if="item.priority" :class="[
            'badge', 
            item.priority === 'High' ? 'badge-danger' : 
            (item.priority === 'Medium' ? 'badge-warning' : 'badge-success')
          ]">
            {{ item.priority }}
          </span>
          <span v-else class="text-muted">-</span>
        </template>

        <template #cell-commodity_part="{ item }">
          {{ item.commodityPartRel?.name || item.commodity_part || '-' }}
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
          <div class="action-buttons">
            <button 
              class="btn-sm" 
              :class="item.status === 'Draft' ? 'btn-edit' : 'btn-details'" 
              @click="handleAction(item)"
            >
              {{ item.status === 'Draft' ? t('fai.edit_draft') : t('fai.details') }}
            </button>
            <button 
              v-if="item.status === 'Draft' || canManageRequestList"
              class="btn-sm btn-delete" 
              @click="handleDelete(item)"
            >
              {{ item.status === 'Draft' ? t('fai.delete_draft') : t('action.delete') }}
            </button>
            <button 
              v-if="canAssignFai && item.status === 'Backlog'"
              class="btn-sm btn-primary" 
              @click="openAssignModal(item)"
            >
              {{ t('fai.assign') }}
            </button>
            <button 
              v-if="canInspectFai && item.status === 'Ongoing'"
              class="btn-sm btn-primary" 
              @click="handleMakeReport(item)"
            >
              {{ t('fai.make_report') }}
            </button>
          </div>
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
      <form id="assignForm" @submit.prevent="handleAssign" class="form-layout-5050">
        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('fai.inspector') }}</label>
              <span class="tag-required">{{ t('form.required') }}</span>
            </div>
            <p class="field-desc">{{ t('fai.assign_desc') }}</p>
          </div>
          <div class="form-col-right">
            <CustomDropdown 
              v-model="assignModalState.inspectorId" 
              :options="inspectorOptions" 
              :placeholder="t('form.required')" 
            />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-col-left">
            <div class="label-header">
              <label>{{ t('fai.priority') }}</label>
              <span class="tag-required">{{ t('form.required') }}</span>
            </div>
          </div>
          <div class="form-col-right">
            <CustomDropdown 
              v-model="assignModalState.priority" 
              :options="priorityOptions" 
              :placeholder="t('form.required')" 
            />
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-cancel" @click="assignModalState.isOpen = false">{{ t('action.cancel') }}</button>
        <button type="submit" form="assignForm" class="btn-primary" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          {{ t('action.save') }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
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
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-speed) ease;
}

.btn-edit {
  background-color: var(--color-primary);
  color: var(--color-primary-text);
}

.btn-edit:hover {
  filter: brightness(0.9);
}

.btn-details {
  background-color: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.btn-details:hover {
  background-color: var(--color-border);
}

.btn-delete {
  background-color: rgba(255, 85, 85, 0.1);
  color: #ff5555;
  border: 1px solid #ff5555;
}
.btn-delete:hover {
  background-color: rgba(255, 85, 85, 0.2);
}
.btn-cancel {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.pill-filter {
  display: flex;
  align-items: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 0.25rem 1rem;
  gap: 0.5rem;
  min-width: 180px;
  height: 44px;
}

.filter-icon {
  color: var(--color-text-muted);
}

.pill-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text);
  width: 100%;
  padding: 0.25rem 0;
  font-size: 1rem;
}

/* Chrome, Safari, Edge, Opera: Remove spin buttons */
.pill-input::-webkit-outer-spin-button,
.pill-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox: Remove spin buttons */
.pill-input[type=number] {
  -moz-appearance: textfield;
}

/* Overdue Rows Styling */
:deep(.overdue-row td) {
  background-color: #ffebeb !important;
  color: #c53030 !important;
}

:deep(.overdue-row:hover td) {
  filter: brightness(0.95);
}

:deep(html.dark .overdue-row td) {
  background-color: #450a0a !important;
  color: #fecaca !important;
}

.date-filter-wrapper {
  gap: 0.5rem;
  padding-left: 0.75rem;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
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

/* Advanced Filters Popover */
.filters-container {
  position: relative;
  display: inline-block;
}

.filter-badge {
  background: var(--color-primary);
  color: var(--color-bg);
  border-radius: 50%;
  padding: 0.1rem 0.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  margin-left: 0.25rem;
}

.filters-popover {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  width: 580px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes popoverFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.popover-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  cursor: pointer;
  line-height: 1;
}
.btn-close:hover {
  color: var(--color-text);
}

.popover-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-height: 420px;
  overflow-y: auto;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filter-item label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.pill-input-field {
  padding: 0.25rem 1rem;
  height: 44px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 20px;
  outline: none;
  font-size: 0.95rem;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
}
.pill-input-field:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(99, 224, 121, 0.2);
}

.date-filters-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.date-range-item {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
}

.date-range-item label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.date-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-inputs span {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.pill-date-field {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  outline: none;
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  height: 36px;
  padding: 0 0.75rem;
  flex: 1;
}

.pill-date-field::-webkit-calendar-picker-indicator {
  filter: invert(0.5);
  cursor: pointer;
}

.popover-footer {
  display: flex;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-surface);
}

.popover-footer .pill-btn {
  padding: 0.5rem 1.25rem;
  font-size: 0.95rem;
}

</style>

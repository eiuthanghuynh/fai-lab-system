<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import CustomDropdown from '@/components/CustomDropdown.vue';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'vue-sonner';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const requestId = route.params.id as string;

const request = ref<any>(null);
const attachments = ref<any[]>([]);
const workOrders = ref<any[]>([]);
const isLoading = ref(true);

const canInspectLab = computed(() => authStore.hasPermission('INSPECT_LAB'));

const fetchDetail = async () => {
  try {
    isLoading.value = true;
    const res = await api.get(`/lab/requests/${requestId}`);
    request.value = res.data.data;
    attachments.value = res.data.data.attachments || [];

    const woRes = await api.get(`/lab/requests/${requestId}/work-orders`);
    workOrders.value = woRes.data.data || [];
  } catch (err: any) {
    console.error('Fetch detail failed:', err);
    toast.error('Failed to load request detail');
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchDetail();
});

const woColumns = computed<DataTableColumn[]>(() => [
  { key: 'work_order_no', label: t('lab.work_order.work_order_no'), sortable: false },
  { key: 'item_test', label: t('lab.work_order.item_test'), sortable: false },
  { key: 'quantity', label: t('lab.columns.quantity'), sortable: false },
  { key: 'product_sn', label: t('lab.columns.product_sn'), sortable: false },
  { key: 'procedure_condition', label: t('lab.work_order.procedure_condition'), sortable: false },
  { key: 'test_specification', label: t('lab.work_order.test_specification'), sortable: false },
  { key: 'remark', label: t('lab.work_order.goal_comments'), sortable: false },
  { key: 'status', label: t('lab.work_order.status'), sortable: false },
  { key: 'test_result', label: t('lab.work_order.test_result'), sortable: false },
  { key: 'technician', label: t('lab.work_order.technician'), sortable: false },
  { key: 'actions', label: t('lab.columns.actions'), sortable: false, width: '120px' }
]);

// Update Modal State
const updateModalState = ref({
  isOpen: false,
  woId: null as number | null,
  status: '',
  test_result: '',
  failure_details: '',
  improvement_plan: '',
  remark: ''
});
const attachedFiles = ref<File[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);

const statusOptions = [
  { value: 'Backlog', label: 'Backlog' },
  { value: 'Assigned', label: 'Assigned' },
  { value: 'Ongoing', label: 'Ongoing' },
  { value: 'Completed', label: 'Completed' }
];

const resultOptions = [
  { value: 'PASS', label: 'PASS' },
  { value: 'FAIL', label: 'FAIL' },
  { value: '', label: 'N/A' }
];

const openUpdateModal = (wo: any) => {
  updateModalState.value = {
    isOpen: true,
    woId: wo.id,
    status: wo.status,
    test_result: wo.test_result || '',
    failure_details: wo.failure_details || '',
    improvement_plan: wo.improvement_plan || '',
    remark: wo.remark || ''
  };
  attachedFiles.value = [];
};

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const filesArray = Array.from(target.files);
    attachedFiles.value = [...attachedFiles.value, ...filesArray];
  }
};

const uploadFiles = async () => {
  if (attachedFiles.value.length === 0) return [];
  const uploadData = new FormData();
  attachedFiles.value.forEach(file => {
    uploadData.append('files', file);
  });
  const res = await api.post('/lab/work-orders/upload', uploadData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data.files.map((f: any) => f.id);
};

const submitUpdate = async () => {
  try {
    const fileIds = await uploadFiles();
    const payload = {
      ...updateModalState.value,
      file_ids: fileIds
    };
    await api.put(`/lab/work-orders/${updateModalState.value.woId}/status`, payload);
    toast.success('Work Order updated successfully');
    updateModalState.value.isOpen = false;
    fetchDetail();
  } catch (err) {
    console.error(err);
    toast.error('Failed to update work order');
  }
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Submitted': return 'secondary';
    case 'Backlog': return 'secondary';
    case 'Assigned': return 'warning';
    case 'Ongoing': return 'info';
    case 'Completed': return 'success';
    default: return 'secondary';
  }
};

const getResultClass = (res: string) => {
  if (res === 'PASS') return 'text-success font-weight-bold';
  if (res === 'FAIL') return 'text-danger font-weight-bold';
  return '';
};
</script>

<template>
  <div class="detail-page" v-if="request && !isLoading">
    <div class="page-header">
      <div class="header-left">
        <button type="button" class="btn-back" @click="router.push('/lab/request/list')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-back">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          {{ t('fai.back_to_list', 'Back to List') }}
        </button>
      </div>
      <div class="title-container">
        <h1>{{ request.model_no }} - {{ request.project_name }}</h1>
        <StatusBadge :isActive="true" :activeText="request.status" inactiveText="" :variant="getStatusVariant(request.status)" />
      </div>
    </div>

    <div class="info-card">
      <h3 class="section-title">{{ t('lab.details') }}</h3>
      <div class="info-grid">
        <div class="info-item">
          <label>Test No.</label>
          <span>{{ request.test_no || '-' }}</span>
        </div>
        <div class="info-item">
          <label>{{ t('lab.columns.model_description') }}</label>
          <span>{{ request.model_description || '-' }}</span>
        </div>
        <div class="info-item">
          <label>{{ t('lab.columns.quantity') }}</label>
          <span>{{ request.quantity || '-' }}</span>
        </div>
        <div class="info-item">
          <label>{{ t('lab.columns.product_sn') }}</label>
          <span>{{ request.product_sn || '-' }}</span>
        </div>
        <div class="info-item">
          <label>Revision</label>
          <span>{{ request.revision || '-' }}</span>
        </div>
        <div class="info-item">
          <label>{{ t('lab.columns.stage') }}</label>
          <span>{{ request.stage || '-' }}</span>
        </div>
        <div class="info-item">
          <label>{{ t('lab.columns.priority') }}</label>
          <span :class="{'text-danger font-weight-bold': request.priority === 'High'}">{{ request.priority || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- Attachments -->
    <div class="info-card" v-if="attachments.length > 0">
      <h3 class="section-title">{{ t('fai.attachments', 'Attachments') }}</h3>
      <ul class="file-list">
        <li v-for="file in attachments" :key="file.id" class="file-item">
          <a :href="`/uploads/${file.file_url}`" target="_blank">{{ file.file_name }}</a>
        </li>
      </ul>
    </div>

    <div class="info-card">
      <h3 class="section-title">{{ t('lab.work_order.title') }}</h3>
      <DataTable 
        :columns="woColumns" 
        :data="workOrders" 
        :isLoading="isLoading"
        rowKey="id"
      >
        <template #cell-status="{ item }">
          <StatusBadge :isActive="true" :activeText="item.status" inactiveText="" :variant="getStatusVariant(item.status)" />
        </template>
        <template #cell-technician="{ item }">
          {{ item.technician?.full_name || '-' }}
        </template>
        <template #cell-test_result="{ item }">
          <span :class="getResultClass(item.test_result)">{{ item.test_result || '-' }}</span>
        </template>
        <template #cell-actions="{ item }">
          <button 
            v-if="canInspectLab"
            class="btn-sm btn-primary" 
            @click="openUpdateModal(item)"
          >
            Update
          </button>
        </template>
      </DataTable>
    </div>

    <!-- Update WO Modal -->
    <BaseModal :isOpen="updateModalState.isOpen" title="Update Work Order" maxWidth="700px" @close="updateModalState.isOpen = false">
      <form id="woUpdateForm" @submit.prevent="submitUpdate" class="form-layout-vertical">
        <div class="form-group-row">
          <div class="form-group">
            <label>{{ t('lab.work_order.status') }} <span class="required">*</span></label>
            <CustomDropdown v-model="updateModalState.status" :options="statusOptions" />
          </div>
          <div class="form-group">
            <label>{{ t('lab.work_order.test_result') }}</label>
            <CustomDropdown v-model="updateModalState.test_result" :options="resultOptions" />
          </div>
        </div>
        <div class="form-group" v-if="updateModalState.test_result === 'FAIL'">
          <label>{{ t('lab.work_order.failure_details') }}</label>
          <textarea v-model="updateModalState.failure_details" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-group" v-if="updateModalState.test_result === 'FAIL'">
          <label>{{ t('lab.work_order.improvement_action') }}</label>
          <textarea v-model="updateModalState.improvement_plan" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>{{ t('lab.work_order.goal_comments') }}</label>
          <input v-model="updateModalState.remark" type="text" class="form-control" />
        </div>
        
        <div class="form-group">
          <label>{{ t('lab.work_order.upload_report') }}</label>
          <input type="file" ref="fileInputRef" @change="handleFileSelect" multiple class="form-control" />
          <div class="file-list-preview mt-2">
            <div v-for="(file, idx) in attachedFiles" :key="idx" class="badge-secondary mr-2 mb-2 p-1 rounded">
              {{ file.name }}
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-cancel" @click="updateModalState.isOpen = false">{{ t('action.cancel') }}</button>
        <button type="submit" form="woUpdateForm" class="btn-primary">Save</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.detail-page {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--color-border);
  padding-bottom: 1.5rem;
}

.header-left {
  display: flex;
  align-items: center;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-back:hover {
  background-color: var(--color-border);
}

.icon-back {
  width: 16px;
  height: 16px;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-container h1 {
  margin: 0;
  font-size: 1.5rem;
}

.info-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem;
}

.section-title {
  color: var(--color-primary);
  margin-top: 0;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.info-item span {
  font-weight: 500;
  color: var(--color-text);
}

.file-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-item a {
  color: var(--color-primary);
  text-decoration: none;
}
.file-item a:hover {
  text-decoration: underline;
}

.form-layout-vertical {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form-group-row {
  display: flex;
  gap: 1rem;
}
.form-group-row .form-group {
  flex: 1;
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
  font-family: inherit;
}

.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  font-weight: 500;
}
.btn-primary {
  background-color: var(--color-primary);
  color: #000;
}
.text-danger { color: #ff5555; }
.text-success { color: #55ff55; }
.font-weight-bold { font-weight: bold; }
</style>

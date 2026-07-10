<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
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
  <div class="max-w-[1200px] mx-auto p-6 flex flex-col gap-6" v-if="request && !isLoading">
    <div class="flex justify-between items-start mb-8 border-b-2 border-border pb-6">
      <div class="flex items-center">
        <Button variant="secondary" class="gap-2" @click="router.push('/lab/request/list')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          {{ t('fai.back_to_list', 'Back to List') }}
        </Button>
      </div>
      <div class="flex items-center gap-4">
        <h1 class="m-0 text-2xl font-bold">{{ request.model_no }} - {{ request.project_name }}</h1>
        <StatusBadge :isActive="true" :activeText="request.status" inactiveText="" :variant="getStatusVariant(request.status)" />
      </div>
    </div>

    <div class="bg-bg-surface border border-border rounded-lg p-6 shadow-sm">
      <h3 class="text-primary mt-0 mb-4 pb-2 border-b border-border text-lg font-semibold">{{ t('lab.details') }}</h3>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6">
        <div class="flex flex-col gap-1">
          <label class="text-[0.85rem] text-text-muted">Test No.</label>
          <span class="font-medium text-text">{{ request.test_no || '-' }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[0.85rem] text-text-muted">{{ t('lab.columns.model_description') }}</label>
          <span class="font-medium text-text">{{ request.model_description || '-' }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[0.85rem] text-text-muted">{{ t('lab.columns.quantity') }}</label>
          <span class="font-medium text-text">{{ request.quantity || '-' }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[0.85rem] text-text-muted">{{ t('lab.columns.product_sn') }}</label>
          <span class="font-medium text-text">{{ request.product_sn || '-' }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[0.85rem] text-text-muted">Revision</label>
          <span class="font-medium text-text">{{ request.revision || '-' }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[0.85rem] text-text-muted">{{ t('lab.columns.stage') }}</label>
          <span class="font-medium text-text">{{ request.stage || '-' }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[0.85rem] text-text-muted">{{ t('lab.columns.priority') }}</label>
          <span class="font-medium" :class="{'text-[#ff5555]': request.priority === 'High', 'text-text': request.priority !== 'High'}">{{ request.priority || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- Attachments -->
    <div class="bg-bg-surface border border-border rounded-lg p-6 shadow-sm" v-if="attachments.length > 0">
      <h3 class="text-primary mt-0 mb-4 pb-2 border-b border-border text-lg font-semibold">{{ t('fai.attachments', 'Attachments') }}</h3>
      <ul class="list-none p-0 m-0 flex flex-col gap-2">
        <li v-for="file in attachments" :key="file.id" class="flex items-center">
          <a :href="`/uploads/${file.file_url}`" target="_blank" class="text-primary no-underline hover:underline">{{ file.file_name }}</a>
        </li>
      </ul>
    </div>

    <div class="bg-bg-surface border border-border rounded-lg p-6 shadow-sm">
      <h3 class="text-primary mt-0 mb-4 pb-2 border-b border-border text-lg font-semibold">{{ t('lab.work_order.title') }}</h3>
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
          <span :class="{'text-emerald-500 font-bold': item.test_result === 'PASS', 'text-red-500 font-bold': item.test_result === 'FAIL'}">{{ item.test_result || '-' }}</span>
        </template>
        <template #cell-actions="{ item }">
          <Button 
            v-if="canInspectLab"
            size="sm"
            @click="openUpdateModal(item)"
          >
            Update
          </Button>
        </template>
      </DataTable>
    </div>

    <!-- Update WO Modal -->
    <BaseModal :isOpen="updateModalState.isOpen" title="Update Work Order" maxWidth="700px" @close="updateModalState.isOpen = false">
      <form id="woUpdateForm" @submit.prevent="submitUpdate" class="flex flex-col gap-4">
        <div class="flex gap-4">
          <div class="flex-1 flex flex-col gap-2">
            <label class="text-sm font-medium text-text">{{ t('lab.work_order.status') }} <span class="text-[#ff5555]">*</span></label>
            <SingleSelectDropdown v-model="updateModalState.status" :options="statusOptions" />
          </div>
          <div class="flex-1 flex flex-col gap-2">
            <label class="text-sm font-medium text-text">{{ t('lab.work_order.test_result') }}</label>
            <SingleSelectDropdown v-model="updateModalState.test_result" :options="resultOptions" />
          </div>
        </div>
        <div class="flex flex-col gap-2" v-if="updateModalState.test_result === 'FAIL'">
          <label class="text-sm font-medium text-text">{{ t('lab.work_order.failure_details') }}</label>
          <textarea v-model="updateModalState.failure_details" class="w-full px-3 py-2 bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" rows="3"></textarea>
        </div>
        <div class="flex flex-col gap-2" v-if="updateModalState.test_result === 'FAIL'">
          <label class="text-sm font-medium text-text">{{ t('lab.work_order.improvement_action') }}</label>
          <textarea v-model="updateModalState.improvement_plan" class="w-full px-3 py-2 bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" rows="3"></textarea>
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-text">{{ t('lab.work_order.goal_comments') }}</label>
          <Input v-model="updateModalState.remark" />
        </div>
        
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-text">{{ t('lab.work_order.upload_report') }}</label>
          <input type="file" ref="fileInputRef" @change="handleFileSelect" multiple class="w-full px-3 py-2 bg-bg border border-border rounded-md text-text" />
          <div class="flex flex-wrap mt-2">
            <div v-for="(file, idx) in attachedFiles" :key="idx" class="bg-bg-surface border border-border text-text-muted px-2 py-1 text-sm mr-2 mb-2 rounded">
              {{ file.name }}
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <Button variant="secondary" @click="updateModalState.isOpen = false">{{ t('action.cancel') }}</Button>
        <Button type="submit" form="woUpdateForm">Save</Button>
      </template>
    </BaseModal>
  </div>
</template>



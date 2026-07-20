<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useAsyncState } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { formatDate } from '@/utils/dateFormatter';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';

import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import PdfViewer from '@/components/common/PdfViewer.vue';
import DirectUpload from '@/components/common/DirectUpload.vue';
import ImageSlideshow from '@/components/common/ImageSlideshow.vue';
import DetailCard from '@/components/common/DetailCard.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import { useAuthStore } from '@/stores/auth';
import { useFormValidation } from '@/composables/useFormValidation';
import { toast } from 'vue-sonner';
import { z } from 'zod';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const requestId = route.params.id as string;

const request = ref<any>(null);
const attachments = ref<any[]>([]);
const workOrders = ref<any[]>([]);


const canInspectLab = computed(() => authStore.hasPermission('INSPECT_LAB'));
const canAssignLab = computed(() => authStore.hasPermission('ASSIGN_LAB'));
const isExecuteMode = computed(() => route.query.mode === 'execute');
const isAssignMode = computed(() => route.query.mode === 'assign');
const hasOwnedWorkOrders = computed(() => workOrders.value.some(wo => wo.technician_id === authStore.user?.id));

const { isLoading, execute: fetchDetail } = useAsyncState(async () => {
  const res = await api.get(`/lab/requests/${requestId}`);
  request.value = res.data.data;
  attachments.value = res.data.data.attachments || [];

  const woRes = await api.get(`/lab/requests/${requestId}/work-orders`);
  const rawWos = woRes.data.data || [];
  workOrders.value = rawWos.sort((a: any, b: any) => (a.work_order_no || '').localeCompare(b.work_order_no || ''));
}, null, { 
  immediate: false,
  resetOnExecute: false,
  onError: (err: any) => {
    console.error('Fetch detail failed:', err);
    const status = err.response?.status;
    if (status === 403) {
      router.push({ name: 'unauthorized' });
    } else if (status === 404) {
      router.push({ name: 'not-found' });
    } else {
      toast.error('Failed to load request detail');
    }
  }
});

onMounted(() => {
  fetchDetail();
});

const woColumns = computed<DataTableColumn[]>(() => [
  { key: 'work_order_no', label: t('lab.work_order.work_order_no'), sortable: true, minWidth: "120px", width: "120px" },
  { key: 'itemTest.name', label: t('lab.work_order.item_test'), sortable: false, minWidth: "180px", width: "180px" },
  { key: 'technician.full_name', label: t('lab.work_order.technician_name', 'Technician'), sortable: false, minWidth: "160px", width: "160px" },
  { key: 'quantity', label: t('lab.columns.quantity'), sortable: false },
  { key: 'product_sn', label: t('lab.columns.product_sn'), sortable: false },
  { key: 'procedure_condition', label: t('lab.work_order.procedure_condition'), sortable: false, minWidth: "200px", maxWidth: "800px"},
  { key: 'test_specification', label: t('lab.work_order.test_specification'), sortable: false, minWidth: "200px", maxWidth: "800px" },
  { key: 'remark', label: t('lab.work_order.goal_comments'), sortable: false, minWidth: "200px", maxWidth: "800px" },
  { key: 'status', label: t('lab.work_order.status'), sortable: false },
  { key: 'test_result', label: t('lab.work_order.test_result'), sortable: false },
  { key: 'failure_details', label: t('lab.work_order.failure_details', 'Failure Details'), sortable: false, minWidth: "250px", maxWidth: "500px" },
  { key: 'improvement_plan', label: t('lab.work_order.improvement_plan', 'Improvement Plan'), sortable: false, minWidth: "250px", maxWidth: "500px" },
  { key: 'report_attachment', label: t('lab.work_order.report_attachment', 'Report Attachment'), sortable: false }
]);

const workOrdersDraft = ref<any[]>([]);
const itemTestOptions = ref<any[]>([]);
const inspectorOptions = ref<any[]>([]);

const { execute: fetchItemTests } = useAsyncState(async () => {
  const res = await api.get('/item-tests/list');
  itemTestOptions.value = res.data.data.map((i: any) => ({ value: i.id, label: i.name }));
}, null, { immediate: false });

const { execute: fetchInspectors } = useAsyncState(async () => {
  const res = await api.get('/lab/inspectors/list');
  inspectorOptions.value = res.data.data.map((i: any) => ({ value: i.id, label: i.full_name || i.username }));
}, null, { immediate: false });

const totalDraftQuantity = computed(() => {
  return workOrdersDraft.value.reduce((acc, wo) => acc + (Number(wo.quantity) || 0), 0);
});
const isQuantityValid = computed(() => {
  if (!request.value) return false;
  return totalDraftQuantity.value === request.value.quantity;
});

// Adjust Time Modal State
const adjustTimeModalState = ref({
  isOpen: false,
  estimatedDate: '',
  estimatedTime: '',
  receiveDate: '',
  receiveTime: '',
  returnDate: '',
  returnTime: ''
});

const { formErrors: adjustTimeErrors, validate: validateAdjustTime, clearError: clearAdjustTimeError, clearAllErrors: clearAllAdjustTimeErrors } = useFormValidation();

const previewPdfModalState = ref({
  isOpen: false,
  files: [] as any[],
  zipFilename: 'attachments.zip'
});
const openPdfPreview = (files: any[], workOrderNo?: string) => {
  previewPdfModalState.value.files = files;
  previewPdfModalState.value.zipFilename = workOrderNo ? `Report_${workOrderNo}.zip` : 'attachments.zip';
  previewPdfModalState.value.isOpen = true;
};

const getAdjustTimeSchema = () => z.object({
  receiveDate: z.string().optional(),
  receiveTime: z.string().optional(),
  returnDate: z.string().optional(),
  returnTime: z.string().optional()
}).refine(data => {
  if (data.receiveDate && data.returnDate) {
    const time1 = data.receiveTime || '11:59';
    const time2 = data.returnTime || '11:59';
    const receive = new Date(`${data.receiveDate}T${time1}:00`);
    const returnDt = new Date(`${data.returnDate}T${time2}:00`);
    return returnDt >= receive;
  }
  return true;
}, {
  message: 'Return date must be after or equal to receive date',
  path: ['returnDate']
});

const extractDate = (isoString: string | null | undefined) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
};

const extractTime = (isoString: string | null | undefined) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().split('T')[1].slice(0, 5);
};

const openAdjustTimeModal = () => {
  if (!canInspectLab.value || !hasOwnedWorkOrders.value || !isExecuteMode.value) {
    toast.error('Forbidden');
    return;
  }
  if (request.value) {
    clearAllAdjustTimeErrors();
    const estDate = extractDate(request.value.estimated_date);
    const estTime = extractTime(request.value.estimated_date) || '11:59';
    
    adjustTimeModalState.value = {
      isOpen: true,
      estimatedDate: estDate,
      estimatedTime: extractDate(request.value.estimated_date) ? estTime : '',
      receiveDate: extractDate(request.value.sample_received_date),
      receiveTime: extractTime(request.value.sample_received_date),
      returnDate: extractDate(request.value.sample_return_date),
      returnTime: extractTime(request.value.sample_return_date)
    };
  }
};

const handleAdjustTime = async () => {
  const schema = getAdjustTimeSchema();
  if (!validateAdjustTime(schema, adjustTimeModalState.value)) {
    toast.error(t('error.validation_failed') || 'Vui lòng kiểm tra lại thông tin');
    return;
  }

  try {
    const getCombineDateTime = (d: string, t: string) => {
      if (!d) return null;
      const timeStr = t || '11:59';
      return new Date(`${d}T${timeStr}:00`).toISOString();
    };

    const payload = {
      estimated_date: getCombineDateTime(adjustTimeModalState.value.estimatedDate, adjustTimeModalState.value.estimatedTime),
      sample_received_date: getCombineDateTime(adjustTimeModalState.value.receiveDate, adjustTimeModalState.value.receiveTime),
      sample_return_date: getCombineDateTime(adjustTimeModalState.value.returnDate, adjustTimeModalState.value.returnTime)
    };
    await api.put(`/lab/requests/${requestId}/schedule`, payload);
    toast.success('Schedule updated successfully');
    adjustTimeModalState.value.isOpen = false;
    fetchDetail();
  } catch (err: any) {
    console.error(err);
    toast.error(err.response?.data?.error || 'Failed to update schedule');
  }
};

const statusOptions = [
  { value: 'Backlog', label: 'Backlog' },
  { value: 'Assigned', label: 'Assigned' },
  { value: 'Ongoing', label: 'Ongoing' },
  { value: 'Closed', label: 'Closed' }
];

const resultOptions = [
  { value: 'PASS', label: 'PASS' },
  { value: 'FAIL', label: 'FAIL' },
  { value: '', label: 'N/A' }
];

const editingType = ref<'assign' | 'execute' | null>(null);
const isEditingWO = computed(() => editingType.value !== null);

const handleStartAssignWO = () => {
  workOrdersDraft.value = JSON.parse(JSON.stringify(workOrders.value));
  editingType.value = 'assign';
  fetchInspectors();
};

const handleStartExecuteWO = () => {
  workOrdersDraft.value = JSON.parse(JSON.stringify(workOrders.value));
  workOrdersDraft.value.forEach(draft => {
    draft.failure_images = (draft.images || []).filter((img: any) => img.image_category === 'FAILURE');
    draft.improvement_images = (draft.images || []).filter((img: any) => img.image_category === 'IMPROVEMENT');
    draft.reportAttachments = draft.reportAttachments || [];
  });
  editingType.value = 'execute';
  fetchItemTests();
};

const isOwner = (item: any) => {
  return item.technician_id === authStore.user?.id;
};

const cancelConfirmModalState = ref({ isOpen: false });
const handleCancelEditWO = () => {
  cancelConfirmModalState.value.isOpen = true;
};

const confirmCancelEdit = () => {
  editingType.value = null;
  workOrdersDraft.value = [];
  cancelConfirmModalState.value.isOpen = false;
};

const { isLoading: isSaving, execute: handleSaveWO } = useAsyncState(async () => {
  if (!isQuantityValid.value) {
    toast.error(t('toast.lab.work_order.exceed_quantity'));
    return;
  }

  const updates = [];

  for (const draft of workOrdersDraft.value) {
    // Reconstruct images array from separated arrays
    draft.images = [...(draft.failure_images || []), ...(draft.improvement_images || [])];

    if (draft.id) {
      updates.push(draft);
    }
  }
  
  const keptImageIds = workOrdersDraft.value.flatMap(wo => (wo.images || []).map((img:any) => img.id)).filter(id => id);
  const keptReportAttachmentIds = workOrdersDraft.value.flatMap(wo => (wo.reportAttachments || []).map((att:any) => att.id)).filter(id => id);

  await api.post(`/lab/requests/${requestId}/work-orders/bulk`, {
    updates,
    keptImageIds,
    keptReportAttachmentIds
  });

  toast.success('Work Orders saved successfully');
  editingType.value = null;
  fetchDetail();
}, null, { 
  immediate: false,
  onError: (e: any) => toast.error(e.response?.data?.error || e.message || 'Lỗi hệ thống')
});

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Submitted': return 'secondary';
    case 'Backlog': return 'secondary';
    case 'Assigned': return 'warning';
    case 'Ongoing': return 'warning';
    case 'Closed': return 'success';
    default: return 'secondary';
  }
};


</script>

<template>
  <div class="h-full overflow-y-auto p-6 box-border">
    <div class="w-full max-w-[1550px] mx-auto flex flex-col gap-6">
      
      <!-- Header -->
      <div class="flex justify-between items-center border-b border-border pb-4">
        <div class="flex items-center gap-6">
          <Button variant="secondary" class="gap-2" @click="router.push('/lab/request/list')">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {{ t('fai.back_to_list', 'Back to List') }}
          </Button>
          <h2 class="m-0 text-2xl font-bold text-text">{{ t('lab.detail_title') }} <span v-if="request">#{{ request.id }}</span></h2>
        </div>
        
        <div v-if="request" class="flex items-center">
          <StatusBadge 
            :isActive="true" 
            :activeText="request.status" 
            inactiveText="" 
            :variant="getStatusVariant(request.status)"
          />
        </div>
      </div>

      <!-- Loading and Error States -->
      <div v-if="isLoading && !request" class="flex flex-col items-center justify-center p-20 bg-bg-surface border border-border rounded-lg text-text-muted">
        <div class="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin mb-4"></div>
        <p>Loading request details...</p>
      </div>

      <!-- Detail Content -->
      <div v-else-if="request" class="flex flex-col gap-6">
        <div class="flex flex-col gap-6">
          
          <div class="flex flex-col gap-6">
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DetailCard title="General Information">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Requestor Name</span>
                    <span class="text-[0.95rem] text-text break-all">{{ request.requestor?.full_name || request.requestor?.username || '-' }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Test No.</span>
                    <span class="text-[0.95rem] text-text break-all">{{ request.test_no || '-' }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Model Description</span>
                    <span class="text-[0.95rem] text-text break-all">{{ request.model_description || '-' }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Product SN</span>
                    <span class="text-[0.95rem] text-text break-all">{{ request.product_sn || '-' }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Revision</span>
                    <span class="text-[0.95rem] text-text break-all">{{ request.revision || '-' }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Stage</span>
                    <span class="text-[0.95rem] text-text break-all">{{ request.stage || '-' }}</span>
                  </div>
                </div>
              </DetailCard>

              <!-- Card 2: Sample & Schedule Info -->
              <DetailCard title="Sample & Schedule">
                <template #action>
                  <Button 
                    v-if="canInspectLab && hasOwnedWorkOrders && isExecuteMode"
                    variant="primary" 
                    class="h-8 text-xs font-semibold px-3" 
                    @click="openAdjustTimeModal"
                  >
                    {{ t('lab.adjust_time') }}
                  </Button>
                </template>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Quantity</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.quantity || '-' }}</span>
                </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Priority</label>
                    <span class="text-[0.95rem] font-medium" :class="{'text-[#ff5555]': request.priority === 'Urgent', 'text-text': request.priority !== 'Urgent'}">{{ request.priority || '-' }}</span>
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Priority Reason</label>
                    <span class="text-[0.95rem] font-medium break-all" :class="{'text-[#ff5555]': request.priority === 'Urgent', 'text-text': request.priority !== 'Urgent'}">{{ request.priority_reason || '-' }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Week</span>
                    <span class="text-[0.95rem] text-text break-all">{{ request.week_no || '-' }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Receive Date</span>
                    <span class="text-[0.95rem] text-text break-all">{{ formatDate(request.sample_received_date) }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Return Date</span>
                    <span class="text-[0.95rem] text-text break-all">{{ formatDate(request.sample_return_date) }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Estimated Date</span>
                    <span class="text-[0.95rem] text-text break-all">{{ formatDate(request.estimated_date) }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Complete Date</span>
                    <span class="text-[0.95rem] text-text break-all">{{ formatDate(request.complete_date) }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Created At</span>
                    <span class="text-[0.95rem] text-text break-all">{{ formatDate(request.created_at) }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Updated At</span>
                    <span class="text-[0.95rem] text-text break-all">{{ formatDate(request.updated_at) }}</span>
                  </div>
                </div>
              </DetailCard>
            </div>

            <DetailCard class="!h-auto min-h-[567px]" :title="t('lab.work_order.title')">
              <template #action>
                <div v-if="(isAssignMode && canAssignLab) || (isExecuteMode && canInspectLab && hasOwnedWorkOrders)" class="flex gap-2">
                  <template v-if="!editingType">
                    <Button 
                      v-if="isAssignMode && canAssignLab" 
                      variant="primary" 
                      class="h-8 text-xs font-semibold px-3" 
                      @click="handleStartAssignWO"
                    >
                      {{ t('lab.assign_technician') }}
                    </Button>
                    <Button 
                      v-if="isExecuteMode && canInspectLab && hasOwnedWorkOrders" 
                      variant="primary" 
                      class="h-8 text-xs font-semibold px-3" 
                      @click="handleStartExecuteWO"
                    >
                      {{ t('action.edit') }} Work Order
                    </Button>
                  </template>
                  <template v-else>
                    <Button variant="secondary" class="h-8 text-xs font-semibold px-3" @click="handleCancelEditWO">{{ t('action.cancel') }}</Button>
                    <Button variant="primary" class="h-8 text-xs font-semibold px-3" :loading="isSaving" @click="handleSaveWO">{{ t('action.save') }}</Button>
                  </template>
                </div>
              </template>
              
              <DataTable 
                class="flex-1 mt-4"
                :columns="woColumns" 
                :data="isEditingWO ? workOrdersDraft : workOrders" 
                :isLoading="isLoading"
                rowKey="work_order_no"
              >
                <template #cell-itemTest.name="{ item }">
                  {{ item.itemTest?.name }}
                </template>
                
                <template #cell-technician.full_name="{ item }">
                  <template v-if="editingType === 'assign' && canAssignLab">
                    <SingleSelectDropdown v-model="item.technician_id" :options="inspectorOptions" class="w-40" />
                  </template>
                  <template v-else>{{ item.technician?.full_name || item.technician?.username || '-' }}</template>
                </template>
                
                <template #cell-quantity="{ item }">
                  {{ item.quantity }}
                </template>
                
                <template #cell-product_sn="{ item }">
                  <Input v-if="editingType === 'execute' && isOwner(item)" v-model="item.product_sn" class="w-32" />
                  <template v-else>{{ item.product_sn || '-' }}</template>
                </template>
                
                <template #cell-procedure_condition="{ item }">
                  {{ item.procedure_condition || '-' }}
                </template>

                <template #cell-test_specification="{ item }">
                  {{ item.test_specification || '-' }}
                </template>
                
                <template #cell-remark="{ item }">
                  {{ item.remark || '-' }}
                </template>

                <template #cell-status="{ item }">
                  <SingleSelectDropdown v-if="editingType === 'execute' && isOwner(item)" v-model="item.status" :options="statusOptions" class="w-32" />
                  <StatusBadge v-else :isActive="true" :activeText="item.status" inactiveText="" :variant="getStatusVariant(item.status)" />
                </template>

                <template #cell-test_result="{ item }">
                  <SingleSelectDropdown v-if="editingType === 'execute' && isOwner(item)" v-model="item.test_result" :options="resultOptions" class="w-32" />
                  <span v-else :class="{'text-emerald-500 font-bold': item.test_result === 'PASS', 'text-red-500 font-bold': item.test_result === 'FAIL'}">{{ item.test_result || '-' }}</span>
                </template>

                <template #cell-failure_details="{ item }">
                  <div class="flex flex-col gap-2">
                    <Textarea v-if="editingType === 'execute' && isOwner(item)" v-model="item.failure_details" class="w-full min-w-[200px] text-xs" rows="2" />
                    <template v-else>{{ item.failure_details }}</template>
                    
                    <DirectUpload 
                      v-if="editingType === 'execute' && isOwner(item)"
                      v-model="item.failure_images" 
                      uploadUrl="/lab/work-orders/upload"
                      :uploadParams="{ type: 'FAILURE' }"
                      :compact="true"
                      accept=".jpg,.jpeg,.png"
                      :maxSize="20 * 1024 * 1024"
                    />
                    <ImageSlideshow v-else :images="item.images?.filter((img: any) => img.image_category === 'FAILURE') || []" />
                  </div>
                </template>

                <template #cell-improvement_plan="{ item }">
                  <div class="flex flex-col gap-2">
                    <Textarea v-if="editingType === 'execute' && isOwner(item)" v-model="item.improvement_plan" class="w-full min-w-[200px] text-xs" rows="2" />
                    <template v-else>{{ item.improvement_plan }}</template>
                    
                    <DirectUpload 
                      v-if="editingType === 'execute' && isOwner(item)"
                      v-model="item.improvement_images" 
                      uploadUrl="/lab/work-orders/upload"
                      :uploadParams="{ type: 'IMPROVEMENT' }"
                      :compact="true"
                      accept=".jpg,.jpeg,.png"
                      :maxSize="20 * 1024 * 1024"
                    />
                    <ImageSlideshow v-else :images="item.images?.filter((img: any) => img.image_category === 'IMPROVEMENT') || []" />
                  </div>
                </template>

                <template #cell-report_attachment="{ item }">
                  <div class="flex flex-col gap-2">
                    <DirectUpload 
                      v-if="editingType === 'execute' && isOwner(item)"
                      v-model="item.reportAttachments" 
                      uploadUrl="/lab/work-orders/upload"
                      :uploadParams="{ type: 'REPORT' }"
                      :compact="true"
                    />
                    <template v-else>
                      <button 
                        v-if="item.reportAttachments && item.reportAttachments.length > 0"
                        type="button" 
                        class="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors border-none cursor-pointer text-xs font-semibold whitespace-nowrap"
                        @click="openPdfPreview(item.reportAttachments, item.work_order_no)"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        Preview Report
                      </button>
                      <span v-else class="text-text-muted">-</span>
                    </template>
                  </div>
                </template>
              </DataTable>
            </DetailCard>
          </div>
          
          <!-- Section: PDF Viewer (Attachments) -->
          <div class="bg-bg-surface border border-border rounded-lg p-6 shadow-sm">
            <h3 class="mt-0 mb-5 text-[1.15rem] font-semibold text-primary border-b border-border pb-2">{{ t('fai.attachment') }}</h3>
            <PdfViewer :files="attachments || []" :zipFilename="request ? `Attachments_${request.request_no}.zip` : 'attachments.zip'" />
          </div>
        </div>
      </div>

    <!-- Adjust Time Modal -->
    <BaseModal :isOpen="adjustTimeModalState.isOpen" :title="t('lab.adjust_time')" maxWidth="700px" @close="adjustTimeModalState.isOpen = false">
      <form id="adjustTimeForm" @submit.prevent="handleAdjustTime" class="flex flex-col gap-6">
        <div class="grid grid-cols-[1fr_2fr] gap-8 items-center pb-2 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('lab.test.estimated_date') }}</label>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-[1.4]">{{ t('lab.start_inspection_desc', 'Estimated completion date for testing') }}</p>
          </div>
          <div class="flex flex-col">
            <div class="flex gap-2">
              <Input 
                type="date"
                v-model="adjustTimeModalState.estimatedDate"
                class="flex-1"
              />
              <Input 
                type="time"
                v-model="adjustTimeModalState.estimatedTime"
                class="w-32"
              />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-[1fr_2fr] gap-8 items-center pb-2 border-b border-border">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('lab.test.receive_date') }}</label>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-[1.4]">{{ t('lab.test.receive_date_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <div class="flex gap-2">
              <Input 
                type="date"
                v-model="adjustTimeModalState.receiveDate"
                class="flex-1"
                :error="adjustTimeErrors.receiveDate ? 'error' : ''"
                :hideErrorText="true"
                @clear-error="clearAdjustTimeError('receiveDate')"
              />
              <Input 
                type="time"
                v-model="adjustTimeModalState.receiveTime"
                class="w-32"
                :error="adjustTimeErrors.receiveDate ? 'error' : ''"
                :hideErrorText="true"
                @clear-error="clearAdjustTimeError('receiveDate')"
              />
            </div>
            <p v-if="adjustTimeErrors.receiveDate" class="mt-1 text-sm text-danger">
              {{ adjustTimeErrors.receiveDate === 'Return date must be after or equal to receive date' ? adjustTimeErrors.receiveDate : t(adjustTimeErrors.receiveDate) }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-[1fr_2fr] gap-8 items-center pb-2">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('lab.test.return_date') }}</label>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-[1.4]">{{ t('lab.test.return_date_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <div class="flex gap-2">
              <Input 
                type="date"
                v-model="adjustTimeModalState.returnDate"
                class="flex-1"
                :error="adjustTimeErrors.returnDate ? 'error' : ''"
                :hideErrorText="true"
                @clear-error="clearAdjustTimeError('returnDate')"
              />
              <Input 
                type="time"
                v-model="adjustTimeModalState.returnTime"
                class="w-32"
                :error="adjustTimeErrors.returnDate ? 'error' : ''"
                :hideErrorText="true"
                @clear-error="clearAdjustTimeError('returnDate')"
              />
            </div>
            <p v-if="adjustTimeErrors.returnDate" class="mt-1 text-sm text-danger">
              {{ adjustTimeErrors.returnDate === 'Return date must be after or equal to receive date' ? t('lab.test.error.return_date_invalid') : t('lab.test.error.return_date_invalid') }}
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-6 border-t border-border">
          <Button type="button" variant="secondary" @click="adjustTimeModalState.isOpen = false">{{ t('action.cancel') }}</Button>
          <Button type="submit" variant="primary" :loading="isSaving" class="min-w-[100px]">{{ t('action.save') }}</Button>
        </div>
      </form>
    </BaseModal>

    <!-- Preview PDF Modal -->
    <BaseModal :isOpen="previewPdfModalState.isOpen" title="Preview Report" maxWidth="1000px" @close="previewPdfModalState.isOpen = false">
      <div class="-mx-8 -my-6 h-[80vh] flex flex-col">
        <PdfViewer :files="previewPdfModalState.files" :zipFilename="previewPdfModalState.zipFilename" class="h-full border-none rounded-none w-full !max-h-full" />
      </div>
    </BaseModal>

    <!-- Confirm Cancel Modal -->
    <ConfirmModal 
      :isOpen="cancelConfirmModalState.isOpen" 
      title="Discard Changes" 
      message="Are you sure you want to discard your unsaved changes?" 
      confirmText="Yes, Discard" 
      cancelText="No, Keep Editing" 
      :isDanger="true" 
      @confirm="confirmCancelEdit" 
      @cancel="cancelConfirmModalState.isOpen = false" 
    />

  </div>
  </div>
</template>

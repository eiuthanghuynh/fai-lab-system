<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useAsyncState } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { formatDate } from '@/utils/dateFormatter';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';

import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ResultBadge from '@/components/common/ResultBadge.vue';
import ActionDropdown from '@/components/common/ActionDropdown.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import PdfViewer from '@/components/common/PdfViewer.vue';
import DirectUpload from '@/components/common/DirectUpload.vue';
import ImageSlideshow from '@/components/common/ImageSlideshow.vue';
import DetailCard from '@/components/common/DetailCard.vue';
import ApprovalModal from '@/components/lab/ApprovalModal.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import { useAuthStore } from '@/stores/auth';
import { useFormValidation } from '@/composables/useFormValidation';
import { toast } from 'vue-sonner';
import { z } from 'zod';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();

const requestId = route.params.id as string;

const request = ref<any>(null);
const attachments = ref<any[]>([]);
const workOrders = ref<any[]>([]);

const completeConfirmModalState = ref({ isOpen: false });
const isApprovalModalOpen = ref(false);

const canInspectLab = computed(() => authStore.hasPermission('INSPECT_LAB'));
const canAssignLab = computed(() => authStore.hasPermission('ASSIGN_LAB'));
const canApproveLab = computed(() => authStore.hasPermission('APPROVE_LAB_ENGINEER') || authStore.hasPermission('APPROVE_LAB_MANAGER'));
const isExecuteMode = computed(() => route.query.mode === 'execute' && !request.value?.complete_date);
const isAssignMode = computed(() => route.query.mode === 'assign');
const isApproveMode = computed(() => route.query.mode === 'approve');
const hasOwnedWorkOrders = computed(() => workOrders.value.some(wo => wo.technician_id === authStore.user?.id));

watch(() => request.value, (newReq) => {
  if (newReq && newReq.complete_date && route.query.mode === 'execute') {
    router.replace({ name: route.name as string, params: route.params, query: {} });
    toast.warning(t('lab.completed_warning_toast', 'Testing completed, editing is no longer allowed.'));
  }
});

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
  { key: 'work_order_no', label: t('lab.work_order.work_order_no'), sortable: true, minWidth: "120px", width: "120px", sticky: 'left' },
  { key: 'itemTest.name', label: t('lab.work_order.item_test'), sortable: false, minWidth: "180px", width: "180px" },
  { key: 'technician.full_name', label: t('lab.work_order.technician_name', 'Technician'), sortable: false, minWidth: "160px", width: "160px" },
  { key: 'quantity', label: t('lab.columns.quantity'), sortable: false },
  { key: 'product_sn', label: t('lab.columns.product_sn'), sortable: false, minWidth: "200px", width: "200px" },
  { key: 'procedure_condition', label: t('lab.work_order.procedure_condition'), sortable: false, minWidth: "200px", maxWidth: "800px"},
  { key: 'test_specification', label: t('lab.work_order.test_specification'), sortable: false, minWidth: "200px", maxWidth: "800px" },
  { key: 'remark', label: t('lab.work_order.goal_comments'), sortable: false, minWidth: "200px", maxWidth: "800px" },
  { key: 'failure_details', label: t('lab.work_order.failure_details', 'Failure Details'), sortable: false, minWidth: "375px", maxWidth: "750px" },
  { key: 'improvement_plan', label: t('lab.work_order.improvement_plan', 'Improvement Plan'), sortable: false, minWidth: "375px", maxWidth: "750px" },
  { key: 'status', label: t('lab.work_order.status'), sortable: false, sticky: 'right', minWidth: "100px", width: "100px" },
  { key: 'test_result', label: t('lab.work_order.test_result'), sortable: false, sticky: 'right', minWidth: "100px", width: "100px" },
  { key: 'report_attachment', label: t('lab.work_order.report_attachment', 'Report Attachment'), sortable: false, sticky: 'right', minWidth: "150px" }
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

const assignPriorityModalState = ref({
  isOpen: false,
  priority: 'Normal',
  priorityReason: ''
});

const priorityOptions = computed(() => [
  { value: 'Urgent', label: t('fai.priority_urgent') },
  { value: 'Normal', label: t('fai.priority_normal') }
]);

const openAssignPriorityModal = () => {
  assignPriorityModalState.value.priority = request.value?.priority || 'Normal';
  assignPriorityModalState.value.priorityReason = request.value?.priority_reason || '';
  assignPriorityModalState.value.isOpen = true;
};

const isAssigningPriority = ref(false);
const handleAssignPriority = async () => {
  try {
    const { priority, priorityReason } = assignPriorityModalState.value;
    if (!priority) {
      toast.error(t('form.required'));
      return;
    }
    if (priority === 'Urgent' && (!priorityReason || priorityReason.trim() === '')) {
      toast.error(t('form.required'));
      return;
    }
    isAssigningPriority.value = true;
    await api.post(`/lab/requests/${requestId}/assign`, { priority, priority_reason: priorityReason });
    toast.success(t('lab.set_priority_success'));
    assignPriorityModalState.value.isOpen = false;
    fetchDetail();
  } catch (e) {
    console.error(e);
    toast.error(t('lab.set_priority_failed'));
  } finally {
    isAssigningPriority.value = false;
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

const handleCompleteTestingClick = () => {
  if (workOrders.value.length === 0) {
    toast.error('Cannot complete testing because this request has no Work Orders.');
    return;
  }
  const allClosedAndTested = workOrders.value.every(wo => wo.status === 'Closed' && wo.test_result);
  if (!allClosedAndTested) {
    toast.error(t('lab.complete_testing_error'));
    return;
  }
  completeConfirmModalState.value.isOpen = true;
};

const isCompleting = ref(false);
const handleConfirmCompleteTesting = async () => {
  isCompleting.value = true;
  try {
    await api.post(`/lab/requests/${requestId}/complete-testing`);
    toast.success('Testing completed successfully');
    completeConfirmModalState.value.isOpen = false;
    fetchDetail();
  } catch (e: any) {
    toast.error(e.response?.data?.error || e.message || 'Lỗi hệ thống');
  } finally {
    isCompleting.value = false;
  }
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

const goBack = () => {
  if (window.history.state.back) {
    router.back();
  } else {
    router.push({ name: 'lab-request-list' });
  }
};

</script>

<template>
  <div class="h-full overflow-y-auto p-6 box-border">
    <div class="w-full max-w-[1550px] mx-auto flex flex-col gap-6">
      
      <!-- Header -->
      <div class="flex justify-between items-center border-b border-border pb-4">
        <div class="flex items-center gap-6">
          <Button variant="secondary" class="gap-2" @click="goBack">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {{ t('fai.back_to_list', 'Back to List') }}
          </Button>
          <div class="flex flex-col">
            <h2 class="m-0 text-2xl font-bold text-text">{{ t('lab.detail_title') }} <span v-if="request">#{{ request.id }}</span></h2>
            <div v-if="request" class="flex items-center gap-4 text-xs font-medium text-text mt-1">
              <div class="flex items-center gap-2">
                <span class="text-text-muted">{{ t('fai.columns.status') }}:</span>
                <StatusBadge 
                  :isActive="true" 
                  :activeText="request.status" 
                  inactiveText="" 
                  :variant="getStatusVariant(request.status)"
                  class="!px-2 !py-0.5 !text-[11px] !h-5 flex items-center"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-text-muted">{{ t('fai.columns.result') }}:</span>
                <ResultBadge 
                  :result="request.result" 
                  class="!px-2 !py-0.5 !text-[11px] !w-12 !h-5 !rounded-[6px]"
                />
              </div>
            </div>
          </div>
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
                <template #action>
                  <Button
                    v-if="isApproveMode && canApproveLab && request?.complete_date && request?.result !== 'PASS' && request?.result !== 'FAIL'"
                    variant="danger"
                    class="h-8 text-xs font-semibold px-3"
                    @click="isApprovalModalOpen = true"
                  >
                    {{ t('approval.lab.approve_request') }}
                  </Button>
                </template>
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

                  <!-- Approval Logs -->
                  <div v-if="request.approvalLogs && request.approvalLogs.length > 0" class="col-span-1 sm:col-span-2 border-t border-border pt-4 mt-2 flex flex-col gap-3">
                    <span class="text-[0.8rem] font-bold text-text uppercase tracking-wider">{{ t('approval.lab.approval_status', 'Approval Status') }}</span>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div v-for="log in request.approvalLogs" :key="log.id" class="p-3 rounded border border-border bg-bg/50">
                        <div class="flex items-center justify-between gap-2 mb-1.5">
                          <span class="text-xs font-semibold text-text">
                            {{ log.role === 'APPROVE_LAB_ENGINEER' ? t('approval.lab.lab_engineer_approval') : t('approval.lab.quality_manager_approval') }}
                          </span>
                          <span :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase', log.action === 'Approved' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger']">
                            {{ log.action === 'Approved' ? t('approval.lab.approved') : t('approval.lab.rejected') }}
                          </span>
                        </div>
                        <div class="text-xs text-text-muted">
                          <div>{{ log.approver?.full_name || log.approver?.username }} - {{ formatDate(log.created_at) }}</div>
                          <div v-if="log.comment" class="mt-1 italic text-text">"{{ log.comment }}"</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DetailCard>

              <!-- Card 2: Sample & Schedule Info -->
              <DetailCard title="Sample & Schedule">
                <template #action>
                  <div class="flex gap-2">
                    <Button 
                      v-if="isAssignMode && canAssignLab"
                      variant="primary" 
                      class="h-8 text-xs font-semibold px-3" 
                      @click="openAssignPriorityModal"
                    >
                      {{ t('lab.set_priority') }}
                    </Button>
                    <Button 
                      v-if="canInspectLab && hasOwnedWorkOrders && isExecuteMode"
                      variant="danger" 
                      class="h-8 text-xs font-semibold px-3" 
                      @click="handleCompleteTestingClick"
                    >
                      {{ t('lab.complete_testing') }}
                    </Button>
                    <Button 
                      v-if="canInspectLab && hasOwnedWorkOrders && isExecuteMode"
                      variant="primary" 
                      class="h-8 text-xs font-semibold px-3" 
                      @click="openAdjustTimeModal"
                    >
                      {{ t('lab.adjust_time') }}
                    </Button>
                  </div>
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
                    <span class="text-[0.95rem] font-medium break-all whitespace-pre-wrap" :class="{'text-[#ff5555]': request.priority === 'Urgent', 'text-text': request.priority !== 'Urgent'}">{{ request.priority_reason || '-' }}</span>
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
                    <template v-if="isAssignMode && canAssignLab">
                      <div class="relative group inline-block">
                        <Button 
                          variant="primary" 
                          class="h-8 text-xs font-semibold px-3" 
                          @click="handleStartAssignWO"
                          :disabled="!request?.priority"
                        >
                          {{ t('lab.assign_technician') }}
                        </Button>
                        <div 
                          v-if="!request?.priority"
                          class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-[0.7rem] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
                        >
                          {{ t('lab.set_priority_block') }}
                        </div>
                      </div>
                    </template>
                    <div v-if="isExecuteMode && canInspectLab && hasOwnedWorkOrders" class="relative group inline-block">
                      <Button 
                        variant="primary" 
                        class="h-8 text-xs font-semibold px-3" 
                        @click="handleStartExecuteWO"
                        :disabled="!request?.estimated_date"
                      >
                        {{ t('action.edit') }} Work Order
                      </Button>
                      <div 
                        v-if="!request?.estimated_date"
                        class="absolute -bottom-14 right-0 whitespace-nowrap bg-gray-800 text-white text-[0.75rem] px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none shadow-lg w-max text-center"
                        v-html="t('lab.edit_wo_block')"
                      >
                      </div>
                    </div>
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
                  <Input v-if="editingType === 'execute' && isOwner(item)" v-model="item.product_sn" />
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
                  <ResultBadge v-else :result="item.test_result" />
                </template>

                <template #cell-failure_details="{ item }">
                  <div class="flex flex-col gap-2">
                    <Textarea v-if="editingType === 'execute' && isOwner(item)" v-model="item.failure_details" class="w-full min-w-[320px] text-sm" rows="5" />
                    <span v-else class="whitespace-pre-line text-sm text-text">{{ item.failure_details || '-' }}</span>
                    
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
                    <Textarea v-if="editingType === 'execute' && isOwner(item)" v-model="item.improvement_plan" class="w-full min-w-[320px] text-sm" rows="5" />
                    <span v-else class="whitespace-pre-line text-sm text-text">{{ item.improvement_plan || '-' }}</span>
                    
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
            <PdfViewer :files="attachments || []" :zipFilename="request ? `Attachments_${request.test_no}.zip` : 'attachments.zip'" />
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

    <!-- Confirm Complete Testing Modal -->
    <ConfirmModal 
      :isOpen="completeConfirmModalState.isOpen" 
      :title="t('lab.complete_testing')" 
      message="" 
      :confirmText="t('common.confirm')" 
      :cancelText="t('common.cancel')" 
      :isDanger="true" 
      @confirm="handleConfirmCompleteTesting" 
      @cancel="completeConfirmModalState.isOpen = false" 
    >
      <template #default>
        <div class="text-text flex flex-col gap-2 m-0 mb-6">
          <span>{{ t('lab.confirm_complete_testing_message') }}</span>
          <span class="text-[#ff5555] font-bold">{{ t('lab.confirm_complete_testing_warning') }}</span>
        </div>
      </template>
    </ConfirmModal>

    <!-- Approval Modal -->
    <ApprovalModal
      :isOpen="isApprovalModalOpen"
      :requestId="request?.id"
      :approvalLogs="request?.approvalLogs"
      @close="isApprovalModalOpen = false"
      @success="fetchDetail"
    />

  </div>
    <!-- Set Priority Modal -->
    <BaseModal :isOpen="assignPriorityModalState.isOpen" :title="t('lab.set_priority_title')" maxWidth="690px" @close="assignPriorityModalState.isOpen = false">
      <form id="assignPriorityForm" @submit.prevent="handleAssignPriority" class="flex flex-col gap-6">
        <div class="grid grid-cols-[1fr_1.5fr] gap-8 items-center pb-2">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('fai.priority') }}</label>
              <span class="text-[0.7rem] px-1.5 py-0.5 bg-[rgba(99,224,121,0.15)] text-primary rounded font-semibold leading-none">{{ t('form.required') }}</span>
            </div>
            <p class="text-[0.8rem] text-text-muted m-0 leading-[1.4]">{{ t('lab.set_priority_desc') }}</p>
          </div>
          <div class="flex flex-col">
            <SingleSelectDropdown 
              v-model="assignPriorityModalState.priority" 
              :options="priorityOptions" 
              :placeholder="t('form.required')" 
            />
          </div>
        </div>
        
        <div v-if="assignPriorityModalState.priority === 'Urgent'" class="grid grid-cols-[1fr_1.5fr] gap-8 items-start pb-2">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <label class="font-semibold text-text m-0">{{ t('fai.priority_reason') }}</label>
              <span class="text-[0.7rem] px-1.5 py-0.5 bg-[rgba(99,224,121,0.15)] text-primary rounded font-semibold leading-none">{{ t('form.required') }}</span>
            </div>
          </div>
          <div class="flex flex-col">
            <Textarea 
              v-model="assignPriorityModalState.priorityReason"
              :placeholder="t('form.required')"
              :rows="3"
            />
          </div>
        </div>
      </form>
      <template #footer>
        <Button type="button" variant="secondary" @click="assignPriorityModalState.isOpen = false">{{ t('action.cancel') }}</Button>
        <Button type="submit" form="assignPriorityForm" :loading="isAssigningPriority">
          {{ t('action.save') }}
        </Button>
      </template>
    </BaseModal>
  </div>
</template>

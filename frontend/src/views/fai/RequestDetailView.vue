<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAsyncState } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { formatDate } from '@/utils/dateFormatter';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import PdfViewer from '@/components/common/PdfViewer.vue';
import DetailCard from '@/components/common/DetailCard.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import Button from '@/components/ui/Button.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const request = ref<any>(null);

const errorMsg = ref('');

const checklistItems = [
  { key: 'psw', label: 'Part Submission Warrant (PSW)' },
  { key: 'drawing', label: 'Drawing' },
  { key: 'dfm', label: 'Design for Manufacturability' },
  { key: 'samples', label: 'Part Samples' },
  { key: 'specification', label: 'Specification Conformance Report' },
  { key: 'reliability', label: 'Reliability Test Report' },
  { key: 'material_cert', label: 'Material Certification' },
  { key: 'sample_cert', label: 'Sample Certificate of Conformance' },
  { key: 'msds', label: 'Material Safety Data Sheet' },
  { key: 'rohs', label: 'RoHS Test Report' },
  { key: 'declaration', label: 'Declaration of Environmental Compliance' },
  { key: 'safety', label: 'Safety Certification Data' },
  { key: 'packaging', label: 'Packaging and Delivery Methods' },
  { key: 'flow_diagram', label: 'Process Flow Diagram' },
  { key: 'control_plan', label: 'Process Control Plan' },
  { key: 'cpk', label: 'The CPK of Key Dimension' },
  { key: 'deviation', label: 'Deviation List' },
  { key: 'validate_report', label: 'Process Validate Report' }
];

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


const formatOrdinal = (n: number) => {
  if (!n) return '-';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const { isLoading, execute: fetchRequestDetails } = useAsyncState(async () => {
  errorMsg.value = '';
  const id = route.params.id;
  const res = await api.get(`/fai/${id}`);
  if (res.data && res.data.success) {
    request.value = res.data.data;
  } else {
    errorMsg.value = 'Failed to load request details.';
  }
}, null, { 
  immediate: false,
  resetOnExecute: false,
  onError: (err: any) => {
    console.error('Fetch request detail error:', err);
    if (err.response?.status === 403) {
      router.push({ name: 'unauthorized' });
    } else if (err.response?.status === 404) {
      router.push({ name: 'not-found' });
    } else {
      errorMsg.value = err.response?.data?.error || 'Failed to load request details.';
    }
  }
});

onMounted(() => {
  fetchRequestDetails();
});

const goBack = () => {
  if (window.history.state.back) {
    router.back();
  } else {
    router.push({ name: 'fai-request-list' });
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
            {{ t('fai.back_to_list') }}
          </Button>
          <h2 class="m-0 text-2xl font-bold text-text">{{ t('fai.detail_title') }} <span v-if="request">#{{ request.id }}</span></h2>
        </div>
        
        <div v-if="request" class="flex items-center">
          <StatusBadge 
            :isActive="request.status !== 'Draft'" 
            :activeText="getStatusText(request.status)" 
            :inactiveText="t('fai.status_draft')" 
            :variant="getStatusVariant(request.status)"
          />
        </div>
      </div>

      <!-- Loading and Error States -->
      <div v-if="isLoading && !request" class="flex flex-col items-center justify-center p-20 bg-bg-surface border border-border rounded-lg text-text-muted">
        <div class="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin mb-4"></div>
        <p>Loading request details...</p>
      </div>

      <div v-else-if="errorMsg" class="flex flex-col items-center justify-center p-20 bg-bg-surface border border-border rounded-lg text-[#ef4444]">
        <p class="mb-4">{{ errorMsg }}</p>
        <Button @click="fetchRequestDetails">Retry</Button>
      </div>

      <!-- Detail Content -->
      <div v-else-if="request" class="flex flex-col gap-6">
        <div class="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
          
          <!-- Column Left -->
          <div class="flex flex-col gap-6">
            
            <!-- Card 1: General Information -->
            <DetailCard :title="t('fai.general_information')">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Test No.</span>
                  <span class="text-[0.95rem] font-mono text-primary break-all">{{ request.test_no || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Requestor Name</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.requestor?.full_name || request.requestor?.username || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Project Name</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.project_name || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Part Number</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.part_no || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Part Name</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.part_name || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Part Revision</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.revision || '-' }}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-[0.75rem] font-bold text-text-muted uppercase tracking-wider">{{ t('fai.form.supplier_name', 'Supplier Name') }}</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.supplier?.name || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Supplier Address</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.address || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Commodity Part</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.commodityPartRel?.name || request.commodity_part || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Shipment Tracking No.</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.tracking_no || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">R&D Person In Charge</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.person_in_charge || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Part Type</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.part_type || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Reason for Submission</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.reason_for_submission || '-' }}</span>
                </div>
              </div>
            </DetailCard>

            <!-- Card 2: Sample & Schedule Info -->
            <DetailCard title="Sample & Schedule">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Sample Qty</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.sample_qty || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Submission Time</span>
                  <span class="text-[0.95rem] text-text break-all">{{ formatOrdinal(request.submission_time) }}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">{{ t('fai.priority') }}</label>
                  <span class="text-[0.95rem] font-medium" :class="{'text-[#ff5555]': request.priority === 'Urgent', 'text-text': request.priority !== 'Urgent'}">{{ request.priority || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">{{ t('fai.priority_reason') }}</label>
                  <span class="text-[0.95rem] font-medium break-all" :class="{'text-[#ff5555]': request.priority === 'Urgent', 'text-text': request.priority !== 'Urgent'}">{{ request.priority_reason || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Week</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.week_no || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Receive Date</span>
                  <span class="text-[0.95rem] text-text break-all">{{ formatDate(request.receive_date) }}</span>
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

          <!-- Column Right -->
          <div class="flex flex-col gap-6">

            <!-- Card 3: Inspection Result -->
            <DetailCard title="Inspection Result">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Inspector Name</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.inspector?.full_name || request.inspector?.username || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Result</span>
                  <span class="text-[0.95rem] break-all" :class="{'text-emerald-500 font-bold': request.result === 'PASS', 'text-red-500 font-bold': request.result === 'FAIL', 'text-text': !['PASS', 'FAIL'].includes(request.result)}">{{ request.result || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">FAI Failure Mode</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.faiFailureModeRel?.issue || request.fai_failure_mode || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5 col-span-full">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Failure Details</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.failure_details || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5 col-span-full">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Improvement Plan</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.improvement_plan || '-' }}</span>
                </div>
                <div class="flex flex-col gap-1.5 col-span-full">
                  <span class="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">Remark</span>
                  <span class="text-[0.95rem] text-text break-all">{{ request.remark || '-' }}</span>
                </div>
              </div>
            </DetailCard>

            <!-- Card 4: Submission Contents Checklist -->
            <DetailCard :title="t('fai.submission_contents')">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-5">
                <div 
                  v-for="item in checklistItems" 
                  :key="item.key" 
                  class="flex items-start gap-2 text-text-muted text-base"
                  :class="{ 'text-text font-medium': request.submission_contents?.[item.key] }"
                >
                  <span class="w-4 h-4 flex items-center justify-center rounded bg-border text-text-muted mt-0.5 shrink-0" :class="{ 'bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/25 dark:text-emerald-400': request.submission_contents?.[item.key] }">
                    <svg v-if="request.submission_contents?.[item.key]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5 opacity-40">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </span>
                  <span class="leading-snug">{{ item.label }}</span>
                </div>
              </div>
            </DetailCard>
            
          </div>
          
        </div>

        <!-- Section: PDF Viewer (Attachments) -->
        <div class="bg-bg-surface border border-border rounded-lg p-6 shadow-sm">
          <h3 class="mt-0 mb-5 text-[1.15rem] font-semibold text-primary border-b border-border pb-2">{{ t('fai.attachment') }}</h3>
          <PdfViewer :files="request.attachments || []" />
        </div>

      </div>
    </div>
  </div>
</template>



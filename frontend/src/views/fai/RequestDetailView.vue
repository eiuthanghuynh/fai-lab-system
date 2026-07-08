<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import PdfViewer from '@/components/common/PdfViewer.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const request = ref<any>(null);
const isLoading = ref(true);
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

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatOrdinal = (n: number) => {
  if (!n) return '-';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const fetchRequestDetails = async () => {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const id = route.params.id;
    const res = await api.get(`/fai/${id}`);
    if (res.data && res.data.success) {
      request.value = res.data.data;
    } else {
      errorMsg.value = 'Failed to load request details.';
    }
  } catch (err: any) {
    console.error('Fetch request detail error:', err);
    if (err.response?.status === 404) {
      router.push({ name: 'not-found' });
    } else {
      errorMsg.value = err.response?.data?.error || 'Failed to load request details.';
    }
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchRequestDetails();
});
</script>

<template>
  <div class="request-detail-page">
    <div class="detail-container">
      
      <!-- Header -->
      <div class="header-section">
        <div class="header-left">
          <button type="button" class="btn-back" @click="router.push({ name: 'fai-request-list' })">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-back">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {{ t('fai.back_to_list') }}
          </button>
          <h2>{{ t('fai.detail_title') }} <span v-if="request">#{{ request.id }}</span></h2>
        </div>
        
        <div v-if="request" class="header-right">
          <StatusBadge 
            :isActive="request.status !== 'Draft'" 
            :activeText="getStatusText(request.status)" 
            :inactiveText="t('fai.status_draft')" 
            :variant="getStatusVariant(request.status)"
          />
        </div>
      </div>

      <!-- Loading and Error States -->
      <div v-if="isLoading" class="state-container">
        <div class="loading-spinner"></div>
        <p>Loading request details...</p>
      </div>

      <div v-else-if="errorMsg" class="state-container error">
        <p class="error-text">{{ errorMsg }}</p>
        <button type="button" class="btn-primary" @click="fetchRequestDetails">Retry</button>
      </div>

      <!-- Detail Content -->
      <div v-else-if="request" class="detail-content">
        <div class="info-layout">
          
          <!-- Column Left -->
          <div class="flex flex-col gap-6">
            
            <!-- Card 1: General Information -->
            <div class="card">
              <h3>{{ t('fai.general_information') }}</h3>
              <div class="info-grid">
                <div class="info-group">
                  <span class="info-label">Requestor Name</span>
                  <span class="info-value">{{ request.requestor?.full_name || request.requestor?.username || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Project Name</span>
                  <span class="info-value">{{ request.project_name || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Part Number</span>
                  <span class="info-value">{{ request.part_no || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Part Name</span>
                  <span class="info-value">{{ request.part_name || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Part Revision</span>
                  <span class="info-value">{{ request.revision || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Supplier Name</span>
                  <span class="info-value">{{ request.supplier_name || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Supplier Address</span>
                  <span class="info-value">{{ request.address || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Commodity Part</span>
                  <span class="info-value">{{ request.commodityPartRel?.name || request.commodity_part || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Shipment Tracking No.</span>
                  <span class="info-value">{{ request.tracking_no || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">R&D Person In Charge</span>
                  <span class="info-value">{{ request.person_in_charge || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Part Type</span>
                  <span class="info-value">{{ request.part_type || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Reason for Submission</span>
                  <span class="info-value">{{ request.reason_for_submission || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- Card 2: Sample & Schedule Info -->
            <div class="card">
              <h3>Sample & Schedule</h3>
              <div class="info-grid">
                <div class="info-group">
                  <span class="info-label">Sample Qty</span>
                  <span class="info-value">{{ request.sample_qty || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Submission Time</span>
                  <span class="info-value">{{ formatOrdinal(request.submission_time) }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Priority</span>
                  <span class="info-value">{{ request.priority || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Week</span>
                  <span class="info-value">{{ request.week_no || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Receive Date</span>
                  <span class="info-value">{{ formatDate(request.receive_date) }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Estimated Date</span>
                  <span class="info-value">{{ formatDate(request.estimated_date) }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Complete Date</span>
                  <span class="info-value">{{ formatDate(request.complete_date) }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Created At</span>
                  <span class="info-value">{{ formatDate(request.created_at) }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Updated At</span>
                  <span class="info-value">{{ formatDate(request.updated_at) }}</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Column Right -->
          <div class="flex flex-col gap-6">

            <!-- Card 3: Inspection Result -->
            <div class="card">
              <h3>Inspection Result</h3>
              <div class="info-grid">
                <div class="info-group">
                  <span class="info-label">Inspector Name</span>
                  <span class="info-value">{{ request.inspector?.full_name || request.inspector?.username || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">Result</span>
                  <span class="info-value" :class="{'text-green-600 dark:text-green-400 font-bold': request.result === 'PASS', 'text-red-600 dark:text-red-400 font-bold': request.result === 'FAIL'}">{{ request.result || '-' }}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">FAI Failure Mode</span>
                  <span class="info-value">{{ request.faiFailureModeRel?.issue || request.fai_failure_mode || '-' }}</span>
                </div>
                <div class="info-group" style="grid-column: 1 / -1;">
                  <span class="info-label">Failure Details</span>
                  <span class="info-value">{{ request.failure_details || '-' }}</span>
                </div>
                <div class="info-group" style="grid-column: 1 / -1;">
                  <span class="info-label">Improvement Plan</span>
                  <span class="info-value">{{ request.improvement_plan || '-' }}</span>
                </div>
                <div class="info-group" style="grid-column: 1 / -1;">
                  <span class="info-label">Remark</span>
                  <span class="info-value">{{ request.remark || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- Card 4: Submission Contents Checklist -->
            <div class="card">
              <h3>{{ t('fai.submission_contents') }}</h3>
              <div class="checklist-grid">
                <div 
                  v-for="item in checklistItems" 
                  :key="item.key" 
                  class="checklist-item-read"
                  :class="{ active: request.submission_contents?.[item.key] }"
                >
                  <span class="status-icon" :class="{ checked: request.submission_contents?.[item.key] }">
                    <svg v-if="request.submission_contents?.[item.key]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="icon-check">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-cross">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </span>
                  <span class="label-text">{{ item.label }}</span>
                </div>
              </div>
            </div>
            
          </div>
          
        </div>

        <!-- Section: PDF Viewer (Attachments) -->
        <div class="attachments-section card">
          <h3>{{ t('fai.attachment') }}</h3>
          <PdfViewer :files="request.attachments || []" />
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.request-detail-page {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
  box-sizing: border-box;
}

.detail-container {
  width: 100%;
  max-width: 1550px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header Styles */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.header-left h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
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

/* State Handlers (Loading, Error) */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
}

.state-container.error {
  color: #ef4444;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Content Layout */
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-layout {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 1024px) {
  .info-layout {
    grid-template-columns: 1fr;
  }
}

.card {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.card h3 {
  margin-top: 0;
  margin-bottom: 1.25rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-primary);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
}

@media (max-width: 640px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

.info-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.info-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.95rem;
  color: var(--color-text);
  word-break: break-all;
}

.info-value.highlight {
  font-weight: 700;
  color: var(--color-primary);
}

html.dark .info-value.highlight {
  color: #38bdf8;
}

/* Checklist Display */
.checklist-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem 1.2rem;
}

@media (max-width: 640px) {
  .checklist-grid {
    grid-template-columns: 1fr;
  }
}

.checklist-item-read {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  color: var(--color-text-muted);
  font-size: 1rem;
}

.checklist-item-read.active {
  color: var(--color-text);
  font-weight: 500;
}

.status-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background-color: var(--color-border);
  color: var(--color-text-muted);
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.status-icon.checked {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

html.dark .status-icon.checked {
  background-color: rgba(16, 185, 129, 0.25);
  color: #34d399;
}

.icon-check {
  width: 12px;
  height: 12px;
}

.icon-cross {
  width: 10px;
  height: 10px;
  opacity: 0.4;
}

.label-text {
  line-height: 1.3;
}
</style>

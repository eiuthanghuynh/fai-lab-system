<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { toast } from 'vue-sonner';
import CustomDropdown from '@/components/CustomDropdown.vue';


const router = useRouter();
const route = useRoute();
const { t } = useI18n();

// Form Fields
const requestId = ref<number | null>(null);
const projectName = ref('');
const partNo = ref('');
const partName = ref('');
const revision = ref('');
const supplierName = ref('');
const address = ref('');
const commodityPart = ref<number | ''>('');
const commodityPartOptions = ref<{ value: number, label: string }[]>([]);
const personInCharge = ref('');
const trackingNo = ref('');
const sampleQty = ref<number>(1);
const submissionTime = ref<number>(1);

// Checkbox selections
const partType = ref(''); // tooling, cnc, mags, others
const partTypeOthersText = ref('');

const reasonForSubmission = ref(''); // initial, eco, process, others
const reasonOthersText = ref('');

const submissionContents = ref<Record<string, boolean>>({
  psw: false,
  rohs: false,
  drawing: false,
  declaration: false,
  dfm: false,
  safety: false,
  samples: false,
  packaging: false,
  specification: false,
  flow_diagram: false,
  reliability: false,
  control_plan: false,
  material_cert: false,
  cpk: false,
  sample_cert: false,
  deviation: false,
  msds: false,
  validate_report: false
});

// File Upload Status
const fileIds = ref<number[]>([]);
const uploadedFiles = ref<any[]>([]);
const isUploading = ref(false);
const uploadProgress = ref(0);

// Status indicator
const saveStatus = ref(''); // 'saving', 'saved', 'error', ''
const idempotencyKey = ref('');

// Generate unique idempotency key
const generateIdempotencyKey = () => {
  return 'idemp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

// Handle file upload
const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  isUploading.value = true;
  uploadProgress.value = 10;
  
  const formData = new FormData();
  for (let i = 0; i < target.files.length; i++) {
    formData.append('files', target.files[i] as File);
  }

  try {
    uploadProgress.value = 30;
    const res = await api.post('/fai/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        }
      }
    });
    
    uploadProgress.value = 100;
    const files = res.data.files;
    files.forEach((f: any) => {
      fileIds.value.push(f.id);
      uploadedFiles.value.push(f);
    });
  } catch (err) {
    console.error('File upload failed:', err);
    alert('Failed to upload files. Please try again.');
  } finally {
    setTimeout(() => {
      isUploading.value = false;
      uploadProgress.value = 0;
    }, 1000);
  }
};

const removeFile = (index: number) => {
  fileIds.value.splice(index, 1);
  uploadedFiles.value.splice(index, 1);
};

const saveAsDraft = async () => {
  saveStatus.value = 'saving';
  try {
    const payload = {
      id: requestId.value,
      project_name: projectName.value,
      part_no: partNo.value,
      part_name: partName.value,
      revision: revision.value,
      supplier_name: supplierName.value,
      address: address.value,
      commodity_part: commodityPart.value,
      person_in_charge: personInCharge.value,
      tracking_no: trackingNo.value,
      sample_qty: sampleQty.value,
      submission_time: submissionTime.value,
      part_type: partType.value === 'Others' ? partTypeOthersText.value : partType.value,
      reason_for_submission: reasonForSubmission.value === 'Others' ? reasonOthersText.value : reasonForSubmission.value,
      submission_contents: submissionContents.value,
      file_ids: fileIds.value,
      idempotency_key: idempotencyKey.value
    };
    
    const res = await api.post('/fai/draft', payload);
    if (res.data.success) {
      requestId.value = res.data.data.id;
      toast.success(t('fai.draft_saved') || 'Draft saved successfully');
      setTimeout(() => { 
        saveStatus.value = ''; 
        router.push('/fai/request/list');
      }, 1000);
    } else {
      toast.error(t('fai.draft_error') || 'Draft save error');
    }
  } catch (err) {
    console.error('Save draft failed:', err);
    toast.error(t('fai.draft_error') || 'Draft save error');
  } finally {
    saveStatus.value = '';
  }
};

// Final Submission
const submitForm = async () => {
  if (!partNo.value || !partName.value || !supplierName.value || !revision.value || !address.value || !commodityPart.value || !personInCharge.value) {
    toast.error('Please fill out all required fields.');
    return;
  }

  try {
    const payload = {
      id: requestId.value,
      project_name: projectName.value,
      part_no: partNo.value,
      part_name: partName.value,
      revision: revision.value,
      supplier_name: supplierName.value,
      address: address.value,
      commodity_part: commodityPart.value,
      person_in_charge: personInCharge.value,
      tracking_no: trackingNo.value,
      sample_qty: sampleQty.value,
      submission_time: submissionTime.value,
      part_type: partType.value === 'Others' ? partTypeOthersText.value : partType.value,
      reason_for_submission: reasonForSubmission.value === 'Others' ? reasonOthersText.value : reasonForSubmission.value,
      submission_contents: submissionContents.value,
      file_ids: fileIds.value,
      idempotency_key: idempotencyKey.value
    };

    const res = await api.post('/fai', payload);
    if (res.data.success) {
      toast.success(t('toast.create_success'));
      router.push({ name: 'fai-request-list' });
    } else {
      toast.error(t('toast.action_failed'));
    }
  } catch (err) {
    console.error('Submit FAI Request failed:', err);
    toast.error(t('toast.action_failed'));
  }
};

// Load existing draft if editing
onMounted(async () => {
  idempotencyKey.value = generateIdempotencyKey();
  
  // Fetch commodity parts for dropdown
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

  const draftId = route.query.id;
  if (draftId) {
    try {
      const res = await api.get(`/fai/${draftId}`);
      const draft = res.data.data;
      if (draft && draft.status === 'Draft') {
        requestId.value = draft.id;
        projectName.value = draft.project_name || '';
        partNo.value = draft.part_no || '';
        partName.value = draft.part_name || '';
        revision.value = draft.revision || '';
        supplierName.value = draft.supplier_name || '';
        address.value = draft.address || '';
        commodityPart.value = draft.commodity_part || '';
        personInCharge.value = draft.person_in_charge || '';
        trackingNo.value = draft.tracking_no || '';
        sampleQty.value = draft.sample_qty || 1;
        submissionTime.value = draft.submission_time || 1;
        
        // Parse checkboxes
        if (draft.part_type) {
          if (['Tooling Sample', 'CNC Sample', 'Mags'].includes(draft.part_type)) {
            partType.value = draft.part_type;
          } else {
            partType.value = 'Others';
            partTypeOthersText.value = draft.part_type;
          }
        }
        
        if (draft.reason_for_submission) {
          if (['Initial Submission', 'ECO', 'Process'].includes(draft.reason_for_submission)) {
            reasonForSubmission.value = draft.reason_for_submission;
          } else {
            reasonForSubmission.value = 'Others';
            reasonOthersText.value = draft.reason_for_submission;
          }
        }

        if (draft.submission_contents) {
          submissionContents.value = {
            ...submissionContents.value,
            ...draft.submission_contents
          };
        }

        if (draft.attachments) {
          uploadedFiles.value = draft.attachments;
          fileIds.value = draft.attachments.map((att: any) => att.id);
        }
      }
    } catch (err) {
      console.error('Failed to load draft:', err);
    }
  }
});
</script>

<template>
  <div class="create-request-page">
    <div class="fai-form-container">
      <div class="header-section">
        <div class="header-left">
          <button type="button" class="btn-back" @click="router.push({ name: 'fai-request-list' })">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-back">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {{ t('fai.back_to_list') }}
          </button>
          <h1>{{ t('fai.form_title') }}</h1>
        </div>
        <span class="status-indicator" :class="saveStatus">
          <template v-if="saveStatus === 'saving'">{{ t('fai.saving_draft') }}</template>
        </span>
      </div>

      <form @submit.prevent="submitForm" class="fai-form">
        <div class="form-layout-grid">
          
          <!-- Left Column (Core Inputs + Types + Reasons) -->
          <div class="form-left-col">
            <!-- 3-Column Grid for Core Form Fields -->
            <div class="inputs-grid">
              <div class="form-group">
                <label>Project Name: <span class="required">*</span></label>
                <input type="text" v-model="projectName" :placeholder="t('fai.placeholder.project_name')" required />
              </div>
              <div class="form-group">
                <label>Part Number: <span class="required">*</span></label>
                <input type="text" v-model="partNo" :placeholder="t('fai.placeholder.part_no')" required />
              </div>
              <div class="form-group">
                <label>Part Name: <span class="required">*</span></label>
                <input type="text" v-model="partName" :placeholder="t('fai.placeholder.part_name')" required />
              </div>
              <div class="form-group">
                <label>Part Rev: <span class="required">*</span></label>
                <input type="text" v-model="revision" :placeholder="t('fai.placeholder.revision')" required />
              </div>
              <div class="form-group">
                <label>Supplier Name: <span class="required">*</span></label>
                <input type="text" v-model="supplierName" :placeholder="t('fai.placeholder.supplier_name')" required />
              </div>
              <div class="form-group">
                <label>Supplier Address: <span class="required">*</span></label>
                <input type="text" v-model="address" :placeholder="t('fai.placeholder.address')" required />
              </div>
              <div class="form-group">
                <label>Commodity Part: <span class="required">*</span></label>
                <CustomDropdown 
                  v-model="commodityPart" 
                  :options="commodityPartOptions" 
                  :placeholder="t('fai.placeholder.commodity_part')" 
                />
              </div>
              <div class="form-group">
                <label>R&D Person In Charge: <span class="required">*</span></label>
                <input type="text" v-model="personInCharge" :placeholder="t('fai.placeholder.person_in_charge')" required />
              </div>
              <div class="form-group">
                <label>Shipment Tracking No.:</label>
                <input type="text" v-model="trackingNo" :placeholder="t('fai.placeholder.tracking_no')" />
              </div>
              <div class="form-group">
                <label>Sample Quantity: <span class="required">*</span></label>
                <input type="number" v-model="sampleQty" min="1" max="20" required placeholder="1-20" />
                <input type="hidden" v-model="submissionTime" />
              </div>
            </div>

            <!-- Part Type Section -->
            <div class="checkbox-section">
              <h3>{{ t('fai.part_type') }}:</h3>
              <div class="checkbox-row">
                <label class="custom-checkbox">
                  <input type="radio" value="Tooling Sample" v-model="partType" />
                  <span>Tooling Sample</span>
                </label>
                <label class="custom-checkbox">
                  <input type="radio" value="CNC Sample" v-model="partType" />
                  <span>CNC Sample</span>
                </label>
                <label class="custom-checkbox">
                  <input type="radio" value="Mags" v-model="partType" />
                  <span>Mags</span>
                </label>
                <div style="display: flex; align-items: center;">
                  <label class="custom-checkbox align-center" style="margin: 0;">
                    <input type="radio" value="Others" v-model="partType" />
                    <span>Others:</span>
                  </label>
                  <input 
                    v-if="partType === 'Others'" 
                    type="text" 
                    :value="partTypeOthersText"
                    @input="partTypeOthersText = ($event.target as HTMLInputElement).value.toUpperCase()"
                    class="inline-input" 
                    :placeholder="t('fai.placeholder.specify')" 
                    required
                  />
                </div>
              </div>
            </div>

            <!-- Reason for Submission Section -->
            <div class="checkbox-section no-border">
              <h3>{{ t('fai.reason') }}:</h3>
              <div class="checkbox-row">
                <label class="custom-checkbox">
                  <input type="radio" value="Initial Submission" v-model="reasonForSubmission" />
                  <span>Initial Submission for This Part Number</span>
                </label>
                <label class="custom-checkbox">
                  <input type="radio" value="ECO" v-model="reasonForSubmission" />
                  <span>ECO</span>
                </label>
                <label class="custom-checkbox">
                  <input type="radio" value="Process" v-model="reasonForSubmission" />
                  <span>Process: Transfer, replacement, refurbishment etc.</span>
                </label>
                <div style="display: flex; align-items: center;">
                  <label class="custom-checkbox align-center" style="margin: 0;">
                    <input type="radio" value="Others" v-model="reasonForSubmission" />
                    <span>Others:</span>
                  </label>
                  <input v-if="reasonForSubmission === 'Others'" type="text" v-model="reasonOthersText" class="inline-input" :placeholder="t('fai.placeholder.specify')" required />
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column (Checklist + Attach Files) -->
          <div class="form-right-col">
            <!-- Submission Contents Checklist -->
            <div class="checklist-section">
              <h3>{{ t('fai.contents') }}:</h3>
              <div class="checklist-grid-compact">
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.psw" />
                  <span>Part Submission Warrant (PSW)</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.drawing" />
                  <span>Drawing</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.dfm" />
                  <span>Design for Manufacturability</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.samples" />
                  <span>Part Samples</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.specification" />
                  <span>Specification Conformance Report</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.reliability" />
                  <span>Reliability Test Report</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.material_cert" />
                  <span>Material Certification</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.sample_cert" />
                  <span>Sample Certificate of Conformance</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.msds" />
                  <span>Material Safety Data Sheet</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.rohs" />
                  <span>RoHS Test Report</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.declaration" />
                  <span>Declaration of Environmental Compliance</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.safety" />
                  <span>Safety Certification Data</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.packaging" />
                  <span>Packaging and Delivery Methods</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.flow_diagram" />
                  <span>Process Flow Diagram</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.control_plan" />
                  <span>Process Control Plan</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.cpk" />
                  <span>The CPK of Key Dimension</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.deviation" />
                  <span>Deviation List</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" v-model="submissionContents.validate_report" />
                  <span>Process Validate Report</span>
                </label>
              </div>
            </div>

            <!-- File Attachment Section -->
            <div class="file-section no-border">
              <h3>{{ t('fai.attach_files') }}:</h3>
              <div class="file-upload-box">
                <input type="file" multiple @change="handleFileUpload" id="file-input" class="hidden-file-input" />
                <label for="file-input" class="file-upload-btn">{{ t('fai.choose_files') }}</label>
                <span class="file-info" v-if="uploadedFiles.length === 0">{{ t('fai.no_file') }}</span>
                <div v-else class="uploaded-list">
                  <div v-for="(file, idx) in uploadedFiles" :key="idx" class="uploaded-item">
                    <span class="file-name">{{ file.file_name }}</span>
                    <button type="button" @click="removeFile(idx)" class="remove-btn">✕</button>
                  </div>
                </div>
              </div>
              <p class="file-helper">{{ t('fai.multiple_files') }}</p>

              <!-- Progress bar -->
              <div v-if="isUploading" class="progress-bar-wrapper">
                <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
              </div>
            </div>
          </div>
          
        </div>

        <!-- Action Buttons (Bottom-Right aligned) -->
        <div class="actions-section">
          <button type="button" @click="saveAsDraft" class="btn-draft">{{ t('fai.save_draft') }}</button>
          <button type="submit" class="btn-primary">{{ t('fai.submit') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.create-request-page {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
  box-sizing: border-box;
}

.fai-form-container {
  width: 100%;
  max-width: 1550px;
  min-height: 100%;
  padding: 1.5rem;
  background-color: var(--color-bg-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  margin: 0 auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.fai-form {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  margin: 0;
}

.header-section {
  padding: 1rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: 1.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
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

.header-section h1 {
  font-size: 1.5rem;
  margin: 0;
}

.status-indicator {
  font-size: 0.85rem;
  font-weight: 500;
}
.status-indicator.saving {
  color: #f59e0b;
}
.status-indicator.saved {
  color: var(--color-primary);
}
.status-indicator.error {
  color: #ef4444;
}

.form-layout-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 2rem;
  margin-bottom: 1.25rem;
}

@media (max-width: 1200px) {
  .form-layout-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}

.form-left-col, .form-right-col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.inputs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 640px) {
  .inputs-grid {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
}

.form-group input {
  padding: 0.25rem 1rem;
  height: 44px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 20px;
  outline: none;
  font-size: 1rem;
  transition: all 0.2s;
}

.form-group input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(99, 224, 121, 0.2);
}

.required {
  color: #ef4444;
}

.checkbox-section, .checklist-section, .file-section {
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.checkbox-section.no-border, .file-section.no-border {
  border-bottom: none;
  padding-bottom: 0;
}

.checkbox-section h3, .checklist-section h3, .file-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: 0.75rem;
  color: var(--color-text);
}

.checkbox-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.5rem;
}

.custom-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
}

.custom-checkbox input[type="radio"], .custom-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  margin: 0;
  flex-shrink: 0;
}

.custom-checkbox span {
  word-break: break-word;
  line-height: 1.25;
}

.align-center {
  align-items: center;
}

.inline-input {
  margin-left: 0.5rem;
  padding: 0.25rem 1rem;
  height: 44px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 20px;
  outline: none;
  font-size: 1rem;
  transition: all 0.2s;
}

.inline-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(99, 224, 121, 0.2);
}

.checklist-grid-compact {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.4rem 1.5rem;
}

@media (max-width: 640px) {
  .checklist-grid-compact {
    grid-template-columns: 1fr;
  }
}

.file-upload-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  background: var(--color-bg);
}

.hidden-file-input {
  display: none;
}

.file-upload-btn {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 0.4rem 0.85rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.file-upload-btn:hover {
  background-color: var(--color-border);
}

.file-info {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.uploaded-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.uploaded-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background-color: var(--color-border);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.remove-btn {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.8rem;
}

.file-helper {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.35rem;
  margin-bottom: 0;
}

.progress-bar-wrapper {
  margin-top: 0.5rem;
  background-color: var(--color-border);
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  background-color: var(--color-primary);
  height: 100%;
  transition: width 0.2s;
}

.actions-section {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.btn-draft {
  background-color: var(--color-border);
  color: var(--color-text-muted);
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color var(--transition-speed) ease;
}

.btn-draft:hover {
  background-color: #d1d5db;
}

html.dark .btn-draft:hover {
  background-color: #444444;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-bg-surface);
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color var(--transition-speed) ease;
}

.btn-primary:hover {
  filter: brightness(0.9);
}
</style>

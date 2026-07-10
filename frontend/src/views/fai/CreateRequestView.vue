<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { toast } from 'vue-sonner';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import Radio from '@/components/ui/Radio.vue';
import Checkbox from '@/components/ui/Checkbox.vue';

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
  <div class="h-full overflow-y-auto p-6 box-border">
    <div class="w-full max-w-[1550px] min-h-full p-6 bg-bg-surface rounded-lg border border-border shadow-sm mx-auto box-border flex flex-col">
      <div class="py-4 flex justify-between items-center border-b-2 border-border mb-6">
        <div class="flex items-center gap-4">
          <Button type="button" variant="secondary" class="gap-2" @click="router.push({ name: 'fai-request-list' })">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {{ t('fai.back_to_list') }}
          </Button>
          <h1 class="text-2xl m-0">{{ t('fai.form_title') }}</h1>
        </div>
        <span class="text-[0.85rem] font-medium" :class="{'text-[#f59e0b]': saveStatus === 'saving', 'text-primary': saveStatus === 'saved', 'text-[#ef4444]': saveStatus === 'error'}">
          <template v-if="saveStatus === 'saving'">{{ t('fai.saving_draft') }}</template>
        </span>
      </div>

      <form @submit.prevent="submitForm" class="flex flex-col grow m-0">
        <div class="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6 xl:gap-8 mb-5">
          
          <!-- Left Column (Core Inputs + Types + Reasons) -->
          <div class="flex flex-col gap-5">
            <!-- 3-Column Grid for Core Form Fields -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Project Name: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="projectName" :placeholder="t('fai.placeholder.project_name')" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Part Number: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="partNo" :placeholder="t('fai.placeholder.part_no')" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Part Name: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="partName" :placeholder="t('fai.placeholder.part_name')" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Part Rev: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="revision" :placeholder="t('fai.placeholder.revision')" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Supplier Name: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="supplierName" :placeholder="t('fai.placeholder.supplier_name')" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Supplier Address: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="address" :placeholder="t('fai.placeholder.address')" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Commodity Part: <span class="text-[#ef4444]">*</span></label>
                <SingleSelectDropdown 
                  v-model="commodityPart" 
                  :options="commodityPartOptions" 
                  :placeholder="t('fai.placeholder.commodity_part')" 
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">R&D Person In Charge: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="personInCharge" :placeholder="t('fai.placeholder.person_in_charge')" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Shipment Tracking No.:</label>
                <Input type="text" v-model="trackingNo" :placeholder="t('fai.placeholder.tracking_no')" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Sample Quantity: <span class="text-[#ef4444]">*</span></label>
                <Input type="number" v-model="sampleQty" min="1" max="20" required placeholder="1-20" />
                <input type="hidden" v-model="submissionTime" />
              </div>
            </div>

            <!-- Part Type Section -->
            <div class="pb-5 border-b border-border">
              <h3 class="text-base font-semibold mt-0 mb-3 text-text">{{ t('fai.part_type') }}:</h3>
              <div class="flex flex-wrap items-center gap-x-6 gap-y-4">
                <Radio value="Tooling Sample" v-model="partType">Tooling Sample</Radio>
                <Radio value="CNC Sample" v-model="partType">CNC Sample</Radio>
                <Radio value="Mags" v-model="partType">Mags</Radio>
                <div class="flex items-center gap-2">
                  <Radio value="Others" v-model="partType">Others:</Radio>
                  <Input 
                    v-if="partType === 'Others'" 
                    type="text" 
                    :value="partTypeOthersText"
                    @input="partTypeOthersText = ($event.target as HTMLInputElement).value.toUpperCase()"
                    :placeholder="t('fai.placeholder.specify')" 
                    required
                  />
                </div>
              </div>
            </div>

            <!-- Reason for Submission Section -->
            <div class="pb-0 border-b-0">
              <h3 class="text-base font-semibold mt-0 mb-3 text-text">{{ t('fai.reason') }}:</h3>
              <div class="flex flex-wrap items-center gap-x-6 gap-y-4">
                <Radio value="Initial Submission" v-model="reasonForSubmission">Initial Submission for This Part Number</Radio>
                <Radio value="ECO" v-model="reasonForSubmission">ECO</Radio>
                <Radio value="Process" v-model="reasonForSubmission">Process: Transfer, replacement, refurbishment etc.</Radio>
                <div class="flex items-center gap-2">
                  <Radio value="Others" v-model="reasonForSubmission">Others:</Radio>
                  <Input v-if="reasonForSubmission === 'Others'" type="text" v-model="reasonOthersText" :placeholder="t('fai.placeholder.specify')" required />
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column (Checklist + Attach Files) -->
          <div class="flex flex-col gap-5">
            <!-- Submission Contents Checklist -->
            <div class="pb-5 border-b border-border">
              <h3 class="text-base font-semibold mt-0 mb-3 text-text">{{ t('fai.contents') }}:</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                <Checkbox v-model="submissionContents.psw">Part Submission Warrant (PSW)</Checkbox>
                <Checkbox v-model="submissionContents.drawing">Drawing</Checkbox>
                <Checkbox v-model="submissionContents.dfm">Design for Manufacturability</Checkbox>
                <Checkbox v-model="submissionContents.samples">Part Samples</Checkbox>
                <Checkbox v-model="submissionContents.specification">Specification Conformance Report</Checkbox>
                <Checkbox v-model="submissionContents.reliability">Reliability Test Report</Checkbox>
                <Checkbox v-model="submissionContents.material_cert">Material Certification</Checkbox>
                <Checkbox v-model="submissionContents.sample_cert">Sample Certificate of Conformance</Checkbox>
                <Checkbox v-model="submissionContents.msds">Material Safety Data Sheet</Checkbox>
                <Checkbox v-model="submissionContents.rohs">RoHS Test Report</Checkbox>
                <Checkbox v-model="submissionContents.declaration">Declaration of Environmental Compliance</Checkbox>
                <Checkbox v-model="submissionContents.safety">Safety Certification Data</Checkbox>
                <Checkbox v-model="submissionContents.packaging">Packaging and Delivery Methods</Checkbox>
                <Checkbox v-model="submissionContents.flow_diagram">Process Flow Diagram</Checkbox>
                <Checkbox v-model="submissionContents.control_plan">Process Control Plan</Checkbox>
                <Checkbox v-model="submissionContents.cpk">The CPK of Key Dimension</Checkbox>
                <Checkbox v-model="submissionContents.deviation">Deviation List</Checkbox>
                <Checkbox v-model="submissionContents.validate_report">Process Validate Report</Checkbox>
              </div>
            </div>

            <!-- File Attachment Section -->
            <div class="pb-0 border-b-0">
              <h3 class="text-base font-semibold mt-0 mb-3 text-text">{{ t('fai.attach_files') }}:</h3>
              <div class="flex items-center gap-3 border border-border py-2 px-3 rounded bg-bg">
                <input type="file" multiple @change="handleFileUpload" id="file-input" class="hidden" />
                <label for="file-input" class="bg-bg-surface border border-border text-text py-1.5 px-3.5 rounded text-[0.85rem] font-medium cursor-pointer shadow-sm hover:bg-border">{{ t('fai.choose_files') }}</label>
                <span class="text-[0.85rem] text-text-muted" v-if="uploadedFiles.length === 0">{{ t('fai.no_file') }}</span>
                <div v-else class="flex flex-wrap gap-1.5">
                  <div v-for="(file, idx) in uploadedFiles" :key="idx" class="flex items-center gap-1.5 bg-border py-1 px-2 rounded text-[0.8rem]">
                    <span>{{ file.file_name }}</span>
                    <button type="button" @click="removeFile(idx)" class="bg-transparent border-none text-[#ef4444] cursor-pointer text-[0.8rem]">✕</button>
                  </div>
                </div>
              </div>
              <p class="text-[0.75rem] text-text-muted mt-1.5 mb-0">{{ t('fai.multiple_files') }}</p>

              <!-- Progress bar -->
              <div v-if="isUploading" class="mt-2 bg-border h-1 rounded-sm overflow-hidden">
                <div class="bg-primary h-full transition-[width] duration-200" :style="{ width: uploadProgress + '%' }"></div>
              </div>
            </div>
          </div>
          
        </div>

        <!-- Action Buttons (Bottom-Right aligned) -->
        <div class="flex justify-end gap-3 mt-auto pt-4 border-t border-border">
          <Button type="button" variant="secondary" @click="saveAsDraft">{{ t('fai.save_draft') }}</Button>
          <Button type="submit">{{ t('fai.submit') }}</Button>
        </div>
      </form>
    </div>
  </div>
</template>

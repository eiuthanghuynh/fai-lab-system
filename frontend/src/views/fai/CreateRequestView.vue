<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { z } from 'zod';
import { useFormValidation } from '@/composables/useFormValidation';
import { toast } from 'vue-sonner';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import Input from '@/components/ui/Input.vue';
import DirectUpload from '@/components/common/DirectUpload.vue';
import Button from '@/components/ui/Button.vue';
import Radio from '@/components/ui/Radio.vue';
import Checkbox from '@/components/ui/Checkbox.vue';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const { formErrors, validate, clearError, clearAllErrors } = useFormValidation();

const faiRequestSchema = z.object({
  project_name: z.string().min(1, 'error.required_field'),
  part_no: z.string().min(1, 'error.required_field'),
  part_name: z.string().min(1, 'error.required_field'),
  revision: z.string().min(1, 'error.required_field'),
  supplier_id: z.union([z.number(), z.string()]).refine(val => val !== '', 'error.required_field'),
  address: z.string().min(1, 'error.required_field'),
  commodity_part: z.union([z.number(), z.string()]).refine(val => val !== '', 'error.required_field'),
  person_in_charge: z.string().min(1, 'error.required_field'),
  sample_qty: z.number().min(3, 'error.sample_qty_fai_bounds').max(20, 'error.sample_qty_fai_bounds'),
  part_type: z.string().min(1, 'error.required_field').refine(val => val !== 'Others:', 'error.required_field'),
  reason_for_submission: z.string().min(1, 'error.required_field').refine(val => val !== 'Others:' && val !== 'ECO:', 'error.required_field')
});

// Form Fields
const requestId = ref<number | null>(null);
const projectName = ref('');
const partNo = ref('');
const partName = ref('');
const revision = ref('');
const supplierId = ref<number | ''>('');
const supplierOptions = ref<{ value: number, label: string }[]>([]);
const address = ref('');
const commodityPart = ref<number | ''>('');
const commodityPartOptions = ref<{ value: number, label: string }[]>([]);
const personInCharge = ref('');
const trackingNo = ref('');
const sampleQty = ref<number>(3);
const submissionTime = ref<number>(1);

// Checkbox selections
const partType = ref(''); // tooling, cnc, mags, others
const partTypeOthersText = ref('');

const reasonForSubmission = ref(''); // initial, eco, process, others
const reasonOthersText = ref('');
const ecoText = ref('');

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

const uploadedFiles = ref<any[]>([]);
const saveStatus = ref('');

const idempotencyKey = ref('');

// Generate unique idempotency key
const generateIdempotencyKey = () => {
  return 'idemp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

// Handle file upload
// File upload handled by DirectUpload

const saveAsDraft = async () => {
  saveStatus.value = 'saving';
  try {
    const payload = {
      id: requestId.value,
      project_name: projectName.value,
      part_no: partNo.value,
      part_name: partName.value,
      revision: revision.value,
      supplier_id: supplierId.value,
      address: address.value,
      commodity_part: commodityPart.value,
      person_in_charge: personInCharge.value,
      tracking_no: trackingNo.value,
      sample_qty: sampleQty.value,
      submission_time: submissionTime.value,
      part_type: partType.value === 'Others' ? (partTypeOthersText.value ? `Others: ${partTypeOthersText.value}` : 'Others:') : partType.value,
      reason_for_submission: reasonForSubmission.value === 'Others' ? (reasonOthersText.value ? `Others: ${reasonOthersText.value}` : 'Others:') : 
                             (reasonForSubmission.value === 'ECO' ? (ecoText.value ? `ECO: ${ecoText.value}` : 'ECO:') : reasonForSubmission.value),
      submission_contents: submissionContents.value,
      file_ids: uploadedFiles.value.map((f: any) => f.id),
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
  clearAllErrors();
  const finalPartType = partType.value === 'Others' ? (partTypeOthersText.value ? `Others: ${partTypeOthersText.value}` : 'Others:') : partType.value;
  const finalReason = reasonForSubmission.value === 'Others' ? (reasonOthersText.value ? `Others: ${reasonOthersText.value}` : 'Others:') : 
                      (reasonForSubmission.value === 'ECO' ? (ecoText.value ? `ECO: ${ecoText.value}` : 'ECO:') : reasonForSubmission.value);

  const validationPayload = {
    project_name: projectName.value,
    part_no: partNo.value,
    part_name: partName.value,
    revision: revision.value,
    supplier_id: supplierId.value,
    address: address.value,
    commodity_part: commodityPart.value,
    person_in_charge: personInCharge.value,
    sample_qty: sampleQty.value,
    part_type: finalPartType,
    reason_for_submission: finalReason
  };

  if (!validate(faiRequestSchema, validationPayload)) {
    toast.error(t('error.validation_failed'));
    return;
  }

  try {
    const payload = {
      id: requestId.value,
      project_name: projectName.value,
      part_no: partNo.value,
      part_name: partName.value,
      revision: revision.value,
      supplier_id: supplierId.value,
      address: address.value,
      commodity_part: commodityPart.value,
      person_in_charge: personInCharge.value,
      tracking_no: trackingNo.value,
      sample_qty: sampleQty.value,
      submission_time: submissionTime.value,
      part_type: finalPartType,
      reason_for_submission: finalReason,
      submission_contents: submissionContents.value,
      file_ids: uploadedFiles.value.map((f: any) => f.id),
      idempotency_key: idempotencyKey.value
    };

    const res = await api.post('/fai', payload);
    if (res.data.success) {
      toast.success(t('toast.create_success'));
      router.push({ name: 'fai-request-list' });
    } else {
      if (res.data.error) {
        toast.error(t(res.data.error));
      } else {
        toast.error(t('toast.action_failed'));
      }
    }
  } catch (err: any) {
    if (err.response?.data?.error) {
      toast.error(t(err.response.data.error));
    } else {
      toast.error(t('toast.action_failed'));
    }
    console.error(err);
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

  // Fetch suppliers for dropdown
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
        supplierId.value = draft.supplier_id || '';
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
                <Input type="text" v-model="projectName" :placeholder="t('fai.placeholder.project_name')" :error="formErrors.project_name ? t(formErrors.project_name) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Part Number: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="partNo" :placeholder="t('fai.placeholder.part_no')" :error="formErrors.part_no ? t(formErrors.part_no) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Part Name: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="partName" :placeholder="t('fai.placeholder.part_name')" :error="formErrors.part_name ? t(formErrors.part_name) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Part Rev: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="revision" :placeholder="t('fai.placeholder.revision')" :error="formErrors.revision ? t(formErrors.revision) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Supplier Name: <span class="text-[#ef4444]">*</span></label>
                <SingleSelectDropdown 
                  v-model="supplierId" 
                  :options="supplierOptions" 
                  :placeholder="t('fai.placeholder.supplier_name')" 
                  :error="formErrors.supplier_id ? t(formErrors.supplier_id) : undefined"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Supplier Address: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="address" :placeholder="t('fai.placeholder.address')" :error="formErrors.address ? t(formErrors.address) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Commodity Part: <span class="text-[#ef4444]">*</span></label>
                <SingleSelectDropdown 
                  v-model="commodityPart" 
                  :options="commodityPartOptions" 
                  :placeholder="t('fai.placeholder.commodity_part')" 
                  :error="formErrors.commodity_part ? t(formErrors.commodity_part) : undefined"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">R&D Person In Charge: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="personInCharge" :placeholder="t('fai.placeholder.person_in_charge')" :error="formErrors.person_in_charge ? t(formErrors.person_in_charge) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Shipment Tracking No.:</label>
                <Input type="text" v-model="trackingNo" :placeholder="t('fai.placeholder.tracking_no')" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">Sample Quantity: <span class="text-[#ef4444]">*</span></label>
                <Input type="number" v-model="sampleQty" :min="3" :max="20" :error="formErrors.sample_qty ? t(formErrors.sample_qty) : undefined" required />
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
                    :modelValue="partTypeOthersText"
                    @update:modelValue="partTypeOthersText = ($event || '').toString().toUpperCase()"
                    :placeholder="t('fai.placeholder.specify')" 
                    :error="formErrors.part_type ? t(formErrors.part_type) : undefined"
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
                <div class="flex items-center gap-2">
                  <Radio value="ECO" v-model="reasonForSubmission">ECO</Radio>
                  <Input v-if="reasonForSubmission === 'ECO'" type="text" v-model="ecoText" :placeholder="t('fai.placeholder.specify')" :error="formErrors.reason_for_submission ? t(formErrors.reason_for_submission) : undefined" required />
                </div>
                <Radio value="Process" v-model="reasonForSubmission">Process: Transfer, replacement, refurbishment etc.</Radio>
                <div class="flex items-center gap-2">
                  <Radio value="Others" v-model="reasonForSubmission">Others:</Radio>
                  <Input v-if="reasonForSubmission === 'Others'" type="text" v-model="reasonOthersText" :placeholder="t('fai.placeholder.specify')" :error="formErrors.reason_for_submission ? t(formErrors.reason_for_submission) : undefined" required />
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
            <div class="pb-0 border-b-0 mt-4">
              <h3 class="text-base font-semibold mt-0 mb-3 text-text">{{ t('fai.attach_files') }}:</h3>
              <DirectUpload 
                v-model="uploadedFiles" 
                uploadUrl="/fai/upload" 
                :uploadParams="{ request_type: 'FAI' }" 
                :multiple="true" 
              />
              <p class="text-[0.75rem] text-text-muted mt-1.5 mb-0">{{ t('fai.multiple_files') }}</p>
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

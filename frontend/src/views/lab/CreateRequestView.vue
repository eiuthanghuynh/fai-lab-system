<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { toast } from 'vue-sonner';
import { z } from 'zod';
import { useFormValidation } from '@/composables/useFormValidation';
import { useAsyncState } from '@vueuse/core';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import Input from '@/components/ui/Input.vue';
import DirectUpload from '@/components/common/DirectUpload.vue';
import Button from '@/components/ui/Button.vue';
import DataTable from '@/components/common/DataTable.vue';
import type { DataTableColumn } from '@/types/DataTableColumn';
import Textarea from '@/components/ui/Textarea.vue';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const { formErrors, validate, clearError, clearAllErrors } = useFormValidation();

const labRequestSchema = z.object({
  model_no: z.string().min(1, 'error.required_field'),
  model_description: z.string().min(1, 'error.required_field'),
  quantity: z.number().min(1, 'error.sample_qty_lab_bounds').max(20, 'error.sample_qty_lab_bounds'),
  product_sn: z.string().min(1, 'error.required_field'),
  project_name: z.string().min(1, 'error.required_field'),
  revision: z.string().min(1, 'error.required_field'),
  stage: z.string(),
  prototype_number: z.number().optional()
}).superRefine((data, ctx) => {
  if (data.stage === 'Prototype') {
    if (data.prototype_number === undefined || data.prototype_number < 1 || data.prototype_number > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prototype_number'],
        message: 'error.sample_qty_lab_bounds'
      });
    }
  }
});

const formData = ref({
  id: undefined as number | undefined,
  model_no: '',
  model_description: '',
  quantity: 1,
  product_sn: '',
  project_name: '',
  revision: '',
  stage: 'Prototype',
  prototype_number: 1
});

const isSubmitting = ref(false);
const attachedFiles = ref<any[]>([]);

const stageOptions = computed(() => [
  { value: 'Prototype', label: 'Prototype' },
  { value: 'Mass Production', label: 'Mass Production' }
]);
const saveStatus = ref(''); // 'saving', 'saved', 'error', ''
const idempotencyKey = ref('');

const workOrders = ref<any[]>([
  { quantity: 1, item_test_id: null, procedure_condition: '', test_specification: '', remark: '' }
]);

const itemTestOptions = ref<any[]>([]);

const { execute: fetchItemTests } = useAsyncState(async () => {
  const res = await api.get('/item-tests/list');
  itemTestOptions.value = res.data.data.map((i: any) => ({ value: i.id, label: i.name }));
}, null, { immediate: true });

const woColumns = computed<DataTableColumn[]>(() => [
  { key: 'no', label: 'No.', sortable: false, minWidth: '60px', width: '60px' },
  { key: 'itemTest.name', label: t('lab.work_order.item_test'), sortable: false, minWidth: '180px', width: '180px' },
  { key: 'quantity', label: t('lab.columns.quantity'), sortable: false, minWidth: '100px', width: '100px' },
  { key: 'procedure_condition', label: t('lab.work_order.procedure_condition'), sortable: false, minWidth: '200px' },
  { key: 'test_specification', label: t('lab.work_order.test_specification'), sortable: false, minWidth: '200px' },
  { key: 'remark', label: t('lab.work_order.goal_comments'), sortable: false, minWidth: '200px' },
  { key: 'actions', label: 'Actions', sortable: false, minWidth: '80px', width: '80px', align: 'center' }
]);

const totalWoQuantity = computed(() => {
  return workOrders.value.reduce((acc, wo) => acc + (Number(wo.quantity) || 0), 0);
});

const isQuantityValid = computed(() => {
  return totalWoQuantity.value === formData.value.quantity;
});

const generateIdempotencyKey = () => {
  return 'idemp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

const addWorkOrder = () => {
  workOrders.value.push({
    quantity: 1,
    item_test_id: null,
    procedure_condition: '',
    test_specification: '',
    remark: ''
  });
};

const removeWorkOrder = (index: number) => {
  workOrders.value.splice(index, 1);
};

onMounted(async () => {
  idempotencyKey.value = generateIdempotencyKey();
  
  if (route.query.id) {
    try {
      const res = await api.get(`/lab/requests/${route.query.id}`);
      if (res.data.success && res.data.data.status === 'Draft') {
        const data = res.data.data;
        formData.value = {
          id: data.id,
          model_no: data.model_no,
          model_description: data.model_description || '',
          quantity: data.quantity,
          product_sn: data.product_sn || '',
          project_name: data.project_name || '',
          revision: data.revision || '',
          stage: data.stage.startsWith('Prototype') ? 'Prototype' : data.stage,
          prototype_number: data.stage.startsWith('Prototype ') ? parseInt(data.stage.split(' ')[1]) : 1
        };
        
        if (data.workOrders && data.workOrders.length > 0) {
           workOrders.value = data.workOrders.map((wo: any) => ({
             id: wo.id,
             quantity: wo.quantity,
             item_test_id: wo.item_test_id,
             procedure_condition: wo.procedure_condition || '',
             test_specification: wo.test_specification || '',
             remark: wo.remark || ''
           }));
        }
        
        if (data.attachments && data.attachments.length > 0) {
          attachedFiles.value = data.attachments;
        }
      } else {
        toast.error('Cannot edit non-draft request');
        router.push('/lab/request/list');
      }
    } catch (err) {
      toast.error('Failed to load draft');
    }
  }
});

// Upload logic is now handled entirely by DirectUpload component

const saveAsDraft = async () => {
  try {
    saveStatus.value = 'saving';
    const fileIds = attachedFiles.value.map(f => f.id);
    
    let finalStage = formData.value.stage;
    if (finalStage === 'Prototype') {
      finalStage = `Prototype ${formData.value.prototype_number}`;
    }

    const payload = {
      ...formData.value,
      stage: finalStage,
      file_ids: fileIds,
      idempotency_key: idempotencyKey.value,
      workOrders: workOrders.value
    };

    const res = await api.post('/lab/requests/draft', payload);
    
    if (res.data.success) {
      formData.value.id = res.data.data.id;
      saveStatus.value = 'saved';
      toast.success('Draft saved successfully');
      setTimeout(() => { 
        saveStatus.value = ''; 
        router.push('/lab/request/list');
      }, 1000);
    }
  } catch (err: any) {
    saveStatus.value = 'error';
    toast.error(err.response?.data?.error || 'Failed to save draft');
  }
};

const submitRequest = async () => {
  clearAllErrors();
  
  const validationPayload = {
    model_no: formData.value.model_no,
    model_description: formData.value.model_description,
    quantity: formData.value.quantity,
    product_sn: formData.value.product_sn,
    project_name: formData.value.project_name,
    revision: formData.value.revision,
    stage: formData.value.stage,
    prototype_number: formData.value.prototype_number
  };

  if (!validate(labRequestSchema, validationPayload)) {
    toast.error(t('error.validation_failed'));
    return;
  }

  if (workOrders.value.some(wo => !wo.item_test_id)) {
    toast.error('Item Test is required for all Work Orders.');
    return;
  }

  try {

    isSubmitting.value = true;
    const fileIds = attachedFiles.value.map(f => f.id);
    
    let finalStage = formData.value.stage;
    if (finalStage === 'Prototype') {
      finalStage = `Prototype ${formData.value.prototype_number}`;
    }

    const payload = {
      ...formData.value,
      stage: finalStage,
      file_ids: fileIds,
      idempotency_key: idempotencyKey.value,
      workOrders: workOrders.value
    };

    const res = await api.post('/lab/requests', payload);
    if (res.data.duplicated) {
      toast.info('This request has already been submitted.');
      router.push('/lab/request/list');
      return;
    }

    toast.success(t('toast.create_success'));
    router.push('/lab/request/list');
  } catch (err: any) {
    if (err.response?.data?.error) {
      toast.error(t(err.response.data.error));
    } else {
      toast.error(t('toast.error'));
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="h-full overflow-y-auto p-6 box-border">
    <div class="w-full max-w-[1550px] min-h-full p-6 bg-bg-surface rounded-lg border border-border shadow-sm mx-auto box-border flex flex-col">
      <div class="py-4 flex justify-between items-center border-b-2 border-border mb-6">
        <div class="flex items-center gap-4">
          <Button variant="secondary" class="gap-2" @click="router.push('/lab/request/list')">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {{ t('fai.back_to_list') }}
          </Button>
          <h1 class="text-2xl m-0">{{ t('lab.form_title') }}</h1>
        </div>
        <span class="text-[0.85rem] font-medium" :class="{'text-[#f59e0b]': saveStatus === 'saving', 'text-primary': saveStatus === 'saved', 'text-[#ef4444]': saveStatus === 'error'}">
          <template v-if="saveStatus === 'saving'">{{ t('fai.saving_draft') }}</template>
        </span>
      </div>

      <form @submit.prevent="submitRequest" class="flex flex-col grow m-0">
        <div class="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6 xl:gap-8 mb-5">
          
          <!-- Left Column (Core Inputs) -->
          <div class="flex flex-col gap-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">{{ t('lab.columns.model_no') }}: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="formData.model_no" :placeholder="t('lab.columns.model_no')" :error="formErrors.model_no ? t(formErrors.model_no) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">{{ t('lab.columns.model_description') }}: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="formData.model_description" :placeholder="t('lab.columns.model_description')" :error="formErrors.model_description ? t(formErrors.model_description) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">{{ t('lab.columns.quantity') }}: <span class="text-[#ef4444]">*</span></label>
                <Input type="number" v-model.number="formData.quantity" :min="1" :max="20" :placeholder="t('lab.columns.quantity')" :error="formErrors.quantity ? t(formErrors.quantity) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">{{ t('lab.columns.product_sn') }}: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="formData.product_sn" :placeholder="t('lab.columns.product_sn')" :error="formErrors.product_sn ? t(formErrors.product_sn) : undefined" autocomplete="new-password" data-lpignore="true" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">{{ t('lab.columns.project_name') }}: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="formData.project_name" :placeholder="t('lab.columns.project_name')" :error="formErrors.project_name ? t(formErrors.project_name) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">{{ t('fai.columns.revision') }}: <span class="text-[#ef4444]">*</span></label>
                <Input type="text" v-model="formData.revision" :placeholder="t('fai.placeholder.revision')" :error="formErrors.revision ? t(formErrors.revision) : undefined" required />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-base text-text">{{ t('lab.columns.stage') }}: <span class="text-[#ef4444]">*</span></label>
                <div class="flex gap-2 items-center">
                  <div :class="formData.stage === 'Prototype' ? 'w-4/5' : 'w-full'">
                    <SingleSelectDropdown 
                      v-model="formData.stage" 
                      :options="stageOptions" 
                      :placeholder="t('lab.columns.stage')" 
                    />
                  </div>
                  <div v-if="formData.stage === 'Prototype'" class="w-1/5">
                    <Input 
                      v-model.number="formData.prototype_number" 
                      type="number" 
                      :min="1" 
                      :max="20"
                      :placeholder="t('fai.columns.quantity')"
                      :error="formErrors.prototype_number ? t(formErrors.prototype_number) : undefined"
                      required
                      class="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column (Attach Files) -->
          <div class="flex flex-col gap-5">
            <div class="col-span-1 sm:col-span-2 mt-4">
              <label class="block text-sm font-medium mb-1">Attachments</label>
              <DirectUpload 
                v-model="attachedFiles" 
                uploadUrl="/lab/requests/upload" 
                :uploadParams="{ request_type: 'LAB' }" 
                :multiple="true" 
              />
            </div>
          </div>
          
        </div>

        <!-- Work Orders Section -->
        <div class="mt-8 mb-5 border-t border-border pt-6 flex flex-col gap-4">
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-semibold m-0 text-text">{{ t('lab.work_order.title', 'Work Orders') }}</h2>
            <Button type="button" variant="primary" @click="addWorkOrder">
              + {{ t('action.create') }}
            </Button>
          </div>
          
          <div v-if="!isQuantityValid && totalWoQuantity > 0" class="text-red-500 font-medium text-sm">
            {{ t('error.lab_wo_qty_mismatch', { totalWoQuantity, formDataQuantity: formData.quantity }) }}
          </div>
          
          <DataTable 
            :data="workOrders" 
            :columns="woColumns" 
            class="mt-2"
          >
            <!-- Cell Template definitions for editing -->
            <template #cell-no="{ index }">
              {{ index + 1 }}
            </template>
            
            <template #cell-itemTest.name="{ item }">
              <SingleSelectDropdown v-model="item.item_test_id" :options="itemTestOptions" class="w-[160px]" />
            </template>
            
            <template #cell-quantity="{ item }">
              <Input type="number" v-model.number="item.quantity" :min="1" class="w-20" />
            </template>
            
            <template #cell-procedure_condition="{ item }">
              <Textarea v-model="item.procedure_condition" class="w-full min-w-[180px] text-xs" rows="2" />
            </template>

            <template #cell-test_specification="{ item }">
              <Textarea v-model="item.test_specification" class="w-full min-w-[180px] text-xs" rows="2" />
            </template>
            
            <template #cell-remark="{ item }">
              <Textarea v-model="item.remark" class="w-full min-w-[180px] text-xs" rows="2" />
            </template>
            
            <template #cell-actions="{ index }">
              <button type="button" @click.prevent="removeWorkOrder(index)" :disabled="workOrders.length <= 1" class="text-red-500 hover:text-red-700 disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              </button>
            </template>
          </DataTable>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end gap-3 mt-auto pt-4 border-t border-border">
          <Button type="button" variant="secondary" @click="saveAsDraft">{{ t('fai.save_draft') }}</Button>
          <Button type="submit" :disabled="isSubmitting || !isQuantityValid">
            {{ t('fai.submit') }}
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>

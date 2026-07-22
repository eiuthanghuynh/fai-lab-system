<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAsyncState } from '@vueuse/core';
import api from '@/services/api';
import BaseModal from '@/components/common/BaseModal.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';

const props = defineProps<{
  show: boolean;
  faiRequest: any;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submitted'): void;
  (e: 'draft-saved'): void;
}>();

const { t } = useI18n();

const showModal = computed({
  get: () => props.show,
  set: (val) => {
    if (!val) emit('close');
  }
});

// Form state - All default values initialized to empty string ''
const unit = ref('');
const lotSubmission = ref<number[]>([1]);
const comments = ref('');
const overallResult = ref('');
const failureDetails = ref('');
const improvementPlan = ref('');
const faiFailureMode = ref<number | null>(null);
const failureModes = ref<{ value: number; label: string }[]>([]);
const validationError = ref('');

const { execute: fetchFailureModes } = useAsyncState(async () => {
  try {
    const res = await api.get('/fai-failure-modes');
    if (res.data && Array.isArray(res.data.data)) {
      failureModes.value = res.data.data.map((m: any) => ({
        value: m.id,
        label: m.issue
      }));
    }
  } catch (e) {
    console.error('Failed to fetch failure modes:', e);
  }
}, null, { immediate: false });

interface SampleData {
  sample_no: number;
  value?: string | number;
  min?: string | number;
  max?: string | number;
}

interface DimensionRow {
  id: string; // for TransitionGroup keying
  item_no: number;
  row_type: 'STANDARD' | 'COATING_THICKNESS' | 'LIMITED_EQUIPMENT';
  spec: string;
  delta?: string; // QoL helper field for auto-calculating -TOL and +TOL
  minus_tol: string;
  plus_tol: string;
  condition: string;
  machine: string;
  samples: SampleData[];
  result: 'PASS' | 'FAIL' | 'REFER' | '';
  remark: string;
  remark_text?: string;
}

interface NotesCheckRow {
  id: string;
  no: number;
  check_item_type: string;
  custom_item: string;
  result: 'OK' | 'NG' | 'N/A' | '';
}

const shapeAndDimension = ref<DimensionRow[]>([]);
const notesCheck = ref<NotesCheckRow[]>([]);

const sampleQty = computed(() => props.faiRequest?.sample_qty || 3);

const rowTypeOptions = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'COATING_THICKNESS', label: 'Range (Min/Max)' },
  { value: 'LIMITED_EQUIPMENT', label: 'Cannot Measure' }
];

const resultOptions = [
  { value: 'PASS', label: 'PASS' },
  { value: 'FAIL', label: 'FAIL' },
  { value: 'REFER', label: 'REFER' }
];

const notesResultOptions = [
  { value: 'OK', label: 'OK' },
  { value: 'NG', label: 'NG' },
  { value: 'N/A', label: 'N/A' }
];

const presetNotesOptions = [
  { value: 'Please refer to XP Drawing (attached)', label: 'Please refer to XP Drawing (attached)' },
  { value: 'Materials Appearance', label: 'Materials Appearance' },
  { value: 'Form, Fit and Function (if have)', label: 'Form, Fit and Function (if have)' },
  { value: 'Electrical or Mechanical Property', label: 'Electrical or Mechanical Property' },
  { value: 'Custom', label: 'Custom...' }
];

const generateId = () => Math.random().toString(36).substr(2, 9);

// QoL Auto-calculation for -TOL and +TOL when spec & delta change
const autoCalculateTolerances = (row: DimensionRow) => {
  if (row.row_type !== 'STANDARD') return;
  if (!row.spec || !row.delta) return;
  const specVal = parseFloat(row.spec);
  const deltaVal = parseFloat(row.delta);
  if (isNaN(specVal) || isNaN(deltaVal)) return;

  const specDecimals = (row.spec.split('.')[1] || '').length;
  const deltaDecimals = (row.delta.split('.')[1] || '').length;
  const decimals = Math.max(specDecimals, deltaDecimals, 2);

  row.minus_tol = (specVal - deltaVal).toFixed(decimals);
  row.plus_tol = (specVal + deltaVal).toFixed(decimals);
};

// Excel-style Fill Down QoL: Copy delta to all subsequent STANDARD rows
const fillDownDelta = (startIndex: number) => {
  const sourceRow = shapeAndDimension.value[startIndex];
  if (!sourceRow || !sourceRow.delta) return;
  const deltaVal = sourceRow.delta;

  for (let i = startIndex + 1; i < shapeAndDimension.value.length; i++) {
    const targetRow = shapeAndDimension.value[i];
    if (targetRow.row_type === 'STANDARD') {
      targetRow.delta = deltaVal;
      autoCalculateTolerances(targetRow);
    }
  }
};

// Excel-style Fill Down QoL: Copy Result to all subsequent rows in Shape & Dimension
const fillDownResult = (startIndex: number) => {
  const sourceRow = shapeAndDimension.value[startIndex];
  if (!sourceRow || !sourceRow.result) return;
  const resVal = sourceRow.result;

  for (let i = startIndex + 1; i < shapeAndDimension.value.length; i++) {
    shapeAndDimension.value[i].result = resVal;
  }
};

// Excel-style Fill Down QoL: Copy Result to all subsequent rows in Notes Check
const fillDownNotesResult = (startIndex: number) => {
  const sourceRow = notesCheck.value[startIndex];
  if (!sourceRow || !sourceRow.result) return;
  const resVal = sourceRow.result;

  for (let i = startIndex + 1; i < notesCheck.value.length; i++) {
    notesCheck.value[i].result = resVal;
  }
};

const initDefaultRows = () => {
  const rows: DimensionRow[] = [];
  for (let i = 1; i <= 10; i++) {
    const samples: SampleData[] = [];
    for (let s = 1; s <= 5; s++) {
      samples.push({ sample_no: s, value: '', min: '', max: '' });
    }
    rows.push({
      id: generateId(),
      item_no: i,
      row_type: 'STANDARD',
      spec: '',
      delta: '',
      minus_tol: '',
      plus_tol: '',
      condition: '',
      machine: '',
      samples,
      result: '',
      remark: ''
    });
  }
  shapeAndDimension.value = rows;

  notesCheck.value = [
    { id: generateId(), no: 1, check_item_type: 'Please refer to XP Drawing (attached)', custom_item: '', result: '' },
    { id: generateId(), no: 2, check_item_type: 'Materials Appearance', custom_item: '', result: '' },
    { id: generateId(), no: 3, check_item_type: 'Form, Fit and Function (if have)', custom_item: '', result: '' }
  ];
};

// Data Fetching with useAsyncState
const { isLoading, execute: fetchReport } = useAsyncState(async () => {
  if (!props.faiRequest?.id) return;
  validationError.value = '';
  const res = await api.get(`/fai/${props.faiRequest.id}/report`);
  const data = res.data?.data?.report_data;

  if (data) {
    unit.value = data.unit || '';
    lotSubmission.value = Array.isArray(data.lot_submission) ? data.lot_submission : [1];
    comments.value = data.comments || '';
    overallResult.value = res.data?.data?.request_result || data.result || '';
    failureDetails.value = props.faiRequest.failure_details || data.failure_details || '';
    improvementPlan.value = props.faiRequest.improvement_plan || data.improvement_plan || '';
    faiFailureMode.value = props.faiRequest.fai_failure_mode || data.fai_failure_mode || null;

    if (Array.isArray(data.shape_and_dimension) && data.shape_and_dimension.length > 0) {
      shapeAndDimension.value = data.shape_and_dimension.map((row: any, idx: number) => {
        const samples: SampleData[] = [];
        for (let s = 1; s <= 5; s++) {
          const sVal = row.samples?.find((x: any) => x.sample_no === s) || {};
          samples.push({
            sample_no: s,
            value: sVal.val ?? sVal.value ?? '',
            min: sVal.min_val ?? sVal.min ?? '',
            max: sVal.max_val ?? sVal.max ?? ''
          });
        }
        return {
          id: generateId(),
          item_no: row.item_no || (idx + 1),
          row_type: row.row_type || 'STANDARD',
          spec: row.spec || '',
          delta: '',
          minus_tol: row.minus_tol || '',
          plus_tol: row.plus_tol || '',
          condition: row.condition || '',
          machine: row.machine || '',
          samples,
          result: row.result || '',
          remark: row.remark || '',
          remark_text: row.remark_text || ''
        };
      });
    } else {
      initDefaultRows();
    }

    if (Array.isArray(data.notes_check) && data.notes_check.length > 0) {
      notesCheck.value = data.notes_check.map((nc: any, i: number) => {
        const itemText = nc.check_item || '';
        const isPreset = presetNotesOptions.some(o => o.value === itemText && o.value !== 'Custom');
        return {
          id: generateId(),
          no: nc.no || (i + 1),
          check_item_type: isPreset ? itemText : 'Custom',
          custom_item: isPreset ? '' : itemText,
          result: nc.result || ''
        };
      });
    } else {
      notesCheck.value = [
        { id: generateId(), no: 1, check_item_type: 'Please refer to XP Drawing (attached)', custom_item: '', result: '' },
        { id: generateId(), no: 2, check_item_type: 'Materials Appearance', custom_item: '', result: '' },
        { id: generateId(), no: 3, check_item_type: 'Form, Fit and Function (if have)', custom_item: '', result: '' }
      ];
    }
  } else {
    initDefaultRows();
  }
}, null, { immediate: false });

watch(() => props.show, (newVal) => {
  if (newVal && props.faiRequest?.id) {
    fetchFailureModes();
    fetchReport();
  }
});

const addDimensionRow = () => {
  const nextNo = shapeAndDimension.value.length + 1;
  const samples: SampleData[] = [];
  for (let s = 1; s <= 5; s++) {
    samples.push({ sample_no: s, value: '', min: '', max: '' });
  }
  shapeAndDimension.value.push({
    id: generateId(),
    item_no: nextNo,
    row_type: 'STANDARD',
    spec: '',
    delta: '',
    minus_tol: '',
    plus_tol: '',
    condition: '',
    machine: '',
    samples,
    result: '',
    remark: ''
  });
};

const removeDimensionRow = (index?: number) => {
  if (shapeAndDimension.value.length > 1) {
    if (typeof index === 'number') {
      shapeAndDimension.value.splice(index, 1);
    } else {
      shapeAndDimension.value.pop();
    }
    // Re-index item_no sequentially
    shapeAndDimension.value.forEach((row, i) => {
      row.item_no = i + 1;
    });
  }
};

const addNotesRow = () => {
  const nextNo = notesCheck.value.length + 1;
  notesCheck.value.push({
    id: generateId(),
    no: nextNo,
    check_item_type: 'Materials Appearance',
    custom_item: '',
    result: ''
  });
};

const removeNotesRow = (index: number) => {
  notesCheck.value.splice(index, 1);
};

const toggleLot = (lotNum: number) => {
  if (lotSubmission.value.includes(lotNum)) {
    if (lotSubmission.value.length > 1) {
      lotSubmission.value = lotSubmission.value.filter(n => n !== lotNum);
    }
  } else {
    lotSubmission.value.push(lotNum);
    lotSubmission.value.sort();
  }
};

const buildFormattedNotesCheck = () => {
  return notesCheck.value.map(nc => ({
    no: nc.no,
    check_item: nc.check_item_type === 'Custom' ? nc.custom_item : nc.check_item_type,
    result: nc.result
  }));
};

const validateForm = () => {
  if (!unit.value || !unit.value.trim()) {
    validationError.value = 'Unit is required.';
    return false;
  }
  if (!overallResult.value) {
    validationError.value = 'Overall FAI Result is required.';
    return false;
  }
  if (overallResult.value === 'FAIL') {
    if (!faiFailureMode.value) {
      validationError.value = 'FAI Failure Mode is required when result is FAIL.';
      return false;
    }
    if (!failureDetails.value || !failureDetails.value.trim()) {
      validationError.value = 'Failure Details is required when result is FAIL.';
      return false;
    }
  }
  validationError.value = '';
  return true;
};

// Draft Save
const { isLoading: isSavingDraft, execute: submitSaveDraft } = useAsyncState(async () => {
  const payload = {
    result: overallResult.value,
    failure_details: failureDetails.value,
    improvement_plan: improvementPlan.value,
    fai_failure_mode: faiFailureMode.value,
    report_data: {
      result: overallResult.value,
      unit: unit.value,
      sample_qty: sampleQty.value,
      lot_submission: lotSubmission.value,
      shape_and_dimension: shapeAndDimension.value,
      notes_check: buildFormattedNotesCheck(),
      comments: comments.value,
      failure_details: failureDetails.value,
      improvement_plan: improvementPlan.value,
      fai_failure_mode: faiFailureMode.value
    }
  };
  await api.post(`/fai/${props.faiRequest.id}/report/draft`, payload);
  emit('draft-saved');
}, null, { immediate: false });

// Final Submit Report
const { isLoading: isSubmitting, execute: submitFinalReport } = useAsyncState(async () => {
  if (!validateForm()) return;

  const payload = {
    result: overallResult.value,
    failure_details: overallResult.value === 'FAIL' ? failureDetails.value : null,
    improvement_plan: overallResult.value === 'FAIL' ? improvementPlan.value : null,
    fai_failure_mode: overallResult.value === 'FAIL' ? faiFailureMode.value : null,
    report_data: {
      unit: unit.value,
      sample_qty: sampleQty.value,
      lot_submission: lotSubmission.value,
      shape_and_dimension: shapeAndDimension.value,
      notes_check: buildFormattedNotesCheck(),
      comments: comments.value,
      failure_details: failureDetails.value,
      improvement_plan: improvementPlan.value,
      fai_failure_mode: faiFailureMode.value
    }
  };
  await api.post(`/fai/${props.faiRequest.id}/report/submit`, payload);
  emit('submitted');
  showModal.value = false;
}, null, { immediate: false });
</script>

<template>
  <BaseModal
    :isOpen="showModal"
    :title="t('fai.report.modal_title')"
    maxWidth="95vw"
    @close="showModal = false"
  >
    <div v-if="isLoading" class="p-8 text-center text-gray-500">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
      <div>Loading report data...</div>
    </div>

    <div v-else class="space-y-6">
      <!-- Validation Error Alert -->
      <div v-if="validationError" class="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm font-semibold">
        {{ validationError }}
      </div>

      <!-- Header Info Block -->
      <div class="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <span class="block text-xs font-semibold text-gray-500 uppercase">Part Name</span>
          <span class="font-medium text-gray-900 dark:text-white">{{ faiRequest?.part_name || '-' }}</span>
        </div>
        <div>
          <span class="block text-xs font-semibold text-gray-500 uppercase">Part Number</span>
          <span class="font-medium text-gray-900 dark:text-white">{{ faiRequest?.part_no || '-' }}</span>
        </div>
        <div>
          <span class="block text-xs font-semibold text-gray-500 uppercase">Supplier</span>
          <span class="font-medium text-gray-900 dark:text-white">{{ faiRequest?.supplier?.name || faiRequest?.supplier?.full_name || '-' }}</span>
        </div>
        <div>
          <span class="block text-xs font-semibold text-gray-500 uppercase">Rev</span>
          <span class="font-medium text-gray-900 dark:text-white">{{ faiRequest?.revision || 'A' }}</span>
        </div>

        <!-- Editable Unit (Required, harmonized header styling) -->
        <div>
          <span class="block text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
            {{ t('fai.report.unit') }} <span class="text-red-500 font-bold">*</span>
          </span>
          <Input v-model="unit" placeholder="MM" class="w-24! text-center font-bold mt-0.5" />
        </div>
        <div>
          <span class="block text-xs font-semibold text-gray-500 uppercase">Sample Qty</span>
          <span class="font-bold text-primary">{{ sampleQty }} pcs</span>
        </div>
        <div class="md:col-span-2">
          <span class="block text-xs font-semibold text-gray-500 uppercase mb-1">Lot Submission</span>
          <div class="flex gap-2">
            <button
              v-for="lotNum in [1, 2, 3, 4, 5]"
              :key="lotNum"
              type="button"
              @click="toggleLot(lotNum)"
              :class="[
                'px-2.5 py-1 rounded text-xs font-bold transition-colors',
                lotSubmission.includes(lotNum)
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
              ]"
            >
              Lot {{ lotNum }}
            </button>
          </div>
        </div>
      </div>

      <!-- Section 1: Shape and Dimension Table -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span class="w-2 h-5 bg-primary rounded-full"></span>
            {{ t('fai.report.shape_and_dimension') }}
          </h3>
          <Button variant="secondary" size="sm" @click="addDimensionRow">
            + {{ t('fai.report.add_row') }}
          </Button>
        </div>

        <div class="max-h-[65vh] overflow-auto border border-gray-200 dark:border-slate-700 rounded-lg">
          <table class="w-full text-xs text-left">
            <thead class="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 uppercase font-semibold text-[11px] sticky top-0 z-10 shadow-sm">
              <tr>
                <th class="p-2 w-8 text-center">No.</th>
                <th class="p-2 w-32">{{ t('fai.report.row_type') }}</th>
                <th class="p-2 w-24">{{ t('fai.report.spec') }}</th>
                <th class="p-2 w-16 text-center bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 whitespace-pre-line leading-tight">Δ&#10;(±TOL)</th>
                <th class="p-2 w-16 text-center">{{ t('fai.report.minus_tol') }}</th>
                <th class="p-2 w-16 text-center">{{ t('fai.report.plus_tol') }}</th>
                <th class="p-2 w-20 text-center">{{ t('fai.report.machine_tool') }}</th>
                <th
                  v-for="s in Math.min(Math.max(Number(sampleQty) || 1, 1), 5)"
                  :key="s"
                  class="p-2 text-center w-16"
                >
                  #{{ s }}
                </th>
                <th class="p-2 w-20 text-center">{{ t('fai.report.result') }}</th>
                <th class="p-2 w-24">{{ t('fai.report.remark') }}</th>
                <th class="p-2 w-10 text-center">Actions</th>
              </tr>
            </thead>
            
            <TransitionGroup
              component="tbody"
              name="row-anim"
              class="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-900"
            >
              <tr
                v-for="(row, idx) in shapeAndDimension"
                :key="row.id"
                class="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors duration-200"
              >
                <td class="p-2 text-center font-bold">{{ row.item_no }}</td>

                <!-- Row Type Selector -->
                <td class="p-1">
                  <SingleSelectDropdown
                    v-model="row.row_type"
                    :options="rowTypeOptions"
                    class="w-full text-xs"
                  />
                </td>

                <!-- Spec -->
                <td class="p-1">
                  <Input
                    v-model="row.spec"
                    placeholder="Spec"
                    class="text-xs"
                    @input="autoCalculateTolerances(row)"
                  />
                </td>

                <!-- Δ (±TOL) QoL Helper Cell with Excel-style AutoFill Handle -->
                <td class="p-1 bg-blue-50/20 dark:bg-blue-950/10">
                  <div v-if="row.row_type === 'STANDARD'" class="relative group">
                    <Input
                      v-model="row.delta"
                      placeholder="±"
                      class="text-center text-xs border-blue-200 dark:border-blue-800 focus:border-blue-500 pr-3"
                      @input="autoCalculateTolerances(row)"
                    />
                    <!-- Excel AutoFill Handle square button (Only visible & clickable when input is focused) -->
                    <button
                      v-if="row.delta"
                      type="button"
                      @mousedown.prevent="fillDownDelta(idx)"
                      class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-600 hover:bg-blue-800 text-white rounded-[1px] border border-white dark:border-slate-900 cursor-pointer shadow-md invisible pointer-events-none group-focus-within:visible group-focus-within:pointer-events-auto opacity-0 group-focus-within:opacity-100 transition-all duration-150 flex items-center justify-center z-10 hover:scale-125"
                    >
                      <span class="text-[7px] leading-none select-none">▼</span>
                    </button>
                  </div>
                  <span v-else class="block text-center text-gray-400 text-xs">-</span>
                </td>

                <!-- Minus TOL / Plus TOL or Condition -->
                <template v-if="row.row_type === 'STANDARD'">
                  <td class="p-1"><Input v-model="row.minus_tol" placeholder="-TOL" class="text-center text-xs" /></td>
                  <td class="p-1"><Input v-model="row.plus_tol" placeholder="+TOL" class="text-center text-xs" /></td>
                </template>

                <template v-else-if="row.row_type === 'COATING_THICKNESS'">
                  <td colspan="2" class="p-1">
                    <Input v-model="row.condition" placeholder="Condition (e.g. >5um)" class="text-center text-xs font-semibold text-primary" />
                  </td>
                </template>

                <!-- LIMITED_EQUIPMENT: tol (merged -TOL & +TOL) + Enter Reason (Machine/Tool through available samples) -->
                <template v-else-if="row.row_type === 'LIMITED_EQUIPMENT'">
                  <td colspan="2" class="p-1">
                    <Input
                      v-model="row.condition"
                      placeholder="TOL"
                      class="text-center text-xs font-semibold"
                    />
                  </td>
                  <td :colspan="1 + Math.min(Math.max(Number(sampleQty) || 1, 1), 5)" class="p-1">
                    <Input
                      v-model="row.remark_text"
                      :placeholder="t('fai.report.unmeasurable_placeholder')"
                      class="w-full text-xs italic text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
                    />
                  </td>
                </template>

                <!-- Machine Tool (If not UNMEASURABLE) -->
                <td v-if="row.row_type !== 'LIMITED_EQUIPMENT'" class="p-1">
                  <Input v-model="row.machine" placeholder="Machine/Tool" class="text-center text-xs" />
                </td>

                <!-- Sample Inputs (If not UNMEASURABLE) -->
                <template v-if="row.row_type !== 'LIMITED_EQUIPMENT'">
                  <td
                    v-for="s in Math.min(Math.max(Number(sampleQty) || 1, 1), 5)"
                    :key="s"
                    class="p-1 text-center"
                  >
                    <!-- STANDARD: Single Input -->
                    <Input
                      v-if="row.row_type === 'STANDARD'"
                      v-model="row.samples[s - 1].value"
                      class="text-center text-xs"
                    />
                    <!-- COATING_THICKNESS: Min & Max Inputs -->
                    <div v-else-if="row.row_type === 'COATING_THICKNESS'" class="space-y-1">
                      <Input v-model="row.samples[s - 1].min" placeholder="Min" class="text-center text-[10px] py-0.5" />
                      <Input v-model="row.samples[s - 1].max" placeholder="Max" class="text-center text-[10px] py-0.5" />
                    </div>
                  </td>
                </template>

                <!-- Result (Dropdown with Excel AutoFill Handle) -->
                <td class="p-1">
                  <div class="relative group">
                    <SingleSelectDropdown
                      v-model="row.result"
                      :options="resultOptions"
                      placeholder="-"
                      class="w-full text-xs font-bold"
                    />
                    <button
                      v-if="row.result"
                      type="button"
                      @mousedown.prevent="fillDownResult(idx)"
                      class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-600 hover:bg-blue-800 text-white rounded-[1px] border border-white dark:border-slate-900 cursor-pointer shadow-md invisible pointer-events-none group-focus-within:visible group-focus-within:pointer-events-auto opacity-0 group-focus-within:opacity-100 transition-all duration-150 flex items-center justify-center z-10 hover:scale-125"
                    >
                      <span class="text-[7px] leading-none select-none">▼</span>
                    </button>
                  </div>
                </td>

                <!-- Remark -->
                <td class="p-1">
                  <Input v-model="row.remark" placeholder="Remark" class="text-xs" />
                </td>

                <!-- Actions (Delete Row) -->
                <td class="p-1 text-center">
                  <Button
                    variant="danger"
                    size="sm"
                    class="px-2 py-0.5 text-xs"
                    @click="removeDimensionRow(idx)"
                    :disabled="shapeAndDimension.length <= 1"
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            </TransitionGroup>
          </table>
        </div>
      </div>

      <!-- Section 2: Notes Check Table -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span class="w-2 h-5 bg-emerald-500 rounded-full"></span>
            {{ t('fai.report.notes_check') }}
          </h3>
          <Button variant="secondary" size="sm" @click="addNotesRow">
            + {{ t('fai.report.add_row') }}
          </Button>
        </div>

        <div class="max-h-[65vh] overflow-auto border border-gray-200 dark:border-slate-700 rounded-lg">
          <table class="w-full text-xs text-left">
            <thead class="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 uppercase font-semibold sticky top-0 z-10 shadow-sm">
              <tr>
                <th class="p-2 w-12 text-center">No.</th>
                <th class="p-2">{{ t('fai.report.notes_check') }} Item</th>
                <th class="p-2 w-64 text-center">{{ t('fai.report.result') }}</th>
                <th class="p-2 w-16 text-center">Actions</th>
              </tr>
            </thead>
            <TransitionGroup
              component="tbody"
              name="row-anim"
              class="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-900"
            >
              <tr v-for="(nc, idx) in notesCheck" :key="nc.id" class="transition-colors duration-200">
                <td class="p-2 text-center font-bold">{{ idx + 1 }}</td>
                <td class="p-1">
                  <div class="flex gap-2 items-center w-full">
                    <div :class="[nc.check_item_type === 'Custom' ? 'w-48 shrink-0' : 'w-full']">
                      <SingleSelectDropdown
                        v-model="nc.check_item_type"
                        :options="presetNotesOptions"
                        class="text-xs"
                      />
                    </div>
                    <Input
                      v-if="nc.check_item_type === 'Custom'"
                      v-model="nc.custom_item"
                      placeholder="Enter custom description..."
                      class="flex-1 min-w-0 text-xs"
                    />
                  </div>
                </td>
                <td class="p-1">
                  <Input
                    v-model="nc.result"
                    placeholder="Result"
                    class="text-center text-xs font-bold"
                  />
                </td>
                <td class="p-1 text-center">
                  <Button variant="danger" size="sm" class="px-2 py-0.5" @click="removeNotesRow(idx)" :disabled="notesCheck.length <= 1">
                    ✕
                  </Button>
                </td>
              </tr>
            </TransitionGroup>
          </table>
        </div>
      </div>

      <!-- Section 3: Overall Comments & Overall Result -->
      <div class="space-y-4 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">{{ t('fai.report.comments') }}</label>
            <Textarea v-model="comments" rows="2" placeholder="General conclusion of FAI..." class="text-xs" />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Overall FAI Result <span class="text-red-500">*</span></label>
            <SingleSelectDropdown
              v-model="overallResult"
              :options="resultOptions"
              placeholder="Select Result..."
              class="w-full font-bold text-sm"
            />
          </div>
        </div>

        <!-- Failure Mode, Failure Details & Improvement Plan (Shown when Overall Result is FAIL) -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          leave-active-class="transition-all duration-200 ease-in"
          enter-from-class="opacity-0 -translate-y-2"
          leave-to-class="opacity-0 -translate-y-2"
        >
          <div v-if="overallResult === 'FAIL'" class="pt-3 border-t border-gray-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">
                FAI Failure Mode <span class="text-red-500">*</span>
              </label>
              <SingleSelectDropdown
                v-model="faiFailureMode"
                :options="failureModes"
                placeholder="Select Failure Mode..."
                class="w-full text-xs"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">
                Failure Details <span class="text-red-500">*</span>
              </label>
              <Textarea
                v-model="failureDetails"
                rows="2"
                placeholder="Describe the failure details..."
                class="text-xs border-red-300 focus:border-red-500"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">
                Improvement Plan
              </label>
              <Textarea
                v-model="improvementPlan"
                rows="2"
                placeholder="Describe the improvement/action plan..."
                class="text-xs border-amber-300 focus:border-amber-500"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <Button variant="secondary" @click="showModal = false">
          {{ t('common.cancel') }}
        </Button>
        <div class="flex gap-2">
          <Button variant="secondary" :disabled="isSavingDraft" @click="submitSaveDraft">
            {{ isSavingDraft ? 'Saving...' : t('fai.report.save_draft') }}
          </Button>
          <Button variant="primary" :disabled="isSubmitting" @click="submitFinalReport">
            {{ isSubmitting ? 'Submitting...' : t('fai.report.submit_report') }}
          </Button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
/* Transition animation for table rows */
.row-anim-enter-active,
.row-anim-leave-active {
  transition: all 0.25s ease-out;
}
.row-anim-enter-from {
  opacity: 0;
  transform: translateX(-15px);
}
.row-anim-leave-to {
  opacity: 0;
  transform: translateX(15px);
}
</style>

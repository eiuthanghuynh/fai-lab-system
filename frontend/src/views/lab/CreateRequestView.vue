<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { toast } from 'vue-sonner';
import CustomDropdown from '@/components/CustomDropdown.vue';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

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
const fileInputRef = ref<HTMLInputElement | null>(null);

const stageOptions = computed(() => [
  { value: 'Prototype', label: 'Prototype' },
  { value: 'Mass Production', label: 'Mass Production' }
]);
const isUploading = ref(false);
const uploadProgress = ref(0);
const saveStatus = ref(''); // 'saving', 'saved', 'error', ''
const idempotencyKey = ref('');

const generateIdempotencyKey = () => {
  return 'idemp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
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
        // Load attachments if needed, but we don't have a way to preview existing files yet easily.
        // FAI usually handles it by pushing to a separate array.
      } else {
        toast.error('Cannot edit non-draft request');
        router.push('/lab/request/list');
      }
    } catch (err) {
      toast.error('Failed to load draft');
    }
  }
});

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const filesArray = Array.from(target.files);
    attachedFiles.value = [...attachedFiles.value, ...filesArray];
  }
};

const removeFile = (index: number) => {
  attachedFiles.value.splice(index, 1);
};

const uploadFiles = async () => {
  if (attachedFiles.value.length === 0) return [];
  const uploadData = new FormData();
  attachedFiles.value.forEach(file => {
    uploadData.append('files', file);
  });
  
  isUploading.value = true;
  uploadProgress.value = 30;
  
  const res = await api.post('/lab/requests/upload', uploadData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      }
    }
  });
  
  uploadProgress.value = 100;
  isUploading.value = false;
  
  return res.data.files.map((f: any) => f.id);
};

const saveAsDraft = async () => {
  try {
    saveStatus.value = 'saving';
    const fileIds = await uploadFiles();
    
    let finalStage = formData.value.stage;
    if (finalStage === 'Prototype') {
      finalStage = `Prototype ${formData.value.prototype_number}`;
    }

    const payload = {
      ...formData.value,
      stage: finalStage,
      file_ids: fileIds,
      idempotency_key: idempotencyKey.value
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
  try {
    if (!formData.value.model_no || !formData.value.quantity) {
      toast.error('Please fill all required fields');
      return;
    }

    isSubmitting.value = true;
    const fileIds = await uploadFiles();
    
    let finalStage = formData.value.stage;
    if (finalStage === 'Prototype') {
      finalStage = `Prototype ${formData.value.prototype_number}`;
    }

    const payload = {
      ...formData.value,
      stage: finalStage,
      file_ids: fileIds,
      idempotency_key: idempotencyKey.value
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
    toast.error(err.response?.data?.error || t('toast.error'));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="create-request-page">
    <div class="fai-form-container">
      <div class="header-section">
        <div class="header-left">
          <button type="button" class="btn-back" @click="router.push('/lab/request/list')">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-back">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {{ t('fai.back_to_list') }}
          </button>
          <h1>{{ t('lab.form_title') }}</h1>
        </div>
        <span class="status-indicator" :class="saveStatus">
          <template v-if="saveStatus === 'saving'">{{ t('fai.saving_draft') }}</template>
        </span>
      </div>

      <form @submit.prevent="submitRequest" class="fai-form">
        <div class="form-layout-grid">
          
          <!-- Left Column (Core Inputs) -->
          <div class="form-left-col">
            <div class="inputs-grid">
              <div class="form-group">
                <label>{{ t('lab.columns.model_no') }}: <span class="required">*</span></label>
                <input type="text" v-model="formData.model_no" :placeholder="t('lab.columns.model_no')" required />
              </div>
              <div class="form-group">
                <label>{{ t('lab.columns.model_description') }}: <span class="required">*</span></label>
                <input type="text" v-model="formData.model_description" :placeholder="t('lab.columns.model_description')" required />
              </div>
              <div class="form-group">
                <label>{{ t('lab.columns.quantity') }}: <span class="required">*</span></label>
                <input type="number" v-model.number="formData.quantity" min="1" :placeholder="t('lab.columns.quantity')" required />
              </div>
              <div class="form-group">
                <label>{{ t('lab.columns.product_sn') }}: <span class="required">*</span></label>
                <input type="text" v-model="formData.product_sn" :placeholder="t('lab.columns.product_sn')" required />
              </div>
              <div class="form-group">
                <label>{{ t('lab.columns.project_name') }}: <span class="required">*</span></label>
                <input type="text" v-model="formData.project_name" :placeholder="t('lab.columns.project_name')" required />
              </div>
              <div class="form-group">
                <label>{{ t('fai.columns.revision') }}: <span class="required">*</span></label>
                <input type="text" v-model="formData.revision" :placeholder="t('fai.placeholder.revision')" required />
              </div>
              <div class="form-group">
                <label>{{ t('lab.columns.stage') }}: <span class="required">*</span></label>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <CustomDropdown 
                    v-model="formData.stage" 
                    :options="stageOptions" 
                    :placeholder="t('lab.columns.stage')" 
                    style="flex: 1;"
                  />
                  <input 
                    v-if="formData.stage === 'Prototype'" 
                    v-model.number="formData.prototype_number" 
                    type="number" 
                    min="1" 
                    max="20"
                    :placeholder="t('fai.columns.quantity')"
                    required
                    style="width: 80px;"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column (Attach Files) -->
          <div class="form-right-col">
            <div class="file-section no-border">
              <h3>{{ t('fai.attach_files') }}:</h3>
              <div class="file-upload-box">
                <input type="file" multiple @change="handleFileUpload" id="file-input" class="hidden-file-input" />
                <label for="file-input" class="file-upload-btn">{{ t('fai.choose_files') }}</label>
                <span class="file-info" v-if="attachedFiles.length === 0">{{ t('fai.no_file') }}</span>
                <div v-else class="uploaded-list">
                  <div v-for="(file, idx) in attachedFiles" :key="idx" class="uploaded-item">
                    <span class="file-name">{{ file.name }}</span>
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

        <!-- Action Buttons -->
        <div class="actions-section">
          <button type="button" @click="saveAsDraft" class="btn-draft">{{ t('fai.save_draft') }}</button>
          <button type="submit" class="btn-primary" :disabled="isSubmitting">
            {{ t('fai.submit') }}
          </button>
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

.file-section {
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.file-section.no-border {
  border-bottom: none;
  padding-bottom: 0;
}

.file-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: 0.75rem;
  color: var(--color-text);
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

</style>

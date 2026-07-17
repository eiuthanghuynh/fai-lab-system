<script setup lang="ts">
import { ref } from 'vue';
import api from '@/services/api';
import { toast } from 'vue-sonner';
import FileInput from '@/components/ui/FileInput.vue';

const props = withDefaults(defineProps<{
  modelValue: any[];
  uploadUrl: string;
  uploadParams?: Record<string, any>;
  multiple?: boolean;
  compact?: boolean;
  accept?: string;
  maxSize?: number;
}>(), {
  modelValue: () => [],
  multiple: true,
  uploadParams: () => ({}),
  compact: false,
  accept: '',
  maxSize: 0
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: any[]): void;
}>();

const isUploading = ref(false);
const uploadProgress = ref(0);

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  
  const uploadData = new FormData();
  
  const validFiles: File[] = [];
  const filesArray = Array.from(target.files);
  for (const file of filesArray) {
    if (props.maxSize && file.size > props.maxSize) {
      toast.error(`File ${file.name} exceeds max size limit`);
      continue;
    }
    if (props.accept) {
      const acc = props.accept.split(',').map(a => a.trim());
      const isValid = acc.some(a => {
        if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a.toLowerCase());
        return file.type.match(new RegExp(a.replace('*', '.*')));
      });
      if (!isValid) {
        toast.error(`File ${file.name} is not a valid format`);
        continue;
      }
    }
    validFiles.push(file);
  }

  if (validFiles.length === 0) {
    target.value = '';
    return;
  }

  validFiles.forEach(file => {
    uploadData.append('files', file);
  });
  
  if (props.uploadParams) {
    for (const [key, value] of Object.entries(props.uploadParams)) {
      uploadData.append(key, value as string);
    }
  }

  isUploading.value = true;
  uploadProgress.value = 0;
  
  try {
    const res = await api.post(props.uploadUrl, uploadData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        }
      }
    });
    
    if (res.data && res.data.files) {
      const updated = [...props.modelValue, ...res.data.files];
      emit('update:modelValue', updated);
    } else if (res.data && res.data.data) {
      // Handle the case where backend returns files in data instead of files
      const updated = [...props.modelValue, ...res.data.data];
      emit('update:modelValue', updated);
    }
  } catch (err) {
    toast.error('File upload failed');
    console.error(err);
  } finally {
    isUploading.value = false;
    uploadProgress.value = 0;
    target.value = '';
  }
};

const removeFile = (index: number) => {
  const updated = [...props.modelValue];
  updated.splice(index, 1);
  emit('update:modelValue', updated);
};
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center space-x-3">
      <FileInput 
        :multiple="multiple" 
        :accept="accept"
        :disabled="isUploading"
        @change="handleFileUpload" 
      />
      <div v-if="isUploading && !compact" class="flex-1 max-w-[200px]">
        <div class="h-1.5 w-full bg-border rounded overflow-hidden">
          <div class="h-full bg-primary transition-all duration-300" :style="`width: ${uploadProgress}%`"></div>
        </div>
        <div class="text-[10px] text-text-muted mt-1 text-right">{{ uploadProgress }}%</div>
      </div>
      <div v-if="isUploading && compact" class="text-xs text-primary animate-pulse">Uploading...</div>
    </div>
    
    <div v-if="modelValue.length > 0" :class="compact ? 'mt-1' : 'mt-3'">
      <ul :class="compact ? 'flex flex-wrap gap-1' : 'divide-y divide-border border border-border rounded overflow-hidden'">
        <li v-for="(file, index) in modelValue" :key="file.id || index" 
            class="flex justify-between items-center hover:bg-bg-surface transition-colors"
            :class="compact ? 'bg-bg-surface border border-border rounded px-1.5 py-0.5 text-xs' : 'p-2 text-sm'">
          <div class="flex items-center space-x-2 truncate">
            <svg v-if="!compact" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span class="truncate" :class="compact ? 'max-w-[80px]' : 'max-w-[200px]'">{{ file.file_name || file.image_url || file.name }}</span>
          </div>
          <button @click="removeFile(index)" type="button" class="text-text-muted hover:text-error p-0.5 rounded hover:bg-border transition-colors ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

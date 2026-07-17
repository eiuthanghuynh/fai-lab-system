<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

interface FileItem {
  id: number;
  file_name: string;
  file_url: string;
}

const props = withDefaults(
  defineProps<{
    files: FileItem[];
    baseUrl?: string;
  }>(),
  {
    baseUrl: 'http://localhost:3000',
  }
);

const { t } = useI18n();
const activeIndex = ref(0);

const currentFile = computed<FileItem | null>(() => {
  if (props.files.length === 0) return null;
  const index = activeIndex.value;
  return props.files[index] || props.files[0] || null;
});

// Watch files change to reset active index
watch(
  () => props.files,
  (newFiles) => {
    if (newFiles.length > 0) {
      activeIndex.value = 0;
    }
  },
  { immediate: true }
);

const getFullUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${props.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const selectFile = (index: number) => {
  activeIndex.value = index;
};

const isViewable = computed(() => {
  if (!currentFile.value) return false;
  const name = currentFile.value.file_name.toLowerCase();
  return name.endsWith('.pdf');
});

const viewerUrl = computed(() => {
  if (!currentFile.value) return '';
  return getFullUrl(currentFile.value.url || currentFile.value.file_url);
});

const isFileNotFound = ref(false);
const isCheckingFile = ref(false);

watch(currentFile, async (newFile) => {
  if (!newFile) {
    isFileNotFound.value = false;
    isCheckingFile.value = false;
    return;
  }
  
  isCheckingFile.value = true;
  isFileNotFound.value = false;
  
  try {
    const url = getFullUrl(newFile.url || newFile.file_url);
    const controller = new AbortController();
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      isFileNotFound.value = true;
    }
    controller.abort(); // Cancel body download
  } catch (err: any) {
    // AbortError is expected if we aborted, but if it failed before aborting:
    if (err.name !== 'AbortError') {
      console.error('Failed to check file existence', err);
      isFileNotFound.value = true;
    }
  } finally {
    isCheckingFile.value = false;
  }
}, { immediate: true });

import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const downloadFile = async (file: FileItem) => {
  const url = getFullUrl(file.url || file.file_url);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();
    saveAs(blob, file.file_name);
  } catch (error) {
    console.error('Download failed, falling back to window.open', error);
    window.open(url, '_blank');
  }
};

const isDownloadingAll = ref(false);

const downloadAll = async () => {
  if (props.files.length === 0 || isDownloadingAll.value) return;
  
  isDownloadingAll.value = true;
  try {
    const zip = new JSZip();
    
    // Fetch all files
    const fetchPromises = props.files.map(async (file) => {
      const url = getFullUrl(file.url || file.file_url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${file.file_name}`);
      const blob = await response.blob();
      zip.file(file.file_name, blob);
    });

    await Promise.all(fetchPromises);
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'attachments.zip');
  } catch (error) {
    console.error('Error creating zip file:', error);
    alert('Failed to download all files. Please try downloading them individually.');
  } finally {
    isDownloadingAll.value = false;
  }
};
</script>

<template>
  <div class="border border-border rounded-lg bg-bg-surface overflow-hidden h-[800px] flex flex-col max-md:h-[750px]">
    <!-- Empty State -->
    <div v-if="files.length === 0" class="flex flex-col items-center justify-center grow p-12 text-text-muted">
      <div class="text-[3rem] mb-4">📄</div>
      <p>{{ t('pdf.no_attachments') }}</p>
    </div>

    <!-- Split Panel Viewer -->
    <div v-else class="flex h-full w-full max-md:flex-col">
      <!-- Sidebar (Left) -->
      <div class="w-[250px] max-md:w-full max-md:h-[200px] border-r max-md:border-r-0 max-md:border-b border-border flex flex-col bg-bg shrink-0">
        <div class="p-4 border-b border-border">
          <h3 class="m-0 text-base font-semibold text-text">{{ t('pdf.document_length') }} ({{ files.length }})</h3>
        </div>
        
        <div class="grow overflow-y-auto p-2 flex flex-col gap-1">
          <div 
            v-for="(file, idx) in files" 
            :key="file.id"
            class="flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors duration-200"
            :class="idx === activeIndex ? 'bg-primary/20 text-primary font-semibold' : 'text-text-muted hover:bg-border hover:text-text'"
            @click="selectFile(idx)"
          >
            <span class="grow whitespace-nowrap overflow-hidden text-ellipsis text-[0.9rem] pr-2" :title="file.file_name">
              {{ file.file_name }}
            </span>
            <button 
              type="button" 
              class="bg-transparent border-none text-inherit cursor-pointer p-1 rounded flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity shrink-0" 
              @click.stop="downloadFile(file)"
              title="Download File"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="p-4 border-t border-border">
          <button type="button" class="w-full flex items-center justify-center gap-2 p-2.5 border border-border bg-bg-surface text-text rounded-md text-[0.9rem] font-semibold cursor-pointer transition-colors duration-200 hover:bg-border" @click="downloadAll">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            {{ t('pdf.download_all') }}
          </button>
        </div>
      </div>

      <!-- Main Viewer (Right) -->
      <div class="grow flex flex-col bg-bg-surface" v-if="currentFile">
        <div class="px-5 py-3 border-b border-border flex items-center justify-between bg-bg">
          <h4 class="m-0 text-base font-semibold text-text whitespace-nowrap overflow-hidden text-ellipsis max-w-[60%]" :title="currentFile.file_name">
            {{ currentFile.file_name }}
          </h4>
          <button type="button" class="flex items-center gap-1.5 py-1.5 px-3 bg-primary text-bg-surface border-none rounded text-[0.85rem] font-semibold cursor-pointer transition-all hover:brightness-90" @click="downloadFile(currentFile)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-[14px] h-[14px]">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            {{ t('pdf.download') }}
          </button>
        </div>

        <div class="grow relative bg-[#525659]">
          <div v-if="isCheckingFile" class="w-full h-full flex items-center justify-center bg-bg">
            <div class="flex flex-col items-center justify-center gap-4 p-12 bg-transparent max-w-[400px] text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            </div>
          </div>
          <div v-else-if="isFileNotFound" class="w-full h-full flex items-center justify-center bg-bg">
            <div class="flex flex-col items-center justify-center gap-4 p-12 bg-bg-surface border border-dashed border-border rounded-[30px] max-w-[400px] text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff5555" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="9"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              <p class="text-[#ff5555] text-lg m-0">{{ t('pdf.not_found_title') }}</p>
              <p class="text-text-muted text-xs m-0">{{ t('pdf.not_found_content') }}</p>
            </div>
          </div>
          <iframe 
            v-else-if="isViewable"
            :src="viewerUrl" 
            class="w-full h-full border-none" 
            title="Document Viewer"
          ></iframe>
          <div v-else class="w-full h-full flex items-center justify-center bg-bg">
            <div class="flex flex-col items-center justify-center gap-4 p-12 bg-bg-surface border border-dashed border-border rounded-[30px] max-w-[400px] text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              <p class="text-text text-lg m-0">{{ t('pdf.download_placeholder_title') }}</p>
              <p class="text-text-muted text-xs m-0">{{ t('pdf.download_placeholder_content') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

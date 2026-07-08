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
  return `${props.baseUrl}${url}`;
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
  return getFullUrl(currentFile.value.file_url);
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
    const url = getFullUrl(newFile.file_url);
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
  const url = getFullUrl(file.file_url);
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
      const url = getFullUrl(file.file_url);
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
  <div class="pdf-viewer-container">
    <!-- Empty State -->
    <div v-if="files.length === 0" class="empty-state">
      <div class="empty-icon">📄</div>
      <p>{{ t('pdf.no_attachments') }}</p>
    </div>

    <!-- Split Panel Viewer -->
    <div v-else class="split-panel">
      <!-- Sidebar (Left) -->
      <div class="sidebar">
        <div class="sidebar-header">
          <h3>{{ t('pdf.document_length') }} ({{ files.length }})</h3>
        </div>
        
        <div class="files-list">
          <div 
            v-for="(file, idx) in files" 
            :key="file.id"
            class="file-item"
            :class="{ active: idx === activeIndex }"
            @click="selectFile(idx)"
          >
            <span class="file-name" :title="file.file_name">
              {{ file.file_name }}
            </span>
            <button 
              type="button" 
              class="btn-icon-download" 
              @click.stop="downloadFile(file)"
              title="Download File"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-download">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="sidebar-footer">
          <button type="button" class="btn-download-all" @click="downloadAll">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            {{ t('pdf.download_all') }}
          </button>
        </div>
      </div>

      <!-- Main Viewer (Right) -->
      <div class="main-viewer" v-if="currentFile">
        <div class="viewer-header">
          <h4 class="current-file-title" :title="currentFile.file_name">
            {{ currentFile.file_name }}
          </h4>
          <button type="button" class="btn-header-download" @click="downloadFile(currentFile)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            {{ t('pdf.download') }}
          </button>
        </div>

        <div class="viewer-body">
          <div v-if="isCheckingFile" class="non-viewable-placeholder">
            <div class="placeholder-content" style="border: none; background: transparent;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="file-icon" style="animation: spin 2s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            </div>
          </div>
          <div v-else-if="isFileNotFound" class="non-viewable-placeholder">
            <div class="placeholder-content">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff5555" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="9"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              <p class="placeholder-text" style="color: #ff5555;">{{ t('pdf.not_found_title') }}</p>
              <p class="placeholder-text-small">{{ t('pdf.not_found_content') }}</p>
            </div>
          </div>
          <iframe 
            v-else-if="isViewable"
            :src="viewerUrl" 
            class="pdf-iframe" 
            title="Document Viewer"
          ></iframe>
          <div v-else class="non-viewable-placeholder">
            <div class="placeholder-content">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="file-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              <p class="placeholder-text">{{ t('pdf.download_placeholder_title') }}</p>
              <p class="placeholder-text-small">{{ t('pdf.download_placeholder_content') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pdf-viewer-container {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  overflow: hidden;
  height: 800px;
  display: flex;
  flex-direction: column;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 3rem;
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.split-panel {
  display: flex;
  height: 100%;
  width: 100%;
}

/* Sidebar Styling */
.sidebar {
  width: 250px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
  flex-shrink: 0;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.files-list {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color-text-muted);
}

.file-item:hover {
  background-color: var(--color-border);
  color: var(--color-text);
}

.file-item.active {
  background-color: var(--color-primary-light, #e0f2fe);
  color: var(--color-primary, #0284c7);
  font-weight: 600;
}

html.dark .file-item.active {
  background-color: rgba(2, 132, 199, 0.2);
  color: #38bdf8;
}

.file-name {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
  padding-right: 0.5rem;
}

.btn-icon-download {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.btn-icon-download:hover {
  opacity: 1;
}

.btn-icon-download svg {
  width: 16px;
  height: 16px;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--color-border);
}

.btn-download-all {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  color: var(--color-text);
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-download-all:hover {
  background-color: var(--color-border);
}

.btn-download-all svg {
  width: 16px;
  height: 16px;
}

/* Main Viewer Styling */
.main-viewer {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-surface);
}

.viewer-header {
  padding: 0.8rem 1.2rem;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-bg);
}

.current-file-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}

.btn-header-download {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  background-color: var(--color-primary);
  color: var(--color-bg-surface);
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-header-download:hover {
  filter: brightness(0.9);
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.viewer-body {
  flex-grow: 1;
  position: relative;
  background-color: #525659; /* Default PDF viewer dark background */
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

@media (max-width: 768px) {
  .split-panel {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }
  .pdf-viewer-container {
    height: 750px;
  }
}

.non-viewable-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg);
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  background-color: var(--color-bg-surface);
  border: 1px dashed var(--color-border);
  border-radius: 30px;
  max-width: 400px;
  text-align: center;
}

.file-icon {
  color: var(--color-text-muted);
}

.placeholder-text {
  color: var(--color-text);
  font-size: 1.1rem;
  margin: 0;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.placeholder-text-small {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  margin: 0;
}
</style>

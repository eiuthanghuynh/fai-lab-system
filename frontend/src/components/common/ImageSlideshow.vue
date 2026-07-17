<script setup lang="ts">
import { ref, computed } from 'vue';

interface ImageItem {
  id?: number;
  image_url?: string;
  file_url?: string;
  name?: string;
  file_name?: string;
}

const props = withDefaults(defineProps<{
  images: ImageItem[];
  baseUrl?: string;
}>(), {
  images: () => [],
  baseUrl: 'http://localhost:3000'
});

const getFullUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${props.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const normalizedImages = computed(() => {
  return props.images.map(img => ({
    ...img,
    url: getFullUrl(img.url || img.image_url || img.file_url || ''),
    title: img.name || img.file_name || 'Image'
  }));
});

const isModalOpen = ref(false);
const currentIndex = ref(0);

const openSlideshow = (index: number) => {
  currentIndex.value = index;
  isModalOpen.value = true;
};

const closeSlideshow = () => {
  isModalOpen.value = false;
};

const nextImage = () => {
  if (currentIndex.value < normalizedImages.value.length - 1) {
    currentIndex.value++;
  } else {
    currentIndex.value = 0; // wrap around
  }
};

const prevImage = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  } else {
    currentIndex.value = normalizedImages.value.length - 1; // wrap around
  }
};
</script>

<template>
  <div v-if="normalizedImages.length > 0" class="flex flex-wrap gap-2">
    <!-- Thumbnails -->
    <div 
      v-for="(img, idx) in normalizedImages" 
      :key="idx" 
      class="w-10 h-10 rounded border border-border cursor-pointer overflow-hidden hover:opacity-80 transition-opacity flex-shrink-0"
      @click="openSlideshow(idx)"
    >
      <img :src="img.url" :alt="img.title" class="w-full h-full object-cover" />
    </div>

    <!-- Teleport Modal -->
    <Teleport to="body">
      <Transition 
        enter-active-class="transition-opacity duration-300"
        leave-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="isModalOpen" class="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center">
          <!-- Close Button -->
          <button 
            @click="closeSlideshow" 
            class="absolute top-4 right-4 text-white hover:text-gray-300 z-10 p-2 bg-black/50 hover:bg-black/80 rounded-full transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          
          <!-- Prev Button -->
          <button 
            v-if="normalizedImages.length > 1"
            @click="prevImage" 
            class="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10 p-3 bg-black/50 hover:bg-black/80 rounded-full transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>

          <!-- Main Image -->
          <img 
            :src="normalizedImages[currentIndex].url" 
            :alt="normalizedImages[currentIndex].title"
            class="max-w-full max-h-[90vh] object-contain select-none shadow-2xl"
          />

          <!-- Title -->
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-1.5 rounded-full flex gap-2 items-center">
            <span class="font-bold">{{ currentIndex + 1 }} / {{ normalizedImages.length }}</span>
            <span class="w-px h-3 bg-white/30"></span>
            <span class="truncate max-w-[200px]">{{ normalizedImages[currentIndex].title }}</span>
          </div>

          <!-- Next Button -->
          <button 
            v-if="normalizedImages.length > 1"
            @click="nextImage" 
            class="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10 p-3 bg-black/50 hover:bg-black/80 rounded-full transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

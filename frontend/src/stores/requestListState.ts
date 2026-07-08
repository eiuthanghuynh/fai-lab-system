import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useRequestListStateStore = defineStore('requestListState', () => {
  const searchQuery = ref('');
  const overdueTargetDate = ref<string | null>(null);

  const clear = () => {
    searchQuery.value = '';
    overdueTargetDate.value = null;
  };

  return {
    searchQuery,
    overdueTargetDate,
    clear
  };
});

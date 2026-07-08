import { ref } from 'vue';

export function useDataTable(defaultSortBy: string = 'id', defaultSortDesc: boolean = true) {
  const page = ref(1);
  const limit = ref(25);
  const sortBy = ref(defaultSortBy);
  const sortDesc = ref(defaultSortDesc);
  const searchQuery = ref('');

  const toggleSort = (column: string) => {
    if (sortBy.value === column) {
      if (sortDesc.value) {
        sortDesc.value = false;
      } else {
        sortBy.value = '';
        sortDesc.value = false;
      }
    } else {
      sortBy.value = column;
      sortDesc.value = true; // default to descending on new column
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy.value !== column) return '↕';
    return sortDesc.value ? '↓' : '↑';
  };

  return {
    page,
    limit,
    sortBy,
    sortDesc,
    searchQuery,
    toggleSort,
    getSortIcon
  };
}

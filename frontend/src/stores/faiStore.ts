import { defineStore } from 'pinia';
import { shallowRef, computed, ref } from 'vue';
import api from '@/services/api';
import { socketService } from '@/services/socket';

export const useFaiStore = defineStore('faiStore', () => {
  const allRequests = shallowRef<any[]>([]);
  const isLoaded = ref(false);

  // Fetch all requests exactly once
  const fetchAllRequests = async () => {
    if (isLoaded.value) return;
    try {
      // limit=999999 to get all data for dashboard aggregations
      const res = await api.get('/fai?limit=999999');
      allRequests.value = res.data.data;
      isLoaded.value = true;
    } catch (err) {
      console.error('Fetch all FAI requests failed:', err);
    }
  };

  // Setup Socket listeners
  const initSocketListeners = () => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('fai-request-created', (request: any) => {
      // Prepend to array (triggering reactivity via reassignment since it's shallowRef)
      allRequests.value = [request, ...allRequests.value];
    });

    socket.on('fai-request-updated', (updatedRequest: any) => {
      const idx = allRequests.value.findIndex((r: any) => r.id === updatedRequest.id);
      if (idx !== -1) {
        const newArr = [...allRequests.value];
        newArr[idx] = updatedRequest;
        allRequests.value = newArr;
      }
    });

    socket.on('fai-request-deleted', (id: number) => {
      allRequests.value = allRequests.value.filter((r: any) => r.id !== id);
    });
  };

  // Derived computed properties for Dashboard
  const dashboardStats = computed(() => {
    const data = allRequests.value;
    const total = data.length;
    let closed = 0;
    let ongoing = 0;
    let backlog = 0;
    let pass = 0;
    let fail = 0;
    let blank = 0;
    let rejected = 0;

    const commodityFailCounts: Record<string, number> = {};
    const commodityTotalCounts: Record<string, number> = {};

    data.forEach((r: any) => {
      // Status
      if (r.status === 'Approved') closed++;
      else if (r.status === 'Ongoing') ongoing++;
      else if (r.status === 'Backlog') backlog++;
      else if (r.status === 'Rejected') rejected++;

      // Result
      if (r.result === 'PASS') pass++;
      else if (r.result === 'FAIL') fail++;
      else blank++; // blank means backlog or ongoing mostly

      // Commodity (group by part_name or commodity_part? Using part_type or commodity name if available)
      const commodityName = r.commodityPartRel?.name || 'Unknown';
      if (!commodityTotalCounts[commodityName]) {
        commodityTotalCounts[commodityName] = 0;
      }
      commodityTotalCounts[commodityName]++;

      if (r.result === 'FAIL') {
        if (!commodityFailCounts[commodityName]) {
          commodityFailCounts[commodityName] = 0;
        }
        commodityFailCounts[commodityName]++;
      }
    });

    return {
      total,
      closed,
      ongoing,
      backlog,
      rejected,
      pass,
      fail,
      blank,
      commodityFailCounts,
      commodityTotalCounts
    };
  });

  // Initialize socket listeners once the store is created
  initSocketListeners();

  return {
    allRequests,
    isLoaded,
    fetchAllRequests,
    initSocketListeners,
    dashboardStats
  };
});

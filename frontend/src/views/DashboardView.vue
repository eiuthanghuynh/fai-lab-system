<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAsyncState } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { formatDate, formatDateOnly } from '@/utils/dateFormatter'
import api from '@/services/api'
import { socketService } from '@/services/socket'
import { useAuthStore } from '@/stores/auth'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import { useDark } from '@vueuse/core'
import { toast } from 'vue-sonner'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ResultBadge from '@/components/common/ResultBadge.vue'
import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue'
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue'
import ChartCard from '@/components/common/ChartCard.vue'
import FaiFirstPassYieldChart from '@/components/common/FaiFirstPassYieldChart.vue'
import DataTable, { type DataTableColumn } from '@/components/common/DataTable.vue'
import Pagination from '@/components/Pagination.vue'
import Button from '@/components/ui/Button.vue'
import { useDataTable } from '@/composables/useDataTable'
import { useRouter } from 'vue-router'

const router = useRouter()

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Draft': return 'secondary';
    case 'Backlog': return 'secondary';
    case 'Assigned': return 'warning';
    case 'Ongoing': return 'warning';
    case 'Approved': return 'success';
    case 'Rejected': return 'danger';
    case 'Closed': return 'success';
    default: return 'secondary';
  }
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
)

const { t } = useI18n()
const authStore = useAuthStore()
const isDark = useDark()

// KPI List for rendering
const kpiList = computed(() => [
  { label: systemFilter.value === 'FAI' ? t('dashboard.total_fai') : t('dashboard.total_lab'), value: stats.value.kpi.total, color: 'bg-blue-500' },
  { label: t('dashboard.closed'), value: stats.value.kpi.closed, color: 'bg-emerald-500' },
  { label: t('dashboard.ongoing'), value: stats.value.kpi.ongoing, color: 'bg-yellow-400' },
  { label: systemFilter.value === 'FAI' ? t('dashboard.backlog') : t('dashboard.backlog_assigned'), value: stats.value.kpi.backlogAssigned, color: 'bg-gray-500' },
  { label: t('dashboard.pass_rate'), value: `${stats.value.kpi.passRate}%`, color: 'bg-emerald-500' }
])

const getStatusText = (status: string) => {
  switch (status) {
    case 'Draft': return 'Draft'
    case 'Backlog': return 'Backlog'
    case 'Ongoing': return 'Ongoing'
    case 'Approved': return 'Approved'
    case 'Rejected': return 'Rejected'
    case 'Assigned': return 'Assigned'
    case 'Closed': return 'Closed'
    default: return status
  }
}

const formatOrdinal = (n: number) => {
  if (!n) return '-'
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}


// Global states
const initSystemFilter = (): 'FAI' | 'LAB' => {
  const pref = localStorage.getItem('dashboard_system_preference')
  if (pref === 'FAI' || pref === 'LAB') {
    if (pref === 'FAI' && authStore.hasPermission('VIEW_DASHBOARD_FAI')) return 'FAI'
    if (pref === 'LAB' && authStore.hasPermission('VIEW_DASHBOARD_LAB')) return 'LAB'
  }
  if (authStore.hasPermission('VIEW_DASHBOARD_FAI')) return 'FAI'
  if (authStore.hasPermission('VIEW_DASHBOARD_LAB')) return 'LAB'
  return 'FAI'
}

const systemFilter = ref<'FAI' | 'LAB'>(initSystemFilter())
watch(systemFilter, (newVal) => {
  localStorage.setItem('dashboard_system_preference', newVal)
})
const yearFilter = ref<string[]>([])
const weekFilter = ref<string[]>([])
const showNewDataToast = ref(false)

const getCurrentWeek = () => {
  const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
const currentWeek = getCurrentWeek()

const setToCurrentWeek = () => {
  const yearStr = new Date().getFullYear().toString()
  if (!yearFilter.value.includes(yearStr)) {
    yearFilter.value = [...yearFilter.value, yearStr]
  }
  
  const weekStr = currentWeek.toString()
  if (!weekFilter.value.includes(weekStr)) {
    weekFilter.value = [...weekFilter.value, weekStr]
  }
}

// Dashboard data
const stats = ref<any>({
  kpi: { total: 0, closed: 0, ongoing: 0, backlogAssigned: 0, passRate: 0 },
  charts: {
    status: { closed: 0, ongoing: 0, backlog: 0 },
    result: { pass: 0, fail: 0, tbd: 0 },
    commodity: [],
    pareto: [],
    weeklyYield: [],
    testType: [],
    itemTestByDate: { labels: [], datasets: [] }
  }
})
const recentRequests = ref<any[]>([])
const totalRecentRequests = ref(0)
const { page, limit, sortBy, sortDesc, toggleSort } = useDataTable('created_at', true)
limit.value = 25 // Default rows per page

const recentColumns = computed<DataTableColumn[]>(() => {
  if (systemFilter.value === 'FAI') {
    return [
      { key: 'id', label: 'ID', sortable: true, sticky: 'left', width: '60px' },
      { key: 'requestor_id', label: 'Requestor Name', sortable: true, minWidth: '150px' },
      { key: 'project_name', label: 'Project Name', sortable: true, minWidth: '160px' },
      { key: 'part_no', label: 'Part Number', sortable: true, minWidth: '150px' },
      { key: 'revision', label: 'Revision', sortable: true, minWidth: '120px' },
      { key: 'part_name', label: 'Part Name', sortable: true, minWidth: '200px' },
      { key: 'tracking_no', label: 'Tracking No.', sortable: true, minWidth: '200px' },
      { key: 'commodity_part', label: 'Commodity Part', sortable: true, minWidth: '160px' },
      { key: 'supplier_name', label: 'Supplier Name', sortable: true, minWidth: '180px' },
      { key: 'part_type', label: 'Part Type', sortable: true, minWidth: '150px' },
      { key: 'reason_for_submission', label: 'Reason for Submission', sortable: true, minWidth: '250px' },
      { key: 'receive_date', label: 'Receive Date', sortable: true, minWidth: '150px' },
      { key: 'sample_qty', label: 'Sample Qty', sortable: true, minWidth: '120px' },
      { key: 'submission_time', label: 'Submission Time', sortable: true, minWidth: '150px' },
      { key: 'priority', label: 'Priority', sortable: true, minWidth: '120px' },
      { key: 'week_no', label: 'Week', sortable: true, minWidth: '100px' },
      { key: 'complete_date', label: 'Complete Date', sortable: true, minWidth: '150px' },
      { key: 'failure_details', label: 'Failure Details', sortable: false, minWidth: '200px' },
      { key: 'improvement_plan', label: 'Improvement Plan', sortable: false, minWidth: '200px' },
      { key: 'inspector_id', label: 'Inspector Name', sortable: true, minWidth: '150px' },
      { key: 'fai_failure_mode', label: 'FAI Failure Mode', sortable: true, minWidth: '180px' },
      { key: 'remark', label: 'Remark', sortable: true, minWidth: '200px' },
      { key: 'estimated_date', label: 'Estimated Date', sortable: true, minWidth: '150px' },
      { key: 'created_at', label: t('fai.columns.created_at'), sortable: true, minWidth: '180px' },
      { key: 'updated_at', label: t('fai.columns.updated_at'), sortable: true, minWidth: '180px' },
      { key: 'result', label: t('fai.columns.result'), sortable: true, sticky: 'right', minWidth: '120px' },
      { key: 'status', label: t('fai.columns.status'), sortable: true, sticky: 'right', minWidth: '160px', width: '160px' },
      { key: 'actions', label: t('fai.columns.actions'), sticky: 'right', minWidth: '120px', width: '120px' }
    ]
  } else {
    return [
      { key: 'id', label: 'ID', sortable: true, sticky: 'left', width: '60px' },
      { key: 'test_no', label: 'Test No.', sortable: true, minWidth: '120px' },
      { key: 'requestor_id', label: t('lab.columns.requestor'), sortable: true, minWidth: '150px' },
      { key: 'model_no', label: t('lab.columns.model_no'), sortable: true, minWidth: '130px' },
      { key: 'model_description', label: t('lab.columns.model_description'), sortable: true, minWidth: '180px' },
      { key: 'quantity', label: t('lab.columns.quantity'), sortable: true, minWidth: '100px' },
      { key: 'product_sn', label: t('lab.columns.product_sn'), sortable: true, minWidth: '130px' },
      { key: 'project_name', label: t('lab.columns.project_name'), sortable: true, minWidth: '150px' },
      { key: 'revision', label: t('fai.columns.revision'), sortable: true, minWidth: '100px' },
      { key: 'stage', label: t('lab.columns.stage'), sortable: true, minWidth: '120px' },
      { key: 'priority', label: t('lab.columns.priority'), sortable: true, minWidth: '120px' },
      { key: 'priority_reason', label: 'Priority Reason', sortable: true, minWidth: '150px' },
      { key: 'week_no', label: 'Week', sortable: true, minWidth: '100px' },
      { key: 'estimated_date', label: t('fai.columns.estimated_date'), sortable: true, minWidth: '150px' },
      { key: 'complete_date', label: 'Complete Date', sortable: true, minWidth: '150px' },
      { key: 'receive_date', label: t('fai.columns.receive_date'), sortable: true, minWidth: '150px' },
      { key: 'return_date', label: 'Return Date', sortable: true, minWidth: '150px' },
      { key: 'created_at', label: t('fai.columns.created_at'), sortable: true, minWidth: '180px' },
      { key: 'updated_at', label: t('fai.columns.updated_at'), sortable: true, minWidth: '180px' },
      { key: 'result', label: t('fai.columns.result'), sortable: true, sticky: 'right', minWidth: '120px' },
      { key: 'status', label: t('lab.columns.status'), sortable: true, sticky: 'right', minWidth: '160px', width: '160px' },
      { key: 'actions', label: t('lab.columns.actions'), sticky: 'right', minWidth: '120px', width: '120px' }
    ]
  }
})

// Generate years and weeks for dropdown
const currentYear = new Date().getFullYear()
const yearsOptions = Array.from({ length: 5 }, (_, i) => {
  const y = (currentYear - i).toString()
  return { label: y, value: y }
})
const weeksOptions = computed(() => Array.from({ length: 53 }, (_, i) => {
  const w = (i + 1).toString()
  return { label: t('dashboard.week_number', { n: w }), value: w }
}))

const systemOptions = computed(() => {
  const options = []
  if (authStore.hasPermission('VIEW_DASHBOARD_FAI')) options.push({ label: 'FAI', value: 'FAI' })
  if (authStore.hasPermission('VIEW_DASHBOARD_LAB')) options.push({ label: 'LAB', value: 'LAB' })
  return options
})

const { isLoading, execute: executeFetchDashboardStats } = useAsyncState(async (refresh = false) => {
  const query = new URLSearchParams()
  query.append('system', systemFilter.value)
  if (yearFilter.value.length > 0) query.append('year', yearFilter.value.join(','))
  if (weekFilter.value.length > 0) query.append('week', weekFilter.value.join(','))
  if (refresh) query.append('refresh', 'true')

  const res = await api.get(`/dashboard/stats?${query.toString()}`)
  stats.value = res.data

  showNewDataToast.value = false
}, null, { immediate: false, resetOnExecute: false })

const fetchDashboardStats = (refresh = false) => executeFetchDashboardStats(0, refresh)

const { isLoading: isRecentLoading, execute: executeFetchRecentRequests } = useAsyncState(async () => {
  if (!authStore.hasPermission('MANAGE_REQUEST_LIST')) return
  const endpoint = systemFilter.value === 'FAI' ? '/fai' : '/lab/requests'
  const res = await api.get(`${endpoint}?page=${page.value}&limit=${limit.value}&sort_by=${sortBy.value}&sort_desc=${sortDesc.value}`)
  recentRequests.value = res.data.data
  totalRecentRequests.value = res.data.total
}, null, { immediate: false, resetOnExecute: false })

const fetchRecentRequests = () => executeFetchRecentRequests()

watch([page, limit, sortBy, sortDesc, systemFilter], () => {
  fetchRecentRequests()
})

watch([systemFilter, yearFilter, weekFilter], () => {
  fetchDashboardStats(false)
})

const handleRefresh = () => {
  fetchDashboardStats(true)
}

const handleReset = () => {
  yearFilter.value = []
  weekFilter.value = []
  // watcher will trigger fetch
}

// Scrollbar auto-hide logic for custom legend
const commodityLegendScrollRef = ref<HTMLElement | null>(null)
let legendScrollTimeout: number | null = null

const wakeLegendScrollbar = () => {
  if (commodityLegendScrollRef.value) {
    commodityLegendScrollRef.value.classList.remove('is-scrollbar-idle')
    if (legendScrollTimeout) clearTimeout(legendScrollTimeout)
    legendScrollTimeout = window.setTimeout(() => {
      if (commodityLegendScrollRef.value) {
        commodityLegendScrollRef.value.classList.add('is-scrollbar-idle')
      }
    }, 1000)
  }
}

// Socket Listeners
const initSocket = () => {
  const socket = socketService.getSocket()
  if (!socket) return

  const showUpdateToast = () => {
    if (!showNewDataToast.value) {
      showNewDataToast.value = true
      toast.info('Có dữ liệu mới. Nhấn Làm mới (Refresh) để xem!', {
        action: {
          label: 'Làm mới',
          onClick: () => handleRefresh()
        },
        duration: 10000
      })
    }
  }

  socket.on('fai_dashboard_updated', showUpdateToast)
  socket.on('lab_dashboard_updated', showUpdateToast)
}

onMounted(() => {
  fetchDashboardStats()
  fetchRecentRequests()
  initSocket()
  if (commodityLegendScrollRef.value) {
    commodityLegendScrollRef.value.classList.add('is-scrollbar-idle')
  }
})

onUnmounted(() => {
  const socket = socketService.getSocket()
  if (socket) {
    socket.off('fai_dashboard_updated')
    socket.off('lab_dashboard_updated')
  }
})

// --- CHART CONFIGURATIONS ---

const chartDark = computed(() => isDark.value)

const textColor = computed(() => chartDark.value ? '#e5e7eb' : '#374151')
const gridColor = computed(() => chartDark.value ? '#374151' : '#e5e7eb')

// 1. Status Chart (Horizontal Bar)
const statusData = computed(() => ({
  labels: systemFilter.value === 'FAI'
    ? [t('dashboard.closed'), t('dashboard.ongoing'), t('dashboard.backlog')]
    : [t('dashboard.closed'), t('dashboard.ongoing'), t('dashboard.backlog_assigned')],
  datasets: [
    {
      label: 'Requests',
      backgroundColor: ['#10b981', '#facc15', '#6b7280'],
      data: [
        stats.value.charts.status.closed,
        stats.value.charts.status.ongoing,
        stats.value.charts.status.backlog
      ]
    }
  ]
}))
const statusOptions = computed(() => ({
  animation: false as const,
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { right: 50 } }, // ponytail: layout padding avoids right-aligned labels clipping
  color: textColor.value,
  plugins: {
    legend: { display: false },
    datalabels: {
      color: textColor.value,
      anchor: 'end' as const,
      align: 'right' as const,
      font: { weight: 'bold' }
    }
  },
  scales: {
    x: { ticks: { color: textColor.value }, grid: { color: gridColor.value } },
    y: { ticks: { color: textColor.value }, grid: { display: false } }
  }
}))

// 2. Result Chart (Doughnut)
const resultData = computed(() => ({
  labels: ['Pass', 'Fail', 'TBD'],
  datasets: [
    {
      backgroundColor: ['#10b981', '#ef4444', '#6b7280'],
      data: [
        stats.value.charts.result.pass,
        stats.value.charts.result.fail,
        stats.value.charts.result.tbd
      ]
    }
  ]
}))
const doughnutOptions = computed(() => ({
  animation: false as const,
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: 20 }, // ponytail: safe margin for doughnut labels
  color: textColor.value,
  plugins: {
    legend: { display: false },
    datalabels: {
      color: '#fff',
      font: { weight: 'bold' },
      formatter: (value: number, ctx: any) => {
        if (value === 0) return '';
        const dataArr = ctx.chart.data.datasets[0].data as number[];
        const sum = dataArr.reduce((acc, val) => acc + val, 0);
        return ((value * 100) / sum).toFixed(1) + '%';
      }
    }
  }
}))

// 3. Commodity / Test Type Chart (Pie)
const commodityColors = ['#3b82f6', '#10b981', '#facc15', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const commodityData = computed(() => {
  const cData = stats.value.charts.commodity || []
  return {
    labels: cData.map((c: any) => c.name),
    datasets: [
      {
        backgroundColor: commodityColors,
        data: cData.map((c: any) => c.count)
      }
    ]
  }
})

const testTypeData = computed(() => {
  const tData = stats.value.charts.testType || []
  return {
    labels: tData.map((t: any) => t.name),
    datasets: [
      {
        backgroundColor: commodityColors,
        data: tData.map((t: any) => t.count)
      }
    ]
  }
})

const commodityDoughnutOptions = computed(() => ({
  animation: false as const,
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: 20 },
  color: textColor.value,
  plugins: {
    legend: { display: false },
    datalabels: doughnutOptions.value.plugins.datalabels
  }
}))

// 4. Pareto Chart (Bar + Line for Commodity Fails)
const paretoData = computed(() => {
  const pData = stats.value.charts.pareto || []
  const totalFails = pData.reduce((sum: number, item: any) => sum + item.count, 0)
  
  let cumulative = 0
  const cumulativePercents = pData.map((item: any) => {
    cumulative += item.count
    return totalFails > 0 ? (cumulative / totalFails) * 100 : 0
  })

  return {
    labels: pData.map((c: any) => c.name),
    datasets: [
      {
        type: 'line' as const,
        label: 'Cumulative %',
        data: cumulativePercents,
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        yAxisID: 'y1',
        datalabels: {
          display: true,
          align: 'top' as const,
          anchor: 'end' as const,
          color: '#000000',
          textStrokeColor: '#ffffff',
          textStrokeWidth: 3,
          formatter: (value: number) => value.toFixed(0) + '%'
        }
      },
      {
        type: 'bar' as const,
        label: 'Fails',
        data: pData.map((c: any) => c.count),
        backgroundColor: pData.map((_: any, i: number) => i < 3 ? '#1d4ed8' : '#60a5fa'), // Top 3 darker blue
        yAxisID: 'y',
        datalabels: {
          display: true,
          align: 'center' as const,
          anchor: 'center' as const,
          color: '#ffffff',
          font: { weight: 'bold' as const }
        }
      }
    ]
  }
})

const paretoOptions = computed(() => ({
  animation: false as const,
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 30 } }, // ponytail: top padding avoids line chart datalabels clipping
  color: textColor.value,
  plugins: {
    legend: { display: false }
  },
  scales: {
    x: {
      ticks: { 
        color: textColor.value,
        font: (ctx: any) => ctx.index < 3 ? { weight: 'bold' as const } : { weight: 'normal' as const }
      },
      grid: { display: false }
    },
    y: {
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      ticks: { color: textColor.value },
      grid: { color: gridColor.value }
    },
    y1: {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      ticks: { color: textColor.value, callback: (v: number) => v + '%' },
      grid: { display: false },
      min: 0,
      max: 100
    }
  }
}))

// 5. Count of Item Test By Date Chart (Stacked Bar)
const datasetColors = [
  '#3b82f6', '#10b981', '#facc15', '#ef4444', '#8b5cf6', 
  '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#06b6d4', '#10b981'
]

const itemTestByDateData = computed(() => {
  const chartData = stats.value.charts.itemTestByDate || { labels: [], datasets: [] }
  return {
    labels: chartData.labels,
    datasets: (chartData.datasets || []).map((ds: any, idx: number) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: datasetColors[idx % datasetColors.length]
    }))
  }
})

const transitionIndices = computed(() => {
  const dates = stats.value.charts.itemTestByDate?.rawDates || []
  const transitions = new Set<number>()
  for (let i = 1; i < dates.length; i++) {
    const prevMonth = new Date(dates[i - 1]).getMonth()
    const currMonth = new Date(dates[i]).getMonth()
    if (prevMonth !== currMonth) {
      transitions.add(i)
    }
  }
  return transitions
})

const itemTestByDateOptions = computed(() => ({
  animation: false as const,
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 30, bottom: 40 } },
  color: textColor.value,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        title: (tooltipItems: any) => {
          const index = tooltipItems[0].dataIndex;
          const dateStr = stats.value.charts.itemTestByDate?.rawDates[index];
          if (dateStr) {
            const date = new Date(dateStr);
            const day = date.getDate();
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const month = months[date.getMonth()];
            return `${day}, ${month}`;
          }
          return tooltipItems[0].label;
        }
      }
    },
    datalabels: {
      display: (context: any) => {
        return context.dataset.data[context.dataIndex] > 0;
      },
      color: '#ffffff',
      font: { weight: 'bold' as const },
      formatter: (value: number) => value.toString()
    }
  },
  scales: {
    x: {
      stacked: true,
      ticks: {
        color: textColor.value,
        callback: function(value: any) {
          const rawLabel = this.getLabelForValue(value);
          if (Array.isArray(rawLabel)) {
            return rawLabel[0];
          }
          return rawLabel;
        }
      },
      grid: {
        display: true,
        drawOnChartArea: true,
        drawTicks: true,
        color: (context: any) => {
          if (context.tick && transitionIndices.value.has(context.index)) {
            return gridColor.value
          }
          return 'transparent'
        },
        borderDash: [4, 4]
      }
    },
    y: {
      stacked: true,
      type: 'linear' as const,
      ticks: { color: textColor.value },
      grid: { color: gridColor.value }
    }
  }
}))

const itemTestByDateDataInvisible = computed(() => {
  const base = itemTestByDateData.value
  return {
    ...base,
    datasets: base.datasets.map(ds => ({
      ...ds,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      datalabels: { display: false }
    }))
  }
})

const itemTestByDateOptionsSticky = computed(() => {
  const base = itemTestByDateOptions.value
  return {
    ...base,
    animation: false as const,
    plugins: {
      ...base.plugins,
      tooltip: { enabled: false },
      datalabels: { display: false }
    },
    scales: {
      ...base.scales,
      x: {
        ...base.scales.x,
        ticks: { color: 'transparent' }
      }
    }
  }
})

const yAxisLeftBgPlugin = {
  id: 'yAxisLeftBgPlugin',
  beforeDraw(chart: any) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    ctx.save();
    ctx.fillStyle = isDark.value ? '#1f2937' : '#ffffff';
    ctx.fillRect(0, 0, chartArea.left, chart.height);
    ctx.restore();
  }
};

const computedMonthGroups = computed(() => {
  const dates = stats.value.charts.itemTestByDate?.rawDates || [];
  const groups: { monthName: string; firstIdx: number; lastIdx: number }[] = [];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  let currentKey = '';
  let currentGroup: { monthName: string; firstIdx: number; lastIdx: number } | null = null;
  
  dates.forEach((dStr: string, idx: number) => {
    const date = new Date(dStr);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (key !== currentKey) {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentKey = key;
      currentGroup = {
        monthName: months[date.getMonth()],
        firstIdx: idx,
        lastIdx: idx
      };
    } else if (currentGroup) {
      currentGroup.lastIdx = idx;
    }
  });
  
  if (currentGroup) {
    groups.push(currentGroup);
  }
  return groups;
});

const monthLabelPlugin = {
  id: 'monthLabelPlugin',
  afterDraw(chart: any) {
    const { ctx, chartArea, scales: { x } } = chart;
    if (!x || !chartArea) return;

    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.fillStyle = textColor.value;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    computedMonthGroups.value.forEach(group => {
      const xStart = x.getPixelForTick(group.firstIdx);
      const xEnd = x.getPixelForTick(group.lastIdx);
      const xCenter = (xStart + xEnd) / 2;

      // 27px below chartArea.bottom aligns perfectly in the empty second line space
      ctx.fillText(group.monthName, xCenter, chartArea.bottom + 27);
    });
    ctx.restore();
  }
};

const totalSumPlugin = {
  id: 'totalSumPlugin',
  afterDraw(chart: any) {
    const { ctx, scales: { x, y } } = chart;
    if (!x || !y) return;

    const datasets = chart.data.datasets;
    const activeMetas = chart.getSortedVisibleDatasetMetas();
    if (activeMetas.length === 0) return;

    ctx.save();
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = textColor.value;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Pre-extract data arrays of visible datasets to avoid lookups in loop
    const visibleDataArrays = datasets
      .filter((ds: any, idx: number) => {
        const meta = chart.getDatasetMeta(idx);
        return meta.visible !== false;
      })
      .map((ds: any) => ds.data);

    if (visibleDataArrays.length === 0) {
      ctx.restore();
      return;
    }

    const dataLength = datasets[0].data.length;
    for (let i = 0; i < dataLength; i++) {
      let sum = 0;
      for (let j = 0; j < visibleDataArrays.length; j++) {
        sum += visibleDataArrays[j][i] || 0;
      }

      if (sum > 0) {
        const topY = y.getPixelForValue(sum);
        const posX = x.getPixelForTick(i);
        ctx.fillText(sum.toString(), posX, topY - 4);
      }
    }
    ctx.restore();
  }
};

const itemTestByDateWidth = computed(() => {
  const numDays = stats.value.charts.itemTestByDate?.rawDates?.length || 0;
  if (numDays === 0) return '100%';
  const calculatedWidth = numDays * 50;
  return calculatedWidth > 800 ? `${Math.min(18000, calculatedWidth)}px` : '100%';
});

const isScrollable = computed(() => itemTestByDateWidth.value.endsWith('px'));
</script>

<template>
  <div class="dashboard-container flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 h-full transition-colors duration-300">
    
    <!-- Sticky Header -->
    <div class="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-md px-4 md:px-6 lg:px-8 py-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors duration-300">
      <div class="flex flex-col items-start gap-1 w-full md:w-auto">
        <h1 :key="systemFilter" class="text-2xl dashboard-title-fade">{{ systemFilter === 'FAI' ? t('dashboard.title') : t('dashboard.title_lab') }}</h1>
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center">
          <i class="bi bi-calendar3 mr-2"></i>
          {{ new Date().toLocaleDateString() }} - {{ t('dashboard.week_number', { n: currentWeek }) }}
        </span>
      </div>

      <div class="flex flex-wrap items-start gap-3 w-full md:w-auto mt-2 md:mt-0">
        <SingleSelectDropdown
          v-model="systemFilter"
          :options="systemOptions"
          :disabled="systemOptions.length <= 1"
          class="w-full sm:w-28"
        />

        <div class="flex flex-col gap-1 items-end w-full sm:w-auto">
          <div class="flex items-center gap-3 w-full sm:w-auto">
            <MultiSelectDropdown
              v-model="yearFilter"
              :options="yearsOptions"
              :placeholder="t('dashboard.year_all')"
              class="flex-1 sm:flex-none sm:w-32"
            />

            <MultiSelectDropdown
              v-model="weekFilter"
              :options="weeksOptions"
              :placeholder="t('dashboard.week_all')"
              class="flex-1 sm:flex-none sm:w-36"
            />
          </div>
          <button @click="setToCurrentWeek" class="text-[11px] text-primary hover:text-primary-dark dark:text-green-400 dark:hover:text-green-300 underline cursor-pointer mt-0.5">
            {{ t('dashboard.select_current') }}
          </button>
        </div>

        <Button @click="handleReset" variant="secondary" class="w-full sm:w-auto">
          {{ t('dashboard.reset') }}
        </Button>

        <Button @click="handleRefresh" class="w-full sm:w-auto gap-2">
          <i class="bi bi-arrow-clockwise" :class="{ 'animate-spin': isLoading }"></i>
          {{ t('dashboard.refresh') }}
        </Button>
      </div>
    </div>

    <!-- Main Content Container -->
    <div class="px-4 md:px-6 lg:px-8 pb-8">
      <div v-if="showNewDataToast" class="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mb-6 rounded shadow-sm flex justify-between items-center dark:bg-amber-900/30 dark:text-amber-300">
      <div class="flex items-center">
        <i class="bi bi-info-circle-fill mr-3 text-xl"></i>
        <p>{{ t('dashboard.new_data') }}</p>
      </div>
      <Button @click="handleRefresh" class="bg-amber-500 hover:bg-amber-600 text-white border-none shadow text-sm font-bold">
        {{ t('dashboard.reload_data') }}
      </Button>
    </div>

    <!-- KPIs Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
      <div v-for="kpi in kpiList" :key="kpi.label" class="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6 border border-gray-100 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden min-h-[120px]">
        <div class="absolute left-0 top-0 bottom-0 w-1.5" :class="kpi.color"></div>
        <span class="text-sm text-gray-500 dark:text-gray-400 font-medium pl-2">{{ kpi.label }}</span>
        <span class="text-4xl font-bold text-gray-800 dark:text-white mt-2 pl-2">{{ kpi.value }}</span>
      </div>
    </div>

    <!-- Charts Grid -->
    <div v-show="systemFilter === 'FAI'" class="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-8">
      
      <ChartCard class="lg:col-span-3" bodyClass="h-[330px] flex flex-col" title="Commodity Request Distribution">
        <div class="flex-1 min-h-[220px]">
          <Doughnut :data="commodityData" :options="commodityDoughnutOptions" />
        </div>
        <div class="overflow-x-auto whitespace-nowrap mt-4 pb-2 is-scrollbar-idle" ref="commodityLegendScrollRef" @scroll="wakeLegendScrollbar" @mousemove="wakeLegendScrollbar">
          <div class="flex gap-4 px-2 w-max mx-auto">
            <div v-for="(label, idx) in commodityData.labels" :key="label" class="flex items-center gap-1.5 text-xs text-text-muted">
              <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: commodityColors[idx % commodityColors.length] }"></div>
              {{ label }}
            </div>
          </div>
        </div>
      </ChartCard>

      <ChartCard class="lg:col-span-7" title="FAI Status Overview">
        <Bar :data="statusData" :options="statusOptions" />
      </ChartCard>

      <ChartCard class="lg:col-span-3" bodyClass="h-[330px] flex flex-col" title="FAI Result Overview">
        <div class="flex-1 min-h-[220px]">
          <Doughnut :data="resultData" :options="doughnutOptions" />
        </div>
        <div class="flex flex-wrap gap-4 justify-center mt-4 pb-2">
          <div v-for="(label, idx) in resultData.labels" :key="label" class="flex items-center gap-1.5 text-xs text-text-muted">
            <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: resultData.datasets[0].backgroundColor[idx] }"></div>
            {{ label }}
          </div>
        </div>
      </ChartCard>

      <ChartCard class="lg:col-span-7" bodyClass="h-[330px] flex flex-col" title="Commodity Pareto (Failure Mode)">
        <div class="flex-1 min-h-[220px]">
          <Bar :data="paretoData" :options="paretoOptions" />
        </div>
        <div class="flex flex-wrap gap-4 justify-center mt-4 pb-2">
          <div v-for="(dataset, idx) in paretoData.datasets" :key="dataset.label" class="flex items-center gap-1.5 text-xs text-text-muted">
            <div :class="['w-4', dataset.type === 'line' ? 'h-1 border-t-2 border-dashed bg-transparent' : 'h-4 rounded-sm']" :style="{ backgroundColor: dataset.type === 'line' ? 'transparent' : dataset.backgroundColor, borderColor: dataset.borderColor }"></div>
            {{ dataset.label }}
          </div>
        </div>
      </ChartCard>

    </div>

    <div v-show="systemFilter === 'LAB'" class="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-8">
      
      <ChartCard class="lg:col-span-3" bodyClass="h-[330px] flex flex-col" :title="t('dashboard.test_type_dist')">
        <div class="flex-1 min-h-[220px]">
          <Doughnut :data="testTypeData" :options="commodityDoughnutOptions" />
        </div>
        <div class="overflow-x-auto whitespace-nowrap mt-4 pb-2 is-scrollbar-idle" ref="commodityLegendScrollRef" @scroll="wakeLegendScrollbar" @mousemove="wakeLegendScrollbar">
          <div class="flex gap-4 px-2 w-max mx-auto">
            <div v-for="(label, idx) in testTypeData.labels" :key="label" class="flex items-center gap-1.5 text-xs text-text-muted">
              <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: commodityColors[idx % commodityColors.length] }"></div>
              {{ label }}
            </div>
          </div>
        </div>
      </ChartCard>

      <ChartCard class="lg:col-span-7" :title="t('dashboard.lab_status')">
        <Bar :data="statusData" :options="statusOptions" />
      </ChartCard>

      <ChartCard class="lg:col-span-3" bodyClass="h-[330px] flex flex-col" :title="t('dashboard.lab_result')">
        <div class="flex-1 min-h-[220px]">
          <Doughnut :data="resultData" :options="doughnutOptions" />
        </div>
        <div class="flex flex-wrap gap-4 justify-center mt-4 pb-2">
          <div v-for="(label, idx) in resultData.labels" :key="label" class="flex items-center gap-1.5 text-xs text-text-muted">
            <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: resultData.datasets[0].backgroundColor[idx] }"></div>
            {{ label }}
          </div>
        </div>
      </ChartCard>

      <ChartCard class="lg:col-span-7" bodyClass="h-[330px] flex flex-col" :title="t('dashboard.item_test_by_date')">
        <div class="relative w-full">
          <!-- Sticky Left Axis -->
          <div v-if="isScrollable" class="absolute left-0 top-0 h-[285px] w-[30px] bg-transparent z-10 pointer-events-none overflow-hidden">
            <div :style="{ minWidth: itemTestByDateWidth }" class="h-[285px]">
              <Bar :data="itemTestByDateDataInvisible" :options="itemTestByDateOptionsSticky" :plugins="[yAxisLeftBgPlugin]" />
            </div>
          </div>

          <!-- Scrollable Chart Container -->
          <div class="overflow-x-auto w-full">
            <div :style="{ minWidth: itemTestByDateWidth }" class="h-[285px]">
              <Bar :data="itemTestByDateData" :options="itemTestByDateOptions" :plugins="[monthLabelPlugin, totalSumPlugin]" />
            </div>
          </div>
        </div>

        <!-- Custom Legend at the bottom -->
        <div class="flex flex-wrap gap-4 justify-center mt-4 pb-2">
          <div v-for="(dataset, idx) in itemTestByDateData.datasets" :key="dataset.label" class="flex items-center gap-1.5 text-xs text-text-muted">
            <div class="w-3 h-3 rounded-sm" :style="{ backgroundColor: dataset.backgroundColor }"></div>
            {{ dataset.label }}
          </div>
        </div>
      </ChartCard>

    </div>

    <!-- FAI First Pass Yield Chart Section (Conditional) -->
    <div v-if="systemFilter === 'FAI' && authStore.hasPermission('VIEW_FIRST_PASS_YIELD') && stats.charts.weeklyYield?.length" class="mb-8">
      <FaiFirstPassYieldChart :data="stats.charts.weeklyYield" />
    </div>

    <!-- Recent Requests List -->
    <div v-if="authStore.hasPermission('MANAGE_REQUEST_LIST')" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-8 transition-colors duration-300">
      <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center transition-colors duration-300">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white m-0">
          {{ systemFilter === 'FAI' ? t('dashboard.recent_requests') : t('dashboard.recent_lab_requests') }}
        </h2>
        <Button 
          @click="router.push(`/${systemFilter.toLowerCase()}/request/list`)"
          variant="secondary" size="sm"
        >
          {{ t('dashboard.view_all') }} &rarr;
        </Button>
      </div>
      
      <div class="p-4 h-[600px] flex flex-col">
        <DataTable 
          :columns="recentColumns" 
          :data="recentRequests" 
          :isLoading="isRecentLoading"
          rowKey="id"
          :sortBy="sortBy"
          :sortDesc="sortDesc"
          @sort="toggleSort"
          class="flex-1 min-h-0"
        >
          <template #cell-requestor_id="{ item }">{{ item.requestor?.full_name || item.requestor_id || '-' }}</template>
          <template #cell-inspector_id="{ item }">{{ item.inspector?.full_name || item.inspector_id || '-' }}</template>
          <template #cell-tracking_no="{ item }">{{ item.tracking_no || '-' }}</template>
          <template #cell-revision="{ item }">{{ item.revision || '-' }}</template>
          <template #cell-address="{ item }">{{ item.address || '-' }}</template>
          
          <template #cell-priority="{ item }">
            <span v-if="item.priority" :class="item.priority === 'Urgent' ? 'text-danger font-semibold' : ''">
              {{ item.priority }}
            </span>
            <span v-else>-</span>
          </template>

          <template #cell-commodity_part="{ item }">{{ item.commodityPartRel?.name || item.commodity_part || '-' }}</template>
          <template #cell-part_type="{ item }">{{ item.part_type || '-' }}</template>
          <template #cell-reason_for_submission="{ item }">{{ item.reason_for_submission || '-' }}</template>
          <template #cell-submission_time="{ item }">{{ formatOrdinal(item.submission_time) }}</template>
          <template #cell-complete_date="{ item }">{{ formatDateOnly(item.complete_date) }}</template>
          <template #cell-updated_at="{ item }">{{ formatDate(item.updated_at) }}</template>
          <template #cell-estimated_date="{ item }">{{ formatDateOnly(item.estimated_date) }}</template>
          <template #cell-receive_date="{ item }">
            {{ systemFilter === 'FAI' ? formatDateOnly(item.receive_date) : formatDateOnly(item.sample_received_date) }}
          </template>
          <template #cell-result="{ item }"><ResultBadge :result="item.result" /></template>
          <template #cell-fai_failure_mode="{ item }">{{ item.fai_failure_mode || '-' }}</template>
          <template #cell-remark="{ item }">{{ item.remark || '-' }}</template>
          <template #cell-created_at="{ item }">{{ formatDate(item.created_at) }}</template>

          <!-- LAB requests slots -->
          <template #cell-test_no="{ item }">{{ item.test_no || '-' }}</template>
          <template #cell-model_no="{ item }">{{ item.model_no || '-' }}</template>
          <template #cell-model_description="{ item }">{{ item.model_description || '-' }}</template>
          <template #cell-quantity="{ item }">{{ item.quantity || '-' }}</template>
          <template #cell-product_sn="{ item }">{{ item.product_sn || '-' }}</template>
          <template #cell-stage="{ item }">{{ item.stage || '-' }}</template>
          <template #cell-priority_reason="{ item }">
            <div 
              class="truncate max-w-[150px]" 
              :class="item.priority === 'Urgent' ? 'text-danger font-semibold' : ''"
              :title="item.priority_reason || ''"
            >
              {{ item.priority_reason || '-' }}
            </div>
          </template>
          <template #cell-return_date="{ item }">{{ formatDateOnly(item.sample_return_date) }}</template>
          
          <template #cell-status="{ item }">
            <StatusBadge 
              :isActive="item.status !== 'Draft'" 
              :activeText="getStatusText(item.status)" 
              :inactiveText="t('fai.status_draft')" 
              :variant="getStatusVariant(item.status)"
            />
          </template>

          <template #cell-actions="{ item }">
            <div class="flex items-center justify-center">
              <Button 
                variant="secondary" size="sm" class="text-xs px-3 py-1"
                @click="router.push(`/${systemFilter.toLowerCase()}/request/${item.id}`)"
              >
                {{ t('fai.details') }}
              </Button>
            </div>
          </template>
        </DataTable>

        <Pagination :total="totalRecentRequests" v-model="page" v-model:rowsPerPage="limit" class="mt-4" />
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>
@keyframes titleWipe {
  from {
    clip-path: inset(0 100% 0 0);
    transform: translateX(-12px);
    opacity: 0;
  }
  to {
    clip-path: inset(0 0 0 0);
    transform: translateX(0);
    opacity: 1;
  }
}

.dashboard-title-fade {
  animation: titleWipe 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  display: inline-block;
}
</style>

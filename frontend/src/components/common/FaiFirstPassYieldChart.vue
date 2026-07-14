<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bar } from 'vue-chartjs'
import Input from '@/components/ui/Input.vue'
import ChartCard from '@/components/common/ChartCard.vue'
import { useDark } from '@vueuse/core'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  LineController,
  BarController
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  LineController,
  BarController,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
)

const props = defineProps<{
  data: any[]
}>()

const { t } = useI18n()
const isDark = useDark()

// Scrollbar auto-hide logic (Ponytail-style: inline the simple logic)
const chartContainerRef = ref<HTMLElement | null>(null)
const tableContainerRef = ref<HTMLElement | null>(null)
let scrollTimeout: number | null = null

const wakeScrollbar = () => {
  [chartContainerRef.value, tableContainerRef.value].forEach(el => {
    if (el) el.classList.remove('is-scrollbar-idle')
  })
  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = window.setTimeout(() => {
    [chartContainerRef.value, tableContainerRef.value].forEach(el => {
      if (el) el.classList.add('is-scrollbar-idle')
    })
  }, 1000)
}

onMounted(() => {
  [chartContainerRef.value, tableContainerRef.value].forEach(el => {
    if (el) el.classList.add('is-scrollbar-idle')
  })
})

// Lấy/Lưu Goal Threshold từ localStorage
const GOAL_STORAGE_KEY = 'fai_first_pass_yield_goal'
const defaultGoal = 96
const goalRate = ref<number>(
  Number(localStorage.getItem(GOAL_STORAGE_KEY)) || defaultGoal
)

watch(goalRate, (newVal) => {
  localStorage.setItem(GOAL_STORAGE_KEY, newVal.toString())
})

const chartDark = computed(() => isDark.value)
const textColor = computed(() => chartDark.value ? '#e5e7eb' : '#374151')
const gridColor = computed(() => chartDark.value ? '#374151' : '#e5e7eb')

// --- Chart Configuration ---
const chartData = computed(() => {
  const weeks = props.data.map(d => d.week)
  const goalArray = Array(props.data.length).fill(goalRate.value)

  return {
    labels: weeks,
    datasets: [
      {
        type: 'line' as const,
        label: 'FAI Pass Rate',
        data: props.data.map(d => parseFloat(d.passRate)),
        borderColor: '#10b981', // green-500
        backgroundColor: '#10b981',
        yAxisID: 'y1',
        tension: 0,
        datalabels: {
          display: true,
          align: 'top' as const,
          color: '#10b981',
          font: { weight: 'bold' },
          formatter: (value: number) => value.toFixed(2) + '%'
        }
      },
      {
        type: 'line' as const,
        label: 'Goal',
        data: goalArray,
        borderColor: '#3b82f6', // blue-500
        backgroundColor: '#3b82f6',
        yAxisID: 'y1',
        tension: 0,
        borderDash: [5, 5],
        pointRadius: 0,
        datalabels: {
          display: (context: any) => context.dataIndex === props.data.length - 1, // Only show label on last point
          align: 'top' as const,
          color: '#3b82f6',
          font: { weight: 'bold' },
          formatter: (value: number) => value.toFixed(2) + '%'
        }
      },
      {
        type: 'bar' as const,
        label: 'Received Lots',
        data: props.data.map(d => d.received),
        backgroundColor: '#f97316', // orange-500
        yAxisID: 'y',
        datalabels: {
          display: true,
          align: 'end' as const,
          color: textColor.value,
          formatter: (v: number) => v > 0 ? v : ''
        }
      },
      {
        type: 'bar' as const,
        label: 'Inspection Lots',
        data: props.data.map(d => d.inspection),
        backgroundColor: '#9ca3af', // gray-400
        yAxisID: 'y',
        datalabels: {
          display: true,
          align: 'end' as const,
          color: textColor.value,
          formatter: (v: number) => v > 0 ? v : ''
        }
      },
      {
        type: 'bar' as const,
        label: 'Failure Lots',
        data: props.data.map(d => d.failure),
        backgroundColor: '#eab308', // yellow-500
        yAxisID: 'y',
        datalabels: {
          display: true,
          align: 'end' as const,
          color: textColor.value,
          formatter: (v: number) => v > 0 ? v : ''
        }
      }
    ]
  }
})

const chartDataInvisible = computed(() => {
  const base = chartData.value;
  return {
    ...base,
    datasets: base.datasets.map(ds => ({
      ...ds,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      datalabels: { display: false }
    }))
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 30, right: 20 } },
  color: textColor.value,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    }
  },
  scales: {
    x: {
      stacked: false,
      ticks: { color: textColor.value },
      grid: { display: false }
    },
    y: {
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      title: { display: true, text: 'Quantity', color: textColor.value, padding: { bottom: 12 } },
      ticks: { color: textColor.value },
      grid: { color: gridColor.value },
      min: 0,
      max: Math.max(...props.data.map(d => d.received)) + 10
    },
    y1: {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      title: { display: true, text: 'Percentage (%)', color: textColor.value, padding: { bottom: 12 } },
      ticks: { color: textColor.value, callback: (v: number) => v + '%' },
      grid: { display: false },
      min: 0,
      max: 100
    }
  }
}))

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

const yAxisRightBgPlugin = {
  id: 'yAxisRightBgPlugin',
  beforeDraw(chart: any) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    ctx.save();
    ctx.fillStyle = isDark.value ? '#1f2937' : '#ffffff';
    ctx.fillRect(chartArea.right, 0, chart.width - chartArea.right, chart.height);
    ctx.restore();
  }
};

const chartOptionsSticky = computed(() => {
  const base = chartOptions.value;
  return {
    ...base,
    animation: false,
    plugins: {
      ...base.plugins,
      tooltip: { enabled: false }
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

</script>

<template>
  <ChartCard title="FAI First Pass Yield %" bodyClass="h-auto">
    <template #header-actions>
      <div class="flex items-center gap-2">
        <label class="text-sm text-text-muted font-medium">Goal (%)</label>
        <Input 
          v-model.number="goalRate" 
          type="number" 
          :min="0" 
          :max="100" 
          class="w-20 !py-1 text-center font-bold text-blue-600"
        />
      </div>
    </template>
    
    <div>
      <!-- Custom External Legend -->
      <div class="flex flex-wrap items-center justify-center gap-4 mb-4 text-xs sm:text-sm font-medium text-text-muted">
        <div class="flex items-center gap-1.5"><div class="w-8 h-1 bg-green-500"></div> FAI Pass Rate</div>
        <div class="flex items-center gap-1.5"><div class="w-8 h-1 bg-blue-500 border-t-2 border-dashed border-blue-500 bg-transparent"></div> Goal</div>
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 bg-orange-500 rounded-sm"></div> Received Lots</div>
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 bg-gray-400 rounded-sm"></div> Inspection Lots</div>
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 bg-yellow-500 rounded-sm"></div> Failure Lots</div>
      </div>

      <!-- Chart Area with Horizontal Scroll and Sticky Axes -->
      <div class="relative w-full mb-6">
        <!-- Sticky Left Axis -->
        <div class="absolute left-0 top-0 h-[400px] w-[100px] bg-transparent z-10 pointer-events-none overflow-hidden">
          <div style="min-width: 3000px; height: 400px;">
            <Bar :data="chartDataInvisible" :options="chartOptionsSticky" :plugins="[yAxisLeftBgPlugin]" />
          </div>
        </div>
        
        <!-- Sticky Right Axis -->
        <div class="absolute right-0 top-0 h-[400px] w-[100px] bg-transparent z-10 pointer-events-none overflow-hidden">
          <div style="min-width: 3000px; height: 400px; position: absolute; right: 0;">
            <Bar :data="chartDataInvisible" :options="chartOptionsSticky" :plugins="[yAxisRightBgPlugin]" />
          </div>
        </div>

        <div class="overflow-x-auto w-full is-scrollbar-idle" ref="chartContainerRef" @scroll="wakeScrollbar" @mousemove="wakeScrollbar">
          <div style="min-width: 3000px; height: 400px;">
            <Bar :data="chartData" :options="chartOptions" />
          </div>
        </div>
      </div>

      <!-- Data Table Area with Horizontal Scroll -->
      <div class="overflow-x-auto w-full border border-border rounded-md is-scrollbar-idle" ref="tableContainerRef" @scroll="wakeScrollbar" @mousemove="wakeScrollbar">
        <table class="w-full text-xs sm:text-sm text-center border-collapse">
          <thead>
            <tr class="bg-primary text-bg border-b border-border">
              <th class="py-2 px-3 border-r border-border font-semibold sticky left-0 bg-primary z-10 text-left min-w-[120px]">Month/Week</th>
              <th v-for="d in props.data" :key="d.week" class="py-2 px-3 border-r border-border font-semibold min-w-[60px]">{{ d.week }}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-border bg-blue-50 dark:bg-blue-900">
              <td class="py-2 px-3 border-r border-border font-semibold sticky left-0 bg-blue-100 dark:bg-blue-800 z-10 text-left text-blue-800 dark:text-blue-200">Goal</td>
              <td v-for="d in props.data" :key="d.week" class="py-2 px-3 border-r border-border font-medium text-blue-700 dark:text-blue-300">{{ goalRate.toFixed(2) }}%</td>
            </tr>
            <tr class="border-b border-border">
              <td class="py-2 px-3 border-r border-border font-medium sticky left-0 bg-bg-surface z-10 text-left">Received Lots</td>
              <td v-for="d in props.data" :key="d.week" class="py-2 px-3 border-r border-border text-text-muted">{{ d.received || '' }}</td>
            </tr>
            <tr class="border-b border-border">
              <td class="py-2 px-3 border-r border-border font-medium sticky left-0 bg-bg-surface z-10 text-left">Inspection Lots</td>
              <td v-for="d in props.data" :key="d.week" class="py-2 px-3 border-r border-border text-text-muted">{{ d.inspection || '' }}</td>
            </tr>
            <tr class="border-b border-border">
              <td class="py-2 px-3 border-r border-border font-medium sticky left-0 bg-bg-surface z-10 text-left">Failure Lots</td>
              <td v-for="d in props.data" :key="d.week" class="py-2 px-3 border-r border-border font-bold text-red-500">{{ d.failure || '' }}</td>
            </tr>
            <tr class="border-b border-border bg-gray-50 dark:bg-gray-700/50">
              <td class="py-2 px-3 border-r border-border font-bold sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 text-left">FAI Pass Rate</td>
              <td v-for="d in props.data" :key="d.week" class="py-2 px-3 border-r border-border font-bold text-text">{{ d.passRate }}%</td>
            </tr>
            <tr>
              <td class="py-2 px-3 border-r border-border font-medium sticky left-0 bg-yellow-200 dark:bg-yellow-600 z-10 text-left">Pending FAI (qty)</td>
              <td v-for="d in props.data" :key="d.week" class="py-2 px-3 border-r border-border text-center bg-yellow-50 dark:bg-yellow-600">{{ d.pending || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </ChartCard>
</template>

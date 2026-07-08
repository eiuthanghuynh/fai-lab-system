<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFaiStore } from '@/stores/faiStore'
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
import { Bar, Doughnut, Line } from 'vue-chartjs'
import { useDark } from '@vueuse/core'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

const { t } = useI18n()
const faiStore = useFaiStore()
const isDark = useDark()

onMounted(() => {
  faiStore.fetchAllRequests()
})

const stats = computed(() => faiStore.dashboardStats)

// Chart options to adapt to Dark Mode dynamically
const chartOptions = computed(() => {
  const textColor = isDark.value ? '#e5e7eb' : '#374151'; // Tailwind gray-200 : gray-700
  const gridColor = isDark.value ? '#374151' : '#e5e7eb'; // Tailwind gray-700 : gray-200

  return {
    responsive: true,
    maintainAspectRatio: false,
    color: textColor,
    plugins: {
      legend: {
        labels: { color: textColor }
      },
      title: {
        display: false
      }
    },
    scales: {
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor }
      },
      y: {
        ticks: { color: textColor },
        grid: { color: gridColor }
      }
    }
  }
})

const doughnutOptions = computed(() => {
  const textColor = isDark.value ? '#e5e7eb' : '#374151';
  return {
    responsive: true,
    maintainAspectRatio: false,
    color: textColor,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { color: textColor }
      }
    }
  }
})

// Data for Status Chart
const statusData = computed(() => ({
  labels: [t('dashboard.closed'), t('dashboard.ongoing'), t('dashboard.backlog'), t('fai.status_rejected')],
  datasets: [
    {
      label: 'Requests',
      backgroundColor: ['#63e079', '#f2c94c', '#ef4444', '#6b7280'],
      data: [stats.value.closed, stats.value.ongoing, stats.value.backlog, stats.value.rejected]
    }
  ]
}))

// Data for Result Chart
const resultData = computed(() => ({
  labels: ['PASS', 'FAIL', 'TBD (Blank)'],
  datasets: [
    {
      backgroundColor: ['#63e079', '#ef4444', '#9ca3af'],
      data: [stats.value.pass, stats.value.fail, stats.value.blank]
    }
  ]
}))

// Data for Commodity Chart
const commodityData = computed(() => {
  const labels = Object.keys(stats.value.commodityTotalCounts)
  const data = Object.values(stats.value.commodityTotalCounts)
  
  // Generating some colors based on index
  const colors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e']
  
  return {
    labels,
    datasets: [
      {
        backgroundColor: labels.map((_, i) => colors[i % colors.length]),
        data
      }
    ]
  }
})

// Data for Pareto Chart (Failures by Commodity)
const paretoData = computed(() => {
  const fails = stats.value.commodityFailCounts;
  const sortedCommodities = Object.keys(fails).sort((a, b) => fails[b] - fails[a]);
  const barData = sortedCommodities.map(c => fails[c]);
  
  const totalFails = barData.reduce((sum, val) => sum + val, 0);
  let cumulative = 0;
  const lineData = barData.map(val => {
    cumulative += val;
    return totalFails > 0 ? (cumulative / totalFails) * 100 : 0;
  });

  return {
    labels: sortedCommodities,
    datasets: [
      {
        type: 'line' as const,
        label: 'Cumulative %',
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderWidth: 2,
        fill: false,
        data: lineData,
        yAxisID: 'y1',
      },
      {
        type: 'bar' as const,
        label: 'Failures',
        backgroundColor: '#ef4444',
        data: barData,
        yAxisID: 'y',
      }
    ]
  }
})

const paretoOptions = computed(() => {
  const base = chartOptions.value;
  return {
    ...base,
    scales: {
      x: base.scales.x,
      y: {
        ...base.scales.y,
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false, // only want the grid lines for one axis to show up
        },
        ticks: {
          color: base.scales.y.ticks.color,
          callback: function(value: any) {
            return value + '%';
          }
        },
        max: 100,
        min: 0
      },
    }
  }
})

const passRate = computed(() => {
  const totalDone = stats.value.pass + stats.value.fail;
  if (totalDone === 0) return 0;
  return Math.round((stats.value.pass / totalDone) * 100);
});

</script>

<template>
  <div class="dashboard-container">
    <div class="header">
      <h2>{{ t('dashboard.title') }}</h2>
      <div class="actions">
        <!-- Placeholder for filters (Year/Week) -->
        <button class="btn-secondary">{{ t('common.reset') || 'Reset' }}</button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <h3>{{ t('dashboard.total_fai') }}</h3>
        <div class="kpi-value">{{ stats.total }}</div>
      </div>
      <div class="kpi-card">
        <h3>{{ t('dashboard.closed') }}</h3>
        <div class="kpi-value text-success">{{ stats.closed }}</div>
      </div>
      <div class="kpi-card">
        <h3>{{ t('dashboard.backlog') }}</h3>
        <div class="kpi-value text-danger">{{ stats.backlog }}</div>
      </div>
      <div class="kpi-card">
        <h3>{{ t('dashboard.pass_rate') }}</h3>
        <div class="kpi-value text-primary">{{ passRate }}%</div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="charts-grid">
      <!-- Status Chart -->
      <div class="chart-card">
        <h3>{{ t('dashboard.fai_status') }}</h3>
        <div class="chart-wrapper">
          <Bar :data="statusData" :options="chartOptions" />
        </div>
      </div>

      <!-- Result Doughnut -->
      <div class="chart-card">
        <h3>{{ t('dashboard.fai_result') }}</h3>
        <div class="chart-wrapper">
          <Doughnut :data="resultData" :options="doughnutOptions" />
        </div>
      </div>

      <!-- Commodity Doughnut -->
      <div class="chart-card">
        <h3>{{ t('dashboard.fai_commodity') }}</h3>
        <div class="chart-wrapper">
          <Doughnut :data="commodityData" :options="doughnutOptions" />
        </div>
      </div>

      <!-- Pareto Chart -->
      <div class="chart-card pareto-card">
        <h3>{{ t('dashboard.fai_pareto') }}</h3>
        <div class="chart-wrapper pareto-wrapper">
          <!-- We use Bar but with mixed dataset type in paretoData -->
          <Bar :data="paretoData" :options="paretoOptions" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.kpi-card {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.kpi-card h3 {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.kpi-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.text-success { color: #10b981; }
.text-danger { color: #ef4444; }
.text-primary { color: #3b82f6; }

.charts-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 1.5rem;
}

.chart-card {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  grid-column: span 4;
}

.pareto-card {
  grid-column: span 12;
}

.chart-card h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin-top: 0;
  margin-bottom: 1.5rem;
  text-align: center;
}

.chart-wrapper {
  position: relative;
  height: 300px;
  width: 100%;
}

.pareto-wrapper {
  height: 400px;
}

/* Responsiveness */
@media (max-width: 1024px) {
  .chart-card {
    grid-column: span 6;
  }
}

@media (max-width: 768px) {
  .chart-card {
    grid-column: span 12;
  }
}
</style>

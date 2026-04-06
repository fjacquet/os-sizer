<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, Title, Tooltip, Legend,
  BarElement, CategoryScale, LinearScale,
} from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import { useCalculationStore } from '@/stores/calculationStore'
import { useInputStore } from '@/stores/inputStore'
import type { NodeSpec } from '@/engine/types'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const { t } = useI18n()
const calc = useCalculationStore()
const input = useInputStore()
const { clusterResults } = storeToRefs(calc)
const { activeClusterIndex } = storeToRefs(input)

const activeResult = computed(() => clusterResults.value[activeClusterIndex.value] ?? clusterResults.value[0])

type NodeRow = { labelKey: string; spec: NodeSpec }

const rows = computed((): NodeRow[] => {
  const s = activeResult.value?.sizing
  if (!s) return []
  const all: NodeRow[] = [
    { labelKey: 'node.masters', spec: s.masterNodes },
    ...(s.workerNodes ? [{ labelKey: 'node.workers', spec: s.workerNodes }] : []),
    ...(s.infraNodes ? [{ labelKey: 'node.infra', spec: s.infraNodes }] : []),
    ...(s.odfNodes ? [{ labelKey: 'node.storage', spec: s.odfNodes }] : []),
    ...(s.rhacmWorkers ? [{ labelKey: 'results.bom.rhacmWorkers', spec: s.rhacmWorkers }] : []),
  ]
  return all
})

const chartData = computed((): ChartData<'bar'> => ({
  labels: rows.value.map(r => t(r.labelKey)),
  datasets: [{
    label: t('results.charts.vcpu'),
    data: rows.value.map(r => r.spec.count * r.spec.vcpu),
    backgroundColor: 'rgba(220,38,38,0.7)',
    borderColor: 'rgba(220,38,38,1)',
    borderWidth: 1,
  }],
}))

const chartOptions = computed((): ChartOptions<'bar'> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
  scales: {
    y: { beginAtZero: true, ticks: { color: 'rgb(75,85,99)' }, grid: { color: 'rgba(156,163,175,0.3)' } },
    x: { ticks: { color: 'rgb(75,85,99)' }, grid: { color: 'rgba(156,163,175,0.3)' } },
  },
}))
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4 break-inside-avoid">
    <h3 class="text-sm font-semibold text-gray-700 mb-2">{{ t('results.charts.vcpu') }}</h3>
    <div class="h-48 relative print:hidden">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

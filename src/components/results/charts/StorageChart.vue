<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import { useCalculationStore } from '@/stores/calculationStore'
import { useInputStore } from '@/stores/inputStore'
import type { NodeSpec } from '@/engine/types'

ChartJS.register(Title, Tooltip, Legend, ArcElement)

const { t } = useI18n()
const calc = useCalculationStore()
const input = useInputStore()
const { clusterResults } = storeToRefs(calc)
const { activeClusterIndex } = storeToRefs(input)

const activeResult = computed(() => clusterResults.value[activeClusterIndex.value] ?? clusterResults.value[0])

const COLORS = [
  'rgba(220,38,38,0.7)',
  'rgba(37,99,235,0.7)',
  'rgba(5,150,105,0.7)',
  'rgba(245,158,11,0.7)',
  'rgba(139,92,246,0.7)',
]

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

const chartData = computed((): ChartData<'doughnut'> => ({
  labels: rows.value.map(r => t(r.labelKey)),
  datasets: [{
    data: rows.value.map(r => r.spec.count * r.spec.storageGB),
    backgroundColor: rows.value.map((_, i) => COLORS[i % COLORS.length]),
  }],
}))

const chartOptions = computed((): ChartOptions<'doughnut'> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: 'right' }, tooltip: { enabled: true } },
}))
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4 break-inside-avoid">
    <h3 class="text-sm font-semibold text-gray-700 mb-2">{{ t('results.charts.storage') }}</h3>
    <div class="h-48 relative print:hidden">
      <Doughnut :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

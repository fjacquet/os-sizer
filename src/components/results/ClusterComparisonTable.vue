<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useCalculationStore } from '@/stores/calculationStore'
import { useInputStore } from '@/stores/inputStore'
import type { ClusterSizing } from '@/engine/types'

const { t } = useI18n()
const calc = useCalculationStore()
const input = useInputStore()
const { clusterResults } = storeToRefs(calc)
const { clusters } = storeToRefs(input)

function roleLabelShort(role: 'hub' | 'spoke' | 'standalone' | undefined): string {
  switch (role) {
    case 'hub': return t('results.clusters.roleHub')
    case 'spoke': return t('results.clusters.roleSpoke')
    default: return t('results.clusters.roleStandalone')
  }
}

function roleBadgeClass(role: 'hub' | 'spoke' | 'standalone' | undefined): string {
  switch (role) {
    case 'hub': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'spoke': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
}

function fmt(val: number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined) return '—'
  return `${val}${suffix}`
}

interface MetricRow {
  labelKey: string
  getValue: (sizing: ClusterSizing) => string
  bold?: boolean
}

const metricRows = computed<MetricRow[]>(() => [
  { labelKey: 'node.masters', getValue: (s) => fmt(s.masterNodes.count) },
  { labelKey: 'node.vcpu', getValue: (s) => fmt(s.masterNodes.vcpu) + ' vCPU' },
  { labelKey: 'node.ramGB', getValue: (s) => fmt(s.masterNodes.ramGB) + ' GB' },
  { labelKey: 'node.workers', getValue: (s) => fmt(s.workerNodes?.count) },
  { labelKey: 'node.infra', getValue: (s) => fmt(s.infraNodes?.count) },
  { labelKey: 'node.storage', getValue: (s) => fmt(s.odfNodes?.count) },
  { labelKey: 'results.bom.rhacmWorkers', getValue: (s) => fmt(s.rhacmWorkers?.count) },
  { labelKey: 'node.virtWorkers', getValue: (s) => fmt(s.virtWorkerNodes?.count) },
  { labelKey: 'node.gpu', getValue: (s) => fmt(s.gpuNodes?.count) },
  { labelKey: 'results.totalCpu', getValue: (s) => fmt(s.totals.vcpu) + ' vCPU', bold: true },
  { labelKey: 'results.totalRam', getValue: (s) => fmt(s.totals.ramGB) + ' GB', bold: true },
  { labelKey: 'results.totalStorage', getValue: (s) => fmt(s.totals.storageGB) + ' GB', bold: true },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
    <table class="w-full text-sm border-collapse" :aria-label="t('results.clusters.compareTitle')">
      <caption class="text-left text-base font-semibold text-gray-900 dark:text-gray-100 mb-2 px-3 pt-3">
        {{ t('results.clusters.compareTitle') }}
      </caption>
      <thead class="bg-gray-50 dark:bg-gray-700">
        <tr>
          <!-- Metric label column header -->
          <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 min-w-36">
            {{ t('results.clusters.roleLabel') }}
          </th>
          <!-- One column per cluster -->
          <th
            v-for="cluster in clusters"
            :key="cluster.id"
            class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 min-w-28"
          >
            <div class="flex items-center gap-1">
              <span
                class="text-xs font-semibold px-1 rounded"
                :class="roleBadgeClass(cluster.role)"
              >
                {{ roleLabelShort(cluster.role) }}
              </span>
              <span class="truncate max-w-24">{{ cluster.name }}</span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in metricRows"
          :key="row.labelKey"
          class="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
        >
          <!-- Row metric label -->
          <td
            class="px-3 py-2 text-gray-700 dark:text-gray-300"
            :class="row.bold ? 'font-bold' : ''"
          >
            {{ t(row.labelKey) }}
          </td>
          <!-- One cell per cluster result -->
          <td
            v-for="result in clusterResults"
            :key="result.id"
            class="px-3 py-2 font-mono text-gray-800 dark:text-gray-200"
            :class="row.bold ? 'font-bold' : ''"
          >
            {{ row.getValue(result.sizing) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

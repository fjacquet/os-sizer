<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SizingResult, NodeSpec } from '@/engine/types'

const { t } = useI18n()

const props = defineProps<{
  result: SizingResult
}>()

const rows = computed(() => {
  const s = props.result.sizing
  const entries: { labelKey: string; spec: NodeSpec }[] = []
  entries.push({ labelKey: 'node.masters', spec: s.masterNodes })
  if (s.workerNodes) entries.push({ labelKey: 'node.workers', spec: s.workerNodes })
  if (s.infraNodes) entries.push({ labelKey: 'node.infra', spec: s.infraNodes })
  if (s.odfNodes) entries.push({ labelKey: 'node.storage', spec: s.odfNodes })
  if (s.rhacmWorkers) entries.push({ labelKey: 'results.bom.rhacmWorkers', spec: s.rhacmWorkers })
  if (s.virtWorkerNodes) entries.push({ labelKey: 'node.virtWorkers', spec: s.virtWorkerNodes })
  if (s.gpuNodes) entries.push({ labelKey: 'node.gpu', spec: s.gpuNodes })
  return entries
})
</script>

<template>
  <div class="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
    <table class="w-full text-sm border-collapse" :aria-label="t('results.title')">
      <thead class="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border-b dark:border-gray-600">{{ t('topology.label') }}</th>
          <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border-b dark:border-gray-600">{{ t('node.count') }}</th>
          <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border-b dark:border-gray-600">{{ t('node.vcpu') }}</th>
          <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border-b dark:border-gray-600">{{ t('node.ramGB') }}</th>
          <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border-b dark:border-gray-600">{{ t('node.storageGB') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.labelKey">
          <td class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200">{{ t(row.labelKey) }}</td>
          <td class="px-3 py-2 font-mono border-b border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200">{{ row.spec.count }}</td>
          <td class="px-3 py-2 font-mono border-b border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200">{{ row.spec.vcpu }}</td>
          <td class="px-3 py-2 font-mono border-b border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200">{{ row.spec.ramGB }}</td>
          <td class="px-3 py-2 font-mono border-b border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200">{{ row.spec.storageGB }}</td>
        </tr>
        <!-- RHOAI overhead annotation row (RHOAI-04) — not a NodeSpec, shown as contextual info -->
        <tr v-if="props.result.sizing.rhoaiOverhead" class="bg-blue-50 dark:bg-blue-900/20">
          <td class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 italic">
            {{ t('rhoai.bomRow') }}
            <span class="text-xs text-gray-500 dark:text-gray-400 block not-italic">
              {{ t('rhoai.kserve') }} · {{ t('rhoai.dsPipelines') }} · {{ t('rhoai.modelRegistry') }}
            </span>
          </td>
          <td class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs italic" colspan="4">
            +{{ props.result.sizing.rhoaiOverhead.vcpu }} vCPU / +{{ props.result.sizing.rhoaiOverhead.ramGB }} GB RAM (overhead on infra or worker nodes)
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

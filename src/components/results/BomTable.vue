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
  return entries
})
</script>

<template>
  <div class="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
    <table class="w-full text-sm border-collapse" :aria-label="t('results.title')">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-3 py-2 text-left font-medium text-gray-600 border-b">{{ t('topology.label') }}</th>
          <th class="px-3 py-2 text-left font-medium text-gray-600 border-b">{{ t('node.count') }}</th>
          <th class="px-3 py-2 text-left font-medium text-gray-600 border-b">{{ t('node.vcpu') }}</th>
          <th class="px-3 py-2 text-left font-medium text-gray-600 border-b">{{ t('node.ramGB') }}</th>
          <th class="px-3 py-2 text-left font-medium text-gray-600 border-b">{{ t('node.storageGB') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.labelKey">
          <td class="px-3 py-2 border-b border-gray-100">{{ t(row.labelKey) }}</td>
          <td class="px-3 py-2 font-mono border-b border-gray-100">{{ row.spec.count }}</td>
          <td class="px-3 py-2 font-mono border-b border-gray-100">{{ row.spec.vcpu }}</td>
          <td class="px-3 py-2 font-mono border-b border-gray-100">{{ row.spec.ramGB }}</td>
          <td class="px-3 py-2 font-mono border-b border-gray-100">{{ row.spec.storageGB }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ClusterConfig, TopologyType } from '@/engine/types'

const { t } = useI18n()

const props = defineProps<{
  cluster: ClusterConfig
}>()

const topologyI18nKey = computed(() => {
  const map: Record<TopologyType, string> = {
    'standard-ha': 'topology.standardHa',
    'compact-3node': 'topology.compact3node',
    'sno': 'topology.sno',
    'two-node-arbiter': 'topology.twoNodeArbiter',
    'two-node-fencing': 'topology.twoNodeFencing',
    'hcp': 'topology.hcp',
    'microshift': 'topology.microshift',
    'managed-cloud': 'topology.managedCloud',
  }
  return map[props.cluster.topology]
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div class="flex flex-wrap items-start gap-4">
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('topology.label') }}</p>
        <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t(topologyI18nKey) }}</p>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('results.overview.haStatus') }}</p>
        <span
          class="mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          :class="props.cluster.haRequired
            ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
        >
          {{ props.cluster.haRequired ? t('results.overview.haEnabled') : t('results.overview.haDisabled') }}
        </span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('results.overview.environment') }}</p>
        <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{{ t(`environment.${props.cluster.environment}`) }}</p>
      </div>
    </div>
  </div>
</template>

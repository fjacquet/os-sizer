<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { VirtWorkerSizing } from '@/engine/types'

  const props = defineProps<{ metrics: VirtWorkerSizing }>()
  const { t } = useI18n()
  const limLabel = computed(() =>
    props.metrics.limitingResource === 'cpu'
      ? t('virt.limCpu')
      : props.metrics.limitingResource === 'ram'
        ? t('virt.limRam')
        : t('virt.limDensity'),
  )
  const items = computed(() => [
    { k: t('virt.achievedOvercommit'), v: `${props.metrics.achievedOvercommit.toFixed(2)}:1` },
    { k: t('virt.vmsPerNode'), v: props.metrics.vmsPerNode.toFixed(1) },
    { k: t('virt.limitingResource'), v: limLabel.value },
    { k: t('virt.cpuUtil'), v: `${props.metrics.cpuUtilizationPct.toFixed(0)}%` },
    { k: t('virt.ramUtil'), v: `${props.metrics.ramUtilizationPct.toFixed(0)}%` },
  ])
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
      {{ t('virt.metricsTitle') }}
    </h3>
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <div v-for="it in items" :key="it.k" class="text-center">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {{ it.k }}
        </p>
        <p class="mt-1 text-lg font-mono font-bold text-gray-900 dark:text-gray-100">{{ it.v }}</p>
      </div>
    </div>
  </div>
</template>

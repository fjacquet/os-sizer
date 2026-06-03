<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useInputStore } from '@/stores/inputStore'
  import { createDefaultClusterConfig } from '@/engine/defaults'
  import type { SizingMode } from '@/engine/types'

  const { t } = useI18n()
  const input = useInputStore()
  const activeCluster = computed(
    () => input.clusters[input.activeClusterIndex] ?? createDefaultClusterConfig(0),
  )
  const mode = computed(() => activeCluster.value.mode ?? 'container')

  function setMode(m: SizingMode) {
    const c = input.clusters[input.activeClusterIndex]
    if (c) input.updateCluster(c.id, { mode: m })
  }
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('mode.label') }}</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="m in ['container', 'virtualization'] as const"
        :key="m"
        type="button"
        class="text-left p-3 rounded-lg border transition-colors"
        :class="
          mode === m
            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 dark:border-blue-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        "
        @click="setMode(m)"
      >
        <span class="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {{ t(`mode.${m}`) }}
        </span>
        <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ t(`mode.${m}Hint`) }}
        </span>
      </button>
    </div>
  </div>
</template>

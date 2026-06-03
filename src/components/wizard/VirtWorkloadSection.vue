<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useInputStore } from '@/stores/inputStore'
  import { createDefaultClusterConfig, createDefaultVirtConfig } from '@/engine/defaults'
  import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
  import VmClassesTable from './VmClassesTable.vue'
  import type { VirtConfig } from '@/engine/types'

  const { t } = useI18n()
  const input = useInputStore()
  const activeCluster = computed(
    () => input.clusters[input.activeClusterIndex] ?? createDefaultClusterConfig(0),
  )
  const virt = computed<VirtConfig>(() => activeCluster.value.virt ?? createDefaultVirtConfig())

  function patch(p: Partial<VirtConfig>) {
    const c = input.clusters[input.activeClusterIndex]
    if (c) input.updateCluster(c.id, { virt: { ...(c.virt ?? createDefaultVirtConfig()), ...p } })
  }
  function patchNode(p: Partial<VirtConfig['nodeShape']>) {
    patch({ nodeShape: { ...virt.value.nodeShape, ...p } })
  }
  const overcommitOptions = [1, 4, 10]
  const redundancyOptions = ['none', 'n+1', 'n+2'] as const
  const targetPct = computed(() => Math.round((virt.value.targetUtilization ?? 0.8) * 100))
</script>

<template>
  <div class="space-y-5">
    <VmClassesTable />

    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('virt.nodeShape') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberSliderInput
          :model-value="virt.nodeShape.physicalCores"
          :label="t('virt.physicalCores')"
          :min="8"
          :max="256"
          :step="8"
          @update:model-value="(v: number) => patchNode({ physicalCores: v })"
        />
        <NumberSliderInput
          :model-value="virt.nodeShape.ramGB"
          :label="t('virt.nodeRamGB')"
          :min="64"
          :max="4096"
          :step="64"
          @update:model-value="(v: number) => patchNode({ ramGB: v })"
        />
      </div>
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          class="w-4 h-4 accent-blue-600"
          :checked="virt.nodeShape.threadsPerCore === 2"
          :aria-label="t('virt.hyperthreading')"
          @change="
            patchNode({ threadsPerCore: ($event.target as HTMLInputElement).checked ? 2 : 1 })
          "
        />
        {{ t('virt.hyperthreading') }}
      </label>
    </div>

    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('virt.overcommit') }}</p>
      <div class="flex gap-2">
        <button
          v-for="o in overcommitOptions"
          :key="o"
          type="button"
          class="px-3 py-1.5 text-sm rounded border"
          :class="
            virt.cpuOvercommitRatio === o
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 dark:border-blue-500 text-gray-900 dark:text-gray-100'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
          "
          @click="patch({ cpuOvercommitRatio: o })"
        >
          {{ o === 1 ? t('virt.overcommitDedicated') : `${o}:1` }}
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('virt.redundancy') }}</p>
      <div class="flex gap-2">
        <button
          v-for="r in redundancyOptions"
          :key="r"
          type="button"
          class="px-3 py-1.5 text-sm rounded border"
          :class="
            virt.redundancy === r
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 dark:border-blue-500 text-gray-900 dark:text-gray-100'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
          "
          @click="patch({ redundancy: r })"
        >
          {{ r === 'none' ? t('virt.redNone') : r === 'n+1' ? t('virt.redN1') : t('virt.redN2') }}
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('virt.targetUtilization') }}
      </p>
      <NumberSliderInput
        :model-value="targetPct"
        :label="t('virt.targetUtilization')"
        unit="%"
        :min="50"
        :max="95"
        :step="5"
        @update:model-value="(v: number) => patch({ targetUtilization: v / 100 })"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('virt.targetUtilizationHelp') }}</p>
    </div>
  </div>
</template>

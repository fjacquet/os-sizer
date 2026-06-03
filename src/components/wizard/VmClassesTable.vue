<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useInputStore } from '@/stores/inputStore'
  import { createDefaultClusterConfig, createDefaultVirtConfig } from '@/engine/defaults'
  import { addVmClass, removeVmClass, updateVmClass } from './vmClassOps'
  import type { VmClass } from '@/engine/types'

  const { t } = useI18n()
  const input = useInputStore()
  const activeCluster = computed(
    () => input.clusters[input.activeClusterIndex] ?? createDefaultClusterConfig(0),
  )
  const classes = computed<VmClass[]>(
    () => (activeCluster.value.virt ?? createDefaultVirtConfig()).vmClasses,
  )

  function commit(next: VmClass[]) {
    const c = input.clusters[input.activeClusterIndex]
    if (c)
      input.updateCluster(c.id, {
        virt: { ...(c.virt ?? createDefaultVirtConfig()), vmClasses: next },
      })
  }
  const numFields = ['vcpu', 'ramGB', 'diskGB', 'count'] as const
  function onNum(i: number, key: (typeof numFields)[number], e: Event) {
    const v = Number((e.target as HTMLInputElement).value)
    if (!Number.isNaN(v)) commit(updateVmClass(classes.value, i, { [key]: v }))
  }
  function onName(i: number, e: Event) {
    commit(updateVmClass(classes.value, i, { name: (e.target as HTMLInputElement).value }))
  }
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('virt.vmClasses') }}</p>
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs text-gray-500 dark:text-gray-400">
          <th class="text-left py-1">{{ t('virt.className') }}</th>
          <th class="py-1">{{ t('virt.vcpuPerVm') }}</th>
          <th class="py-1">{{ t('virt.ramPerVm') }}</th>
          <th class="py-1">{{ t('virt.diskPerVm') }}</th>
          <th class="py-1">{{ t('virt.vmCount') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in classes" :key="row.id">
          <td class="py-1">
            <input
              :value="row.name"
              :aria-label="t('virt.className')"
              class="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              @input="onName(i, $event)"
            />
          </td>
          <td v-for="key in numFields" :key="key" class="py-1 px-1">
            <input
              type="number"
              min="0"
              :value="row[key]"
              :aria-label="`${row.name} ${key}`"
              class="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              @input="onNum(i, key, $event)"
            />
          </td>
          <td class="py-1 text-center">
            <button
              type="button"
              :aria-label="t('virt.removeClass')"
              class="text-gray-400 hover:text-red-600 disabled:opacity-30"
              :disabled="classes.length <= 1"
              @click="commit(removeVmClass(classes, i))"
            >
              ✕
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <button
      type="button"
      class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      @click="commit(addVmClass(classes))"
    >
      ＋ {{ t('virt.addClass') }}
    </button>
  </div>
</template>

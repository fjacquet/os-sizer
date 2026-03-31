<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  totals: { vcpu: number; ramGB: number; storageGB: number }
}>()
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4">
    <div class="flex gap-6">
      <div class="flex-1 text-center">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ t('results.totalCpu') }}</p>
        <p class="mt-1 text-2xl font-mono font-bold text-gray-900">{{ totals.vcpu.toLocaleString() }}</p>
      </div>
      <div class="flex-1 text-center">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ t('results.totalRam') }}</p>
        <p class="mt-1 text-2xl font-mono font-bold text-gray-900">{{ totals.ramGB.toLocaleString() }}</p>
      </div>
      <div class="flex-1 text-center">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ t('results.totalStorage') }}</p>
        <p class="mt-1 text-2xl font-mono font-bold text-gray-900">{{ totals.storageGB.toLocaleString() }}</p>
      </div>
    </div>
  </div>
</template>

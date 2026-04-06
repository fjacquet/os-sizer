<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps<{
  messageKey: string
  severity: 'error' | 'warning'
}>()
</script>

<template>
  <div
    role="alert"
    class="flex items-start gap-2 rounded border px-3 py-2 text-sm"
    :class="props.severity === 'error'
      ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
      : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300'"
  >
    <span class="font-semibold">{{ props.severity === 'error' ? '✖' : '⚠' }}</span>
    <span>{{ t(props.messageKey) }}</span>
  </div>
</template>

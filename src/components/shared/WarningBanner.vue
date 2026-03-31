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
      ? 'bg-red-50 border-red-300 text-red-800'
      : 'bg-yellow-50 border-yellow-300 text-yellow-800'"
  >
    <span class="font-semibold">{{ props.severity === 'error' ? '✖' : '⚠' }}</span>
    <span>{{ t(props.messageKey) }}</span>
  </div>
</template>

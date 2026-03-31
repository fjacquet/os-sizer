<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TopologyRecommendation, TopologyType } from '@/engine/types'

const props = defineProps<{
  recommendation: TopologyRecommendation
  selected: boolean
  topologyLabelKey: string
}>()

const emit = defineEmits<{ select: [topology: TopologyType] }>()
const { t } = useI18n()

function fitScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}
</script>

<template>
  <button
    :class="[
      'w-full text-left p-4 rounded-lg border-2 transition-colors space-y-2',
      selected
        ? 'border-blue-600 bg-blue-50'
        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
    ]"
    @click="emit('select', recommendation.topology)"
  >
    <div class="flex items-center justify-between">
      <span class="font-semibold text-gray-900 text-sm">
        {{ t(topologyLabelKey) }}
      </span>
      <span :class="['text-xs font-bold px-2 py-0.5 rounded', fitScoreColor(recommendation.fitScore)]">
        {{ recommendation.fitScore }}%
      </span>
    </div>
    <p class="text-xs text-gray-600">
      {{ t(recommendation.justificationKey) }}
    </p>
    <div v-if="recommendation.warningKeys.length > 0" class="space-y-1">
      <p
        v-for="key in recommendation.warningKeys"
        :key="key"
        class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1"
      >
        {{ t(key) }}
      </p>
    </div>
  </button>
</template>

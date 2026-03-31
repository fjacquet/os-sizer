<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { createDefaultClusterConfig } from '@/engine/defaults'
import { EnvironmentSchema } from '@/schemas/environmentSchema'
import type { ClusterConfig, EnvironmentType } from '@/engine/types'

const { t } = useI18n()
const input = useInputStore()

// domainField pattern — two-way binding into active cluster
function clusterField<K extends keyof ClusterConfig>(key: K) {
  return computed({
    get: () => {
      const c = input.clusters[input.activeClusterIndex]
      return (c ?? createDefaultClusterConfig(0))[key]
    },
    set: (val: ClusterConfig[K]) => {
      const c = input.clusters[input.activeClusterIndex]
      if (c) input.updateCluster(c.id, { [key]: val } as Partial<ClusterConfig>)
    },
  })
}

const environment = clusterField('environment')
const haRequired = clusterField('haRequired')
const airGapped = clusterField('airGapped')

const validationErrors = ref<string[]>([])

function validate(): boolean {
  const c = input.clusters[input.activeClusterIndex]
  if (!c) return false
  const result = EnvironmentSchema.safeParse({
    environment: c.environment,
    haRequired: c.haRequired,
    airGapped: c.airGapped,
    maxNodes: c.maxNodes,
  })
  if (!result.success) {
    validationErrors.value = result.error.issues.map((i) => i.message)
    return false
  }
  validationErrors.value = []
  return true
}

// Expose validate for parent consumption if needed
defineExpose({ validate })

const envOptions: { value: EnvironmentType; labelKey: string }[] = [
  { value: 'datacenter', labelKey: 'environment.datacenter' },
  { value: 'edge',       labelKey: 'environment.edge' },
  { value: 'far-edge',   labelKey: 'environment.farEdge' },
  { value: 'cloud',      labelKey: 'environment.cloud' },
]
</script>

<template>
  <section class="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
    <div>
      <h2 class="text-lg font-semibold text-gray-900">{{ t('wizard.step1.title') }}</h2>
    </div>

    <!-- Environment type -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-gray-700" id="env-type-label">{{ t('environment.label') }}</label>
      <div
        class="flex flex-wrap gap-2"
        role="radiogroup"
        aria-labelledby="env-type-label"
        aria-required="true"
      >
        <button
          v-for="opt in envOptions"
          :key="opt.value"
          :aria-label="t(opt.labelKey)"
          :aria-pressed="environment === opt.value"
          :class="['px-4 py-2 text-sm rounded-md border font-medium transition-colors',
            environment === opt.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400']"
          @click="environment = opt.value"
        >
          {{ t(opt.labelKey) }}
        </button>
      </div>
    </div>

    <!-- Connectivity -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-gray-700" id="connectivity-label">{{ t('environment.connectivity') }}</label>
      <div
        class="flex gap-2"
        role="radiogroup"
        aria-labelledby="connectivity-label"
        aria-required="true"
      >
        <button
          :aria-label="t('environment.connected')"
          :aria-pressed="!airGapped"
          :class="['px-4 py-2 text-sm rounded-md border font-medium transition-colors',
            !airGapped
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400']"
          @click="airGapped = false"
        >
          {{ t('environment.connected') }}
        </button>
        <button
          :aria-label="t('environment.airGapped')"
          :aria-pressed="airGapped as boolean"
          :class="['px-4 py-2 text-sm rounded-md border font-medium transition-colors',
            airGapped
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400']"
          @click="airGapped = true"
        >
          {{ t('environment.airGapped') }}
        </button>
      </div>
    </div>

    <!-- HA Level -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-gray-700" id="ha-level-label">{{ t('environment.haLevel') }}</label>
      <div
        class="flex gap-2"
        role="radiogroup"
        aria-labelledby="ha-level-label"
        aria-required="true"
      >
        <button
          :aria-label="t('environment.haRequired')"
          :aria-pressed="haRequired as boolean"
          :class="['px-4 py-2 text-sm rounded-md border font-medium transition-colors',
            haRequired
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400']"
          @click="haRequired = true"
        >
          {{ t('environment.haRequired') }}
        </button>
        <button
          :aria-label="t('environment.haOptional')"
          :aria-pressed="!haRequired"
          :class="['px-4 py-2 text-sm rounded-md border font-medium transition-colors',
            !haRequired
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400']"
          @click="haRequired = false"
        >
          {{ t('environment.haOptional') }}
        </button>
      </div>
    </div>

    <!-- Validation errors -->
    <div v-if="validationErrors.length > 0" class="space-y-1">
      <div
        v-for="(err, i) in validationErrors"
        :key="i"
        class="p-2 rounded border text-sm bg-red-50 border-red-400 text-red-800"
        role="alert"
      >
        {{ err }}
      </div>
    </div>
  </section>
</template>

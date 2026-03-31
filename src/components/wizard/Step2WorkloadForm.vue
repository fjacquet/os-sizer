<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { createDefaultClusterConfig } from '@/engine/defaults'
import { WorkloadSchema } from '@/schemas/workloadSchema'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'

const { t } = useI18n()
const input = useInputStore()

const activeCluster = computed(() =>
  input.clusters[input.activeClusterIndex] ?? createDefaultClusterConfig(0)
)

// Workload field helpers — patch workload sub-object
function workloadField(key: keyof typeof activeCluster.value.workload) {
  return computed({
    get: () => activeCluster.value.workload[key],
    set: (val: number) => {
      const c = input.clusters[input.activeClusterIndex]
      if (c) input.updateCluster(c.id, { workload: { ...c.workload, [key]: val } })
    },
  })
}

// AddOn field helpers — patch addOns sub-object
function addOnField(key: keyof typeof activeCluster.value.addOns) {
  return computed({
    get: () => activeCluster.value.addOns[key],
    set: (val: boolean | number) => {
      const c = input.clusters[input.activeClusterIndex]
      if (c) input.updateCluster(c.id, { addOns: { ...c.addOns, [key]: val } })
    },
  })
}

const totalPods = workloadField('totalPods')
const podCpuMillicores = workloadField('podCpuMillicores')
const podMemMiB = workloadField('podMemMiB')
const nodeVcpu = workloadField('nodeVcpu')
const nodeRamGB = workloadField('nodeRamGB')

const odfEnabled = addOnField('odfEnabled')
const infraNodesEnabled = addOnField('infraNodesEnabled')
const rhacmEnabled = addOnField('rhacmEnabled')
const rhacmManagedClusters = addOnField('rhacmManagedClusters')

const validationErrors = ref<string[]>([])

function validate(): boolean {
  const c = activeCluster.value
  const result = WorkloadSchema.safeParse({
    totalPods: c.workload.totalPods,
    podCpuMillicores: c.workload.podCpuMillicores,
    podMemMiB: c.workload.podMemMiB,
    nodeVcpu: c.workload.nodeVcpu,
    nodeRamGB: c.workload.nodeRamGB,
    odfEnabled: c.addOns.odfEnabled,
    odfExtraOsdCount: c.addOns.odfExtraOsdCount,
    infraNodesEnabled: c.addOns.infraNodesEnabled,
    rhacmEnabled: c.addOns.rhacmEnabled,
    rhacmManagedClusters: c.addOns.rhacmManagedClusters,
  })
  if (!result.success) {
    validationErrors.value = result.error.issues.map(i => t(i.message))
    return false
  }
  validationErrors.value = []
  return true
}

defineExpose({ validate })
</script>

<template>
  <section class="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
    <h2 class="text-lg font-semibold text-gray-900">{{ t('wizard.step2.title') }}</h2>

    <!-- Workload inputs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <NumberSliderInput
        v-model="totalPods"
        :label="t('workload.podCount')"
        :min="1"
        :max="2000"
        :step="1"
        aria-required="true"
      />
      <NumberSliderInput
        v-model="podCpuMillicores"
        :label="t('workload.cpuPerPod')"
        unit="m"
        :min="100"
        :max="32000"
        :step="100"
        aria-required="true"
      />
      <NumberSliderInput
        v-model="podMemMiB"
        :label="t('workload.ramPerPod')"
        unit="MiB"
        :min="128"
        :max="65536"
        :step="128"
        aria-required="true"
      />
      <NumberSliderInput
        v-model="nodeVcpu"
        :label="t('workload.nodeVcpu')"
        unit="vCPU"
        :min="4"
        :max="128"
        :step="4"
        aria-required="true"
      />
      <NumberSliderInput
        v-model="nodeRamGB"
        :label="t('workload.nodeRam')"
        unit="GB"
        :min="16"
        :max="512"
        :step="16"
        aria-required="true"
      />
    </div>

    <!-- Add-ons -->
    <div class="border-t border-gray-100 pt-4 space-y-3">
      <h3 class="text-sm font-semibold text-gray-700">{{ t('workload.addons') }}</h3>
      <div class="space-y-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="odfEnabled as boolean"
            :aria-label="t('workload.odfStorage')"
            class="w-4 h-4 accent-blue-600"
            @change="odfEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-sm text-gray-700">{{ t('workload.odfStorage') }}</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="infraNodesEnabled as boolean"
            :aria-label="t('workload.infraNodes')"
            class="w-4 h-4 accent-blue-600"
            @change="infraNodesEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-sm text-gray-700">{{ t('workload.infraNodes') }}</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="rhacmEnabled as boolean"
            :aria-label="t('workload.rhacmHub')"
            class="w-4 h-4 accent-blue-600"
            @change="rhacmEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-sm text-gray-700">{{ t('workload.rhacmHub') }}</span>
        </label>
        <!-- Managed cluster count slider (only when hub add-on is enabled) -->
        <div v-if="rhacmEnabled" class="ml-6 mt-2">
          <NumberSliderInput
            :model-value="rhacmManagedClusters as number"
            @update:model-value="(val: number) => { rhacmManagedClusters = val }"
            :label="t('hcp.clusterCount')"
            :min="1"
            :max="500"
            :step="1"
          />
        </div>
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

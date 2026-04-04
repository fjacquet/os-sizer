<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { createDefaultClusterConfig } from '@/engine/defaults'
import { WorkloadSchema } from '@/schemas/workloadSchema'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
import { MIG_PROFILES } from '@/engine/constants'

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
const virtEnabled = addOnField('virtEnabled')
const gpuEnabled = addOnField('gpuEnabled')
const gpuNodeCount = addOnField('gpuNodeCount')
const gpuMode = addOnField('gpuMode')
const gpuModel = addOnField('gpuModel')
const migProfile = addOnField('migProfile')
const rhoaiEnabled = addOnField('rhoaiEnabled')

const availableMigProfiles = computed(() =>
  gpuModel.value ? Object.keys(MIG_PROFILES[gpuModel.value as string] ?? {}) : []
)

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
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('wizard.step2.title') }}</h2>

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
    <div class="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('workload.addons') }}</h3>
      <div class="space-y-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="odfEnabled as boolean"
            :aria-label="t('workload.odfStorage')"
            class="w-4 h-4 accent-blue-600"
            @change="odfEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('workload.odfStorage') }}</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="infraNodesEnabled as boolean"
            :aria-label="t('workload.infraNodes')"
            class="w-4 h-4 accent-blue-600"
            @change="infraNodesEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('workload.infraNodes') }}</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="rhacmEnabled as boolean"
            :aria-label="t('workload.rhacmHub')"
            class="w-4 h-4 accent-blue-600"
            @change="rhacmEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('workload.rhacmHub') }}</span>
        </label>
        <!-- Managed cluster count slider (only when hub add-on is enabled) -->
        <div v-if="rhacmEnabled" class="ml-6 mt-2">
          <NumberSliderInput
            :model-value="rhacmManagedClusters as number"
            :label="t('hcp.clusterCount')"
            :min="1"
            :max="500"
            :step="1"
            @update:model-value="(val: number) => { rhacmManagedClusters = val }"
          />
        </div>
        <!-- OpenShift Virtualization add-on (VIRT-01) -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="virtEnabled as boolean"
            :aria-label="t('workload.virtAddon')"
            class="w-4 h-4 accent-blue-600"
            @change="virtEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('workload.virtAddon') }}</span>
        </label>
        <!-- GPU Node Pool add-on (GPU-01) -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="gpuEnabled as boolean"
            :aria-label="t('workload.gpuNodePool')"
            class="w-4 h-4 accent-blue-600"
            @change="gpuEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('workload.gpuNodePool') }}</span>
        </label>
        <!-- GPU sub-inputs revealed when gpuEnabled -->
        <div v-if="gpuEnabled" class="ml-6 mt-2 space-y-3">
          <NumberSliderInput
            :model-value="gpuNodeCount as number"
            :label="t('workload.gpuNodeCount')"
            :min="1"
            :max="32"
            :step="1"
            @update:model-value="(val: number) => { gpuNodeCount = val }"
          />
          <!-- GPU Mode select (GPU-02) -->
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('workload.gpuMode') }}</label>
            <select
              :value="gpuMode as string"
              :aria-label="t('workload.gpuMode')"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              @change="gpuMode = ($event.target as HTMLSelectElement).value"
            >
              <option value="container">{{ t('gpu.modeContainer') }}</option>
              <option value="passthrough">{{ t('gpu.modePassthrough') }}</option>
              <option value="vgpu">{{ t('gpu.modeVgpu') }}</option>
            </select>
          </div>
          <!-- GPU Model select -->
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('workload.gpuModel') }}</label>
            <select
              :value="gpuModel as string"
              :aria-label="t('workload.gpuModel')"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              @change="gpuModel = ($event.target as HTMLSelectElement).value"
            >
              <option value="A100-40GB">A100-40GB</option>
              <option value="A100-80GB">A100-80GB</option>
              <option value="H100-80GB">H100-80GB</option>
            </select>
          </div>
          <!-- MIG Profile cascade select (GPU-04) -->
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('workload.migProfile') }}</label>
            <select
              :value="migProfile as string"
              :aria-label="t('workload.migProfile')"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              @change="migProfile = ($event.target as HTMLSelectElement).value"
            >
              <option value="">{{ t('gpu.migNone') }}</option>
              <option v-for="profile in availableMigProfiles" :key="profile" :value="profile">{{ profile }}</option>
            </select>
          </div>
          <!-- GPU Passthrough live-migration warning (GPU-02 pitfall) -->
          <div
            v-if="gpuMode === 'passthrough'"
            class="p-2 rounded border text-xs bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-300"
            role="alert"
          >
            {{ t('warnings.gpu.passthroughBlocksLiveMigration') }}
          </div>
          <!-- vGPU density reference table (GPU-05) — only when vgpu mode selected -->
          <div v-if="gpuMode === 'vgpu'" class="mt-2 space-y-1">
            <p class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ t('gpu.densityTableTitle') }}</p>
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse border border-gray-200 dark:border-gray-600">
                <thead class="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th class="px-2 py-1 border border-gray-200 dark:border-gray-600 text-left">GPU</th>
                    <th class="px-2 py-1 border border-gray-200 dark:border-gray-600 text-left">Profile</th>
                    <th class="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">Instances</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(instances, profile) in MIG_PROFILES['A100-40GB']" :key="`a100-40-${profile}`">
                    <td class="px-2 py-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">A100-40GB</td>
                    <td class="px-2 py-1 border border-gray-200 dark:border-gray-600 font-mono">{{ profile }}</td>
                    <td class="px-2 py-1 border border-gray-200 dark:border-gray-600 font-mono text-right">{{ instances }}</td>
                  </tr>
                  <tr v-for="(instances, profile) in MIG_PROFILES['A100-80GB']" :key="`a100-80-${profile}`">
                    <td class="px-2 py-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">A100-80GB</td>
                    <td class="px-2 py-1 border border-gray-200 dark:border-gray-600 font-mono">{{ profile }}</td>
                    <td class="px-2 py-1 border border-gray-200 dark:border-gray-600 font-mono text-right">{{ instances }}</td>
                  </tr>
                  <tr v-for="(instances, profile) in MIG_PROFILES['H100-80GB']" :key="`h100-${profile}`">
                    <td class="px-2 py-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">H100-80GB</td>
                    <td class="px-2 py-1 border border-gray-200 dark:border-gray-600 font-mono">{{ profile }}</td>
                    <td class="px-2 py-1 border border-gray-200 dark:border-gray-600 font-mono text-right">{{ instances }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 italic">{{ t('gpu.densityNote') }}</p>
          </div>
        </div>
        <!-- RHOAI add-on (RHOAI-01) -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="rhoaiEnabled as boolean"
            :aria-label="t('workload.rhoaiAddon')"
            class="w-4 h-4 accent-blue-600"
            @change="rhoaiEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('workload.rhoaiAddon') }}</span>
        </label>
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

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useUiStore } from '@/stores/uiStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { createDefaultClusterConfig } from '@/engine/defaults'
import RecommendationCard from './RecommendationCard.vue'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
import type { TopologyType, SnoProfile, ClusterConfig } from '@/engine/types'

const { t } = useI18n()
const input = useInputStore()
const ui = useUiStore()
const calc = useCalculationStore()

const activeCluster = computed(() =>
  input.clusters[input.activeClusterIndex] ?? createDefaultClusterConfig(0)
)

const recommendations = computed(() => calc.recommendations)

const topologyLabelMap: Record<TopologyType, string> = {
  'standard-ha':      'topology.standardHa',
  'compact-3node':    'topology.compact3node',
  'sno':              'topology.sno',
  'two-node-arbiter': 'topology.twoNodeArbiter',
  'two-node-fencing': 'topology.twoNodeFencing',
  'hcp':              'topology.hcp',
  'microshift':       'topology.microshift',
  'managed-cloud':    'topology.managedCloud',
}

const allTopologies: TopologyType[] = [
  'standard-ha', 'compact-3node', 'sno',
  'two-node-arbiter', 'two-node-fencing',
  'hcp', 'microshift', 'managed-cloud',
]

const showOverride = ref(false)

function clusterField<K extends keyof ClusterConfig>(key: K) {
  return computed({
    get: () => activeCluster.value[key],
    set: (val: ClusterConfig[K]) => {
      const c = input.clusters[input.activeClusterIndex]
      if (c) input.updateCluster(c.id, { [key]: val } as Partial<ClusterConfig>)
    },
  })
}

function addOnField(key: keyof typeof activeCluster.value.addOns) {
  return computed({
    get: () => activeCluster.value.addOns[key],
    set: (val: boolean | number) => {
      const c = input.clusters[input.activeClusterIndex]
      if (c) input.updateCluster(c.id, { addOns: { ...c.addOns, [key]: val } })
    },
  })
}

const topology = clusterField('topology')
const snoProfile = clusterField('snoProfile')
const hcpHostedClusters = clusterField('hcpHostedClusters')
const hcpQpsPerCluster = clusterField('hcpQpsPerCluster')
const virtEnabled = addOnField('virtEnabled')
const vmCount = addOnField('vmCount')
const vmsPerWorker = addOnField('vmsPerWorker')
const virtAvgVmVcpu = addOnField('virtAvgVmVcpu')
const virtAvgVmRamGB = addOnField('virtAvgVmRamGB')
const snoVirtMode = addOnField('snoVirtMode')

function selectTopology(topo: TopologyType) {
  topology.value = topo
  ui.confirmTopology()
  showOverride.value = false
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('wizard.step3.title') }}</h2>
    </div>

    <!-- Recommendation cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <RecommendationCard
        v-for="rec in recommendations"
        :key="rec.topology"
        :recommendation="rec"
        :selected="topology === rec.topology"
        :topology-label-key="topologyLabelMap[rec.topology]"
        @select="selectTopology"
      />
    </div>

    <!-- Manual override toggle -->
    <div class="border-t border-gray-100 dark:border-gray-700 pt-4">
      <button
        class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        :aria-label="showOverride ? t('wizard.step3.hideOverride') : t('wizard.step3.showOverride')"
        @click="showOverride = !showOverride"
      >
        {{ showOverride ? t('wizard.step3.hideOverride') : t('wizard.step3.showOverride') }}
      </button>
      <div v-if="showOverride" class="mt-3 space-y-1">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300" for="topology-override-select">{{ t('topology.label') }}</label>
        <select
          id="topology-override-select"
          :value="topology"
          :aria-label="t('topology.label')"
          aria-required="true"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          @change="selectTopology(($event.target as HTMLSelectElement).value as TopologyType)"
        >
          <option v-for="topo in allTopologies" :key="topo" :value="topo">
            {{ t(topologyLabelMap[topo]) }}
          </option>
        </select>
      </div>
    </div>

    <!-- Topology-specific sub-inputs -->
    <div v-if="ui.topologyConfirmed" class="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-4">

      <!-- SNO profile selector -->
      <div v-if="topology === 'sno'" class="space-y-2">
        <label id="sno-profile-label" class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('sno.profile') }}</label>
        <div
          class="flex flex-wrap gap-2"
          role="radiogroup"
          aria-labelledby="sno-profile-label"
          aria-required="true"
        >
          <button
            v-for="p in (['standard', 'edge', 'telecom-vdu'] as SnoProfile[])"
            :key="p"
            :aria-label="p === 'standard' ? t('sno.standard') : p === 'edge' ? t('sno.edge') : t('sno.telecomVdu')"
            :aria-pressed="snoProfile === p"
            :class="['px-3 py-1.5 text-sm rounded border font-medium transition-colors',
              snoProfile === p
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400']"
            @click="snoProfile = p"
          >
            {{ p === 'standard' ? t('sno.standard') : p === 'edge' ? t('sno.edge') : t('sno.telecomVdu') }}
          </button>
        </div>
        <!-- SNO-with-Virt mode toggle (SNO-01 engine already complete) -->
        <div class="mt-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              :checked="snoVirtMode as boolean"
              :aria-label="t('sno.virtMode')"
              class="w-4 h-4 accent-blue-600"
              @change="snoVirtMode = ($event.target as HTMLInputElement).checked"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('sno.virtMode') }}</span>
          </label>
        </div>
      </div>

      <!-- HCP inputs -->
      <div v-if="topology === 'hcp'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberSliderInput
          v-model="hcpHostedClusters"
          :label="t('hcp.clusterCount')"
          :min="1"
          :max="100"
          :step="1"
          aria-required="true"
        />
        <NumberSliderInput
          v-model="hcpQpsPerCluster"
          :label="t('hcp.targetQps')"
          unit="QPS"
          :min="100"
          :max="10000"
          :step="100"
          aria-required="true"
        />
      </div>

      <!-- Virt VM sizing inputs (VIRT-01, VIRT-03) — shown when virt add-on enabled on standard-ha or compact-3node -->
      <div v-if="virtEnabled && (topology === 'standard-ha' || topology === 'compact-3node')" class="space-y-3">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('workload.virtAddon') }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberSliderInput
            :model-value="vmCount as number"
            :label="t('workload.vmCount')"
            :min="1"
            :max="5000"
            :step="10"
            aria-required="true"
            @update:model-value="(val: number) => { vmCount = val }"
          />
          <NumberSliderInput
            :model-value="vmsPerWorker as number"
            :label="t('workload.vmsPerWorker')"
            :min="1"
            :max="50"
            :step="1"
            aria-required="true"
            @update:model-value="(val: number) => { vmsPerWorker = val }"
          />
          <NumberSliderInput
            :model-value="virtAvgVmVcpu as number"
            :label="t('workload.virtAvgVmVcpu')"
            unit="vCPU"
            :min="1"
            :max="32"
            :step="1"
            aria-required="true"
            @update:model-value="(val: number) => { virtAvgVmVcpu = val }"
          />
          <NumberSliderInput
            :model-value="virtAvgVmRamGB as number"
            :label="t('workload.virtAvgVmRamGB')"
            unit="GB"
            :min="1"
            :max="256"
            :step="1"
            aria-required="true"
            @update:model-value="(val: number) => { virtAvgVmRamGB = val }"
          />
        </div>
      </div>

      <!-- TNA tech preview notice -->
      <div
        v-if="topology === 'two-node-arbiter'"
        class="p-3 rounded border text-sm bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-300"
        role="alert"
      >
        {{ t('warnings.tna.techPreview') }}
      </div>

      <!-- TNF notices -->
      <div v-if="topology === 'two-node-fencing'" class="space-y-2">
        <div class="p-3 rounded border text-sm bg-amber-50 border-amber-400 text-amber-800" role="alert">
          {{ t('warnings.tnf.techPreview') }}
        </div>
        <div class="p-3 rounded border text-sm bg-amber-50 border-amber-400 text-amber-800" role="alert">
          {{ t('warnings.tnf.redfishRequired') }}
        </div>
      </div>

      <!-- Managed cloud notice -->
      <div
        v-if="topology === 'managed-cloud'"
        class="p-3 rounded border text-sm bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-700 text-blue-800 dark:text-blue-300"
        role="alert"
      >
        {{ t('warnings.managedCloud.noHardware') }}
      </div>

    </div>
  </section>
</template>

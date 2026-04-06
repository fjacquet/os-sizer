<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useCalculationStore } from '@/stores/calculationStore'
import { useInputStore } from '@/stores/inputStore'
import { useUiStore } from '@/stores/uiStore'
import BomTable from './BomTable.vue'
import TotalsSummaryCard from './TotalsSummaryCard.vue'
import ArchOverviewCard from './ArchOverviewCard.vue'
import WarningBanner from '@/components/shared/WarningBanner.vue'
import ChartsSection from './ChartsSection.vue'
import ExportToolbar from './ExportToolbar.vue'
import ClusterTabBar from './ClusterTabBar.vue'

const { t } = useI18n()
const calc = useCalculationStore()
const input = useInputStore()
const ui = useUiStore()
const { clusterResults } = storeToRefs(calc)
const { clusters, activeClusterIndex } = storeToRefs(input)

// Active cluster result — mirrors calculationStore.activeCluster pattern
const activeResult = computed(() => clusterResults.value[activeClusterIndex.value] ?? clusterResults.value[0])
const activeCluster = computed(() => clusters.value[activeClusterIndex.value] ?? clusters.value[0])
</script>

<template>
  <div class="space-y-4">
    <!-- Cluster tab bar (Phase 18) -->
    <ClusterTabBar />

    <!-- Page heading -->
    <h2 class="text-xl font-bold text-gray-900">{{ t('wizard.step4.title') }}</h2>

    <!-- Architecture overview -->
    <ArchOverviewCard :cluster="activeCluster" />

    <!-- Validation warnings (errors first, then warnings) -->
    <template v-if="activeResult?.validationErrors.length">
      <WarningBanner
        v-for="warning in activeResult.validationErrors"
        :key="warning.code"
        :message-key="warning.messageKey"
        :severity="warning.severity"
      />
    </template>

    <!-- BoM table -->
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <h3 class="px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-100">
        {{ t('results.title') }}
      </h3>
      <BomTable v-if="activeResult" :result="activeResult" />
    </div>

    <!-- Charts section (Phase 4 plan 02) -->
    <ChartsSection />

    <!-- Totals summary -->
    <TotalsSummaryCard
      v-if="activeResult"
      :totals="activeResult.sizing.totals"
    />

    <!-- Export toolbar: Share URL, CSV, PDF, PPTX -->
    <ExportToolbar />

    <!-- Back button -->
    <div class="flex justify-start pt-2">
      <button
        class="px-4 py-2 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        @click="ui.setWizardStep(3)"
      >
        {{ t('wizard.nav.previous') }}
      </button>
    </div>
  </div>
</template>

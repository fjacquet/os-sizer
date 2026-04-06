<script setup lang="ts">
import { computed, ref } from 'vue'
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
import ClusterComparisonTable from './ClusterComparisonTable.vue'

const { t } = useI18n()
const calc = useCalculationStore()
const input = useInputStore()
const ui = useUiStore()
const { clusterResults } = storeToRefs(calc)
const { clusters, activeClusterIndex } = storeToRefs(input)

// Active cluster result — mirrors calculationStore.activeCluster pattern
const activeResult = computed(() => clusterResults.value[activeClusterIndex.value] ?? clusterResults.value[0])
const activeCluster = computed(() => clusters.value[activeClusterIndex.value] ?? clusters.value[0])

// Compare toggle — shown only when 2+ clusters exist (D-10)
const showComparison = ref(false)
</script>

<template>
  <div class="space-y-4">
    <!-- Compare toggle — only when 2+ clusters exist (D-10) -->
    <div v-if="clusters.length >= 2" class="flex items-center gap-2">
      <button
        class="text-sm px-3 py-2 font-medium rounded border transition-colors"
        :class="showComparison
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'"
        @click="showComparison = !showComparison"
      >
        {{ t('results.clusters.compareToggle') }}
      </button>
    </div>

    <!-- Comparison table (D-12) -->
    <ClusterComparisonTable v-if="showComparison && clusters.length >= 2" />

    <!-- Page heading -->
    <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ t('wizard.step4.title') }}</h2>

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
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <h3 class="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700">
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
        class="px-4 py-2 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
        @click="ui.setWizardStep(3)"
      >
        {{ t('wizard.nav.previous') }}
      </button>
    </div>
  </div>
</template>

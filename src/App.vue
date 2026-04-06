<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/uiStore'
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue'
import DarkModeToggle from '@/components/shared/DarkModeToggle.vue'
import WizardStepper from '@/components/shared/WizardStepper.vue'
import Step1EnvironmentForm from '@/components/wizard/Step1EnvironmentForm.vue'
import Step2WorkloadForm from '@/components/wizard/Step2WorkloadForm.vue'
import Step3ArchitectureForm from '@/components/wizard/Step3ArchitectureForm.vue'
import ResultsPage from '@/components/results/ResultsPage.vue'
import ClusterTabBar from '@/components/results/ClusterTabBar.vue'

const { t } = useI18n()
const ui = useUiStore()
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">
    <header role="banner" class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
      <h1 class="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">{{ t('app.title') }}</h1>
      <nav aria-label="Application navigation" class="flex items-center gap-2">
        <DarkModeToggle />
        <LanguageSwitcher />
      </nav>
    </header>
    <main role="main" class="max-w-4xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
      <WizardStepper />
      <ClusterTabBar />
      <div class="mt-6">
        <!-- Step 1: Environment Constraints (03-02) -->
        <div v-if="ui.currentWizardStep === 1">
          <Step1EnvironmentForm />
        </div>
        <!-- Step 2: Workload Profile (03-03) -->
        <div v-else-if="ui.currentWizardStep === 2">
          <Step2WorkloadForm />
        </div>
        <!-- Step 3: Architecture Selection (03-04) -->
        <div v-else-if="ui.currentWizardStep === 3">
          <Step3ArchitectureForm />
        </div>
        <!-- Step 4: Results (Phase 4) -->
        <div v-else>
          <ResultsPage />
        </div>
      </div>
    </main>
  </div>
</template>

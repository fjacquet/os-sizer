<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/uiStore'

const { t } = useI18n()
const ui = useUiStore()

const steps = [
  { step: 1 as const, labelKey: 'wizard.step1.label' },
  { step: 2 as const, labelKey: 'wizard.step2.label' },
  { step: 3 as const, labelKey: 'wizard.step3.label' },
  { step: 4 as const, labelKey: 'wizard.step4.label' },
]

const canGoBack = computed(() => ui.currentWizardStep > 1)

const canGoForward = computed(() => {
  if (ui.currentWizardStep === 3) return ui.topologyConfirmed
  if (ui.currentWizardStep === 4) return false
  return true
})

const nextLabel = computed(() =>
  ui.currentWizardStep === 3 ? t('wizard.nav.calculate') : t('wizard.nav.next')
)

function goBack() {
  if (canGoBack.value) ui.setWizardStep((ui.currentWizardStep - 1) as 1 | 2 | 3 | 4)
}

function goForward() {
  if (canGoForward.value) ui.setWizardStep((ui.currentWizardStep + 1) as 1 | 2 | 3 | 4)
}
</script>

<template>
  <nav role="navigation" aria-label="Wizard steps" class="flex items-center justify-between gap-4 mb-6 flex-wrap">
    <button
      :disabled="!canGoBack"
      :class="['px-4 py-2 text-sm rounded border font-medium transition-colors',
        canGoBack
          ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400'
          : 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700']"
      @click="goBack"
    >
      {{ t('wizard.nav.previous') }}
    </button>

    <div class="flex items-center gap-2 flex-wrap">
      <template v-for="(s, index) in steps" :key="s.step">
        <!-- Active step: aria-current="step" for screen readers -->
        <div
          v-if="ui.currentWizardStep === s.step"
          aria-current="step"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border font-medium bg-blue-600 text-white border-blue-600"
        >
          <span class="font-bold">{{ s.step }}</span>
          <span class="hidden sm:inline">{{ t(s.labelKey) }}</span>
        </div>
        <div
          v-else
          :class="['flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border font-medium',
            ui.currentWizardStep > s.step
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-400 dark:border-green-600'
              : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700']"
        >
          <span class="font-bold">{{ s.step }}</span>
          <span class="hidden sm:inline">{{ t(s.labelKey) }}</span>
        </div>
        <div v-if="index < steps.length - 1" class="w-6 h-px bg-gray-300 dark:bg-gray-600"></div>
      </template>
    </div>

    <div class="flex flex-col items-end">
      <button
        v-if="ui.currentWizardStep < 4"
        :disabled="!canGoForward"
        :class="['px-4 py-2 text-sm rounded border font-medium transition-colors',
          canGoForward
            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
            : 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700']"
        @click="goForward"
      >
        {{ nextLabel }}
      </button>
      <p
        v-if="ui.currentWizardStep === 3 && !canGoForward"
        class="text-xs text-amber-600 mt-1 text-right"
      >
        {{ t('wizard.step3.selectionRequired') }}
      </p>
    </div>
  </nav>
</template>

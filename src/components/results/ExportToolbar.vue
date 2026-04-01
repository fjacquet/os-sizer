<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateShareUrl } from '@/composables/useUrlState'
import { generatePptxReport } from '@/composables/usePptxExport'
import { generateCsvReport } from '@/composables/useCsvExport'
import { generatePdfReport } from '@/composables/usePdfExport'

const { t } = useI18n()
const copied = ref(false)

async function handleShare() {
  const url = generateShareUrl()
  window.history.replaceState({}, '', url)
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // URL is already in address bar as fallback
  }
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}

const pdfLoading = ref(false)
const pptxLoading = ref(false)

function handleExportCsv() {
  generateCsvReport()
}

async function handleExportPdf() {
  pdfLoading.value = true
  try {
    await generatePdfReport()
  } finally {
    pdfLoading.value = false
  }
}

async function handleExportPptx() {
  pptxLoading.value = true
  try {
    await generatePptxReport()
  } finally {
    pptxLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-2 pt-2 print:hidden">
    <!-- Share URL -->
    <button
      class="text-sm px-2 py-1 sm:px-3 sm:py-2 font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
      :aria-label="t('results.toolbar.share')"
      @click="handleShare"
    >
      {{ copied ? t('results.toolbar.copied') : t('results.toolbar.share') }}
    </button>
    <!-- CSV export (04-05) -->
    <button
      class="text-sm px-2 py-1 sm:px-3 sm:py-2 font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
      :aria-label="t('results.toolbar.exportCsv')"
      @click="handleExportCsv"
    >
      {{ t('results.toolbar.exportCsv') }}
    </button>
    <!-- PDF export (04-05) -->
    <button
      class="text-sm px-2 py-1 sm:px-3 sm:py-2 font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      :aria-label="t('results.toolbar.exportPdf')"
      :disabled="pdfLoading"
      @click="handleExportPdf"
    >
      {{ t('results.toolbar.exportPdf') }}
    </button>
    <!-- PPTX export (04-04) -->
    <button
      class="text-sm px-2 py-1 sm:px-3 sm:py-2 font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      :aria-label="t('results.toolbar.exportPptx')"
      :disabled="pptxLoading"
      @click="handleExportPptx"
    >
      {{ pptxLoading ? t('results.toolbar.exportPptxLoading') : t('results.toolbar.exportPptx') }}
    </button>
  </div>
</template>

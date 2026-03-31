<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue'
  const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
      <h1 class="text-lg font-bold text-gray-900">{{ t('app.title') }}</h1>
      <LanguageSwitcher />
    </header>
    <main class="p-6">
      <p class="text-gray-500">Wizard placeholder — implemented in Phase 3.</p>
    </main>
  </div>
</template>

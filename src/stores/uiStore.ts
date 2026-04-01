import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n, loadLocale } from '../i18n'

type AppLocale = 'en' | 'fr' | 'de' | 'it'

export const useUiStore = defineStore('ui', () => {
  const browserLocale: AppLocale = navigator.language.startsWith('fr')
    ? 'fr'
    : navigator.language.startsWith('de')
      ? 'de'
      : navigator.language.startsWith('it')
        ? 'it'
        : 'en'
  const locale = ref<AppLocale>(browserLocale)

  async function setLocale(newLocale: AppLocale): Promise<void> {
    locale.value = newLocale
    if (newLocale === 'en') {
      i18n.global.locale.value = 'en'
    } else {
      await loadLocale(newLocale)
    }
  }

  // Eagerly load non-EN locale if browser is set to FR/DE/IT
  if (locale.value !== 'en') {
    loadLocale(locale.value as 'fr' | 'de' | 'it')
  }

  // os-sizer has 4 wizard steps: Environment → Workload → Architecture → Results
  // NOTE: type is 1|2|3|4 — vcf-sizer uses 1|2|3, which is WRONG for os-sizer
  const currentWizardStep = ref<1 | 2 | 3 | 4>(1)
  function setWizardStep(step: 1 | 2 | 3 | 4): void {
    currentWizardStep.value = step
  }

  const topologyConfirmed = ref<boolean>(false)
  function confirmTopology(): void {
    topologyConfirmed.value = true
  }

  // Dark mode: respect OS preference, persist manual override to localStorage
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined'
  const stored = isBrowser ? localStorage.getItem('os-sizer-dark-mode') : null
  const prefersDark = isBrowser ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  const isDarkMode = ref<boolean>(stored !== null ? stored === 'true' : prefersDark)

  function setDarkMode(value: boolean): void {
    isDarkMode.value = value
    if (isBrowser) {
      localStorage.setItem('os-sizer-dark-mode', String(value))
      document.documentElement.classList.toggle('dark', value)
    }
  }

  return {
    locale,
    setLocale,
    currentWizardStep,
    setWizardStep,
    topologyConfirmed,
    confirmTopology,
    isDarkMode,
    setDarkMode,
  }
})

import { createI18n } from 'vue-i18n'
import en from './locales/en.json'

export const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

export async function loadLocale(_locale: 'fr' | 'de' | 'it'): Promise<void> {}

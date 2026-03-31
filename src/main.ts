import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from './i18n'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(i18n)
// Note: hydrateFromUrl() will be added here in Phase 4 (after useUrlState.ts is written)
app.mount('#app')

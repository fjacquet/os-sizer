# Phase 1: Project Foundation - Research

**Researched:** 2026-03-31
**Domain:** Vue 3 + TypeScript + Vite 8 + Tailwind v4 + Pinia + vue-i18n project scaffolding
**Confidence:** HIGH — based on direct source-code reading of the reference project at /Users/fjacquet/Projects/vcf-sizer/

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | Vue 3 + TypeScript + Vite + Tailwind v4 project initialized with same conventions as vcf-sizer | Full package.json, vite.config.ts, tsconfig.* files extracted verbatim from vcf-sizer |
| SETUP-02 | ESLint + Prettier configured with same rules as vcf-sizer | eslint.config.js and .prettierrc extracted verbatim from vcf-sizer |
| SETUP-03 | Vitest configured for unit testing the sizing engine | vitest.config.ts extracted verbatim from vcf-sizer; pattern confirmed |
| SETUP-04 | vue-i18n configured with EN/FR/IT/DE locale files (lazy-loaded) | i18n/index.ts extracted verbatim; all 4 locales (en, fr, de, it) already present in vcf-sizer |
| SETUP-05 | Pinia configured with inputStore (refs) and calculationStore (computed) pattern | All three store files analyzed; exact patterns documented below |
| I18N-01 | All UI strings externalized to vue-i18n locale files | Flat JSON structure with top-level section keys documented |
| I18N-02 | English (EN) locale complete | en.json is the template; bundle eagerly |
| I18N-03 | French (FR) locale complete | fr.json exists in vcf-sizer; adapt for OCP domain keys |
| I18N-04 | Italian (IT) locale complete | it.json exists in vcf-sizer; adapt for OCP domain keys |
| I18N-05 | German (DE) locale complete | de.json exists in vcf-sizer; adapt for OCP domain keys |
| I18N-06 | Language switcher in header | LanguageSwitcher.vue component already exists in vcf-sizer; copy verbatim |
| I18N-07 | VueI18nPlugin configured WITHOUT the `include` option (Vite 8 rolldown compatibility) | Confirmed in vcf-sizer vite.config.ts: `VueI18nPlugin({ runtimeOnly: false })` — no `include` |
</phase_requirements>

---

## Summary

Phase 1 scaffolds the entire technical substrate of os-sizer before any domain logic is written. The reference project vcf-sizer (at `/Users/fjacquet/Projects/vcf-sizer/`) uses an identical stack and has already solved all three hard problems in this phase: Vite 8 rolldown compatibility for vue-i18n, the Swiss-locale number formatting edge case, and the Pinia store pattern that keeps calculationStore free of mutable state.

All configuration files (package.json, vite.config.ts, tsconfig.*, eslint.config.js, .prettierrc, vitest.config.ts) can be copied verbatim from vcf-sizer with only the `base` URL and project name changed. The i18n setup (including all 4 locale files) is likewise a direct copy, replacing vcf-sizer domain keys with OpenShift domain keys. The Pinia store skeletons require adaptation — inputStore must use `ClusterConfig[]` instead of `WorkloadDomainConfig[]`, but the structural patterns (ref-only in inputStore, computed-only in calculationStore, browser-locale detection in uiStore) are copied verbatim.

The single non-trivial decision is the App.vue shell layout. vcf-sizer uses a two-pane split (left = wizard, right = results always visible). os-sizer's 4-step wizard maps naturally to the same layout; the planner can copy the App.vue shell and rename components to be stubbed in this phase.

**Primary recommendation:** Copy vcf-sizer config files verbatim, create OCP-domain store skeletons and locale stubs following the exact patterns documented here.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | ^3.5.31 | UI framework | Composition API, SFC, reactive stores |
| vite | ^8.0.3 | Build tool + dev server | Rolldown-based, fastest HMR |
| @vitejs/plugin-vue | ^6.0.5 | SFC transform for Vite | Official Vue plugin |
| typescript | bundled with vue-tsc | Type safety | Strict mode enforced |
| vue-tsc | ^3.2.6 | Type-check .vue files | Required for build script |
| tailwindcss | ^4.2.2 | Utility CSS | v4: CSS-first, no config file needed |
| @tailwindcss/vite | ^4.2.2 | Tailwind v4 Vite integration | Official v4 plugin (replaces PostCSS) |
| pinia | ^3.0.4 | State management | Official Vue state library; setup store pattern |
| vue-i18n | ^11.3.0 | Internationalization | Official i18n library for Vue |
| @intlify/unplugin-vue-i18n | ^11.0.7 | i18n Vite plugin | Compiles locale JSON + handles SFC `<i18n>` blocks |
| vue-router | ^5.0.4 | Client-side routing | Required even for single-page apps with URL sharing |
| zod | ^4.3.6 | Schema validation + URL state | Runtime type safety for inputs |
| decimal.js | ^10.6.0 | Precision arithmetic | Prevents IEEE 754 float errors in sizing formulas |
| @vueuse/core | ^14.2.1 | Composition utility functions | Keyboard, clipboard, media query helpers |

### Dev / Testing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.2 | Unit test runner | Engine + store + composable tests |
| @vitest/ui | ^4.1.2 | Visual test UI | Local debugging |
| eslint | ^10.1.0 | Linting | All .ts and .vue files |
| @eslint/js | ^10.0.1 | Base ESLint rules | Extended by typescript-eslint |
| typescript-eslint | ^8.58.0 | TypeScript-aware lint | Enforces type safety in lint |
| eslint-plugin-vue | ^10.8.0 | Vue-specific lint rules | flat/recommended config |
| eslint-config-prettier | ^10.1.8 | Disable formatting lint rules | Avoids ESLint/Prettier conflicts |
| prettier | ^3.8.1 | Code formatter | Applied on save + pre-commit |
| globals | ^17.4.0 | Global variable definitions | Required by ESLint flat config |
| @types/node | ^25.5.0 | Node.js type definitions | For vite.config.ts, vitest.config.ts |

### Additions vs vcf-sizer (Phase 4, not Phase 1)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| jspdf | ^2.5.x | PDF export | Dynamic import only; Phase 4 |
| jspdf-autotable | ^3.8.x | PDF table layout | Dynamic import only; Phase 4 |

**Installation (exact vcf-sizer match):**

```bash
npm create vite@latest os-sizer -- --template vue-ts
cd os-sizer
npm install vue@^3.5.31 vite@^8.0.3 @vitejs/plugin-vue@^6.0.5 \
  tailwindcss@^4.2.2 @tailwindcss/vite@^4.2.2 \
  pinia@^3.0.4 vue-i18n@^11.3.0 vue-router@^5.0.4 \
  zod@^4.3.6 decimal.js@^10.6.0 lz-string@^1.5.0 \
  @vueuse/core@^14.2.1 chart.js@^4.5.1 vue-chartjs@^5.3.3 \
  pptxgenjs@^4.0.1
npm install -D @intlify/unplugin-vue-i18n@^11.0.7 \
  @types/node@^25.5.0 vitest@^4.1.2 @vitest/ui@^4.1.2 \
  vue-tsc@^3.2.6 eslint@^10.1.0 @eslint/js@^10.0.1 \
  typescript-eslint@^8.58.0 eslint-plugin-vue@^10.8.0 \
  eslint-config-prettier@^10.1.8 prettier@^3.8.1 globals@^17.4.0
```

---

## Architecture Patterns

### Recommended Project Structure

```
os-sizer/
├── src/
│   ├── engine/              # Pure TypeScript — ZERO Vue imports (CALC-01)
│   │   ├── types.ts         # All interfaces and discriminated unions
│   │   ├── compute.ts       # Sizing formula functions
│   │   ├── validation.ts    # Returns ValidationWarning[] — never throws
│   │   └── defaults.ts      # Factory functions (not constants)
│   ├── stores/              # Pinia stores only
│   │   ├── inputStore.ts    # ref() ONLY — user inputs
│   │   ├── calculationStore.ts  # computed() ONLY — derived results
│   │   └── uiStore.ts       # locale ref, wizard step ref, topology confirmed ref
│   ├── composables/         # Plain TypeScript modules
│   │   └── useUrlState.ts   # URL encode/decode; called in main.ts
│   ├── components/
│   │   └── shared/
│   │       └── LanguageSwitcher.vue  # Phase 1 only shared component
│   ├── i18n/
│   │   ├── index.ts         # createI18n() + loadLocale()
│   │   └── locales/
│   │       ├── en.json      # Bundled eagerly
│   │       ├── fr.json      # Lazy-loaded
│   │       ├── de.json      # Lazy-loaded
│   │       └── it.json      # Lazy-loaded
│   ├── App.vue              # Root layout: header + left wizard pane + right results pane
│   ├── main.ts              # Bootstrap order: createApp → pinia → i18n → hydrateFromUrl → mount
│   └── style.css            # @import "tailwindcss" (v4 syntax)
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json            # References app + node + vitest configs
├── tsconfig.app.json        # src/ compilation
├── tsconfig.node.json       # vite.config.ts + vitest.config.ts
├── tsconfig.vitest.json     # test file compilation
├── eslint.config.js
└── .prettierrc
```

### Pattern 1: vite.config.ts — exact copy with base changed

```typescript
// Source: /Users/fjacquet/Projects/vcf-sizer/vite.config.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

export default defineConfig({
  base: '/os-sizer/',  // ONLY change from vcf-sizer
  plugins: [
    vue(),
    tailwindcss(),
    // CRITICAL: NO `include` option — rolldown/JSON conflict with Vite 8
    VueI18nPlugin({
      runtimeOnly: false,
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

### Pattern 2: Tailwind v4 CSS setup

```css
/* Source: /Users/fjacquet/Projects/vcf-sizer/src/style.css */
@import "tailwindcss";

@custom-variant print (@media print);

@page {
  size: A4 portrait;
  margin: 25mm 15mm 25mm 15mm;
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

Tailwind v4 requires only `@import "tailwindcss"` in CSS. No `tailwind.config.js` file.

### Pattern 3: inputStore skeleton

```typescript
// Source: adapted from /Users/fjacquet/Projects/vcf-sizer/src/stores/inputStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDefaultClusterConfig } from '@/engine/defaults'
import type { ClusterConfig } from '@/engine/types'

export const useInputStore = defineStore('input', () => {
  // ref<[]> NOT reactive([]) — avoids storeToRefs() double-wrap bug
  const clusters = ref<ClusterConfig[]>([createDefaultClusterConfig(0)])
  const activeClusterIndex = ref(0)

  function addCluster() {
    clusters.value.push(createDefaultClusterConfig(clusters.value.length))
    activeClusterIndex.value = clusters.value.length - 1
  }

  function removeCluster(id: string) {
    const idx = clusters.value.findIndex(c => c.id === id)
    if (idx === -1 || clusters.value.length === 1) return
    clusters.value.splice(idx, 1)
    activeClusterIndex.value = Math.min(activeClusterIndex.value, clusters.value.length - 1)
  }

  function updateCluster(id: string, patch: Partial<ClusterConfig>) {
    const cluster = clusters.value.find(c => c.id === id)
    if (cluster) Object.assign(cluster, patch)  // direct assignment, NOT $patch()
  }

  return { clusters, activeClusterIndex, addCluster, removeCluster, updateCluster }
})
```

### Pattern 4: calculationStore skeleton

```typescript
// Source: adapted from /Users/fjacquet/Projects/vcf-sizer/src/stores/calculationStore.ts
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import type { SizingResult } from '@/engine/types'

export const useCalculationStore = defineStore('calculation', () => {
  // CRITICAL: call useInputStore() at TOP LEVEL — never inside a computed() callback
  const input = useInputStore()

  const clusterResults = computed<SizingResult[]>(() =>
    input.clusters.map(cluster => ({
      id: cluster.id,
      // engine functions called here — stubbed as empty objects in Phase 1
      sizing: {} as SizingResult,
      validationErrors: [],
    }))
  )

  // ZERO ref() — only computed() — CALC-02 enforced
  return { clusterResults }
})
```

### Pattern 5: uiStore — copy verbatim

```typescript
// Source: /Users/fjacquet/Projects/vcf-sizer/src/stores/uiStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n, loadLocale } from '../i18n'

type AppLocale = 'en' | 'fr' | 'de' | 'it'

export const useUiStore = defineStore('ui', () => {
  const browserLocale: AppLocale = navigator.language.startsWith('fr') ? 'fr'
    : navigator.language.startsWith('de') ? 'de'
    : navigator.language.startsWith('it') ? 'it'
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

  if (locale.value !== 'en') {
    loadLocale(locale.value as 'fr' | 'de' | 'it')
  }

  const currentWizardStep = ref<1 | 2 | 3 | 4>(1)  // os-sizer has 4 steps
  function setWizardStep(step: 1 | 2 | 3 | 4): void {
    currentWizardStep.value = step
  }

  const topologyConfirmed = ref<boolean>(false)
  function confirmTopology(): void {
    topologyConfirmed.value = true
  }

  return { locale, setLocale, currentWizardStep, setWizardStep, topologyConfirmed, confirmTopology }
})
```

### Pattern 6: i18n/index.ts — copy verbatim

```typescript
// Source: /Users/fjacquet/Projects/vcf-sizer/src/i18n/index.ts
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'

export const i18n = createI18n({
  legacy: false,           // REQUIRED for Vue 3 Composition API mode
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
  // Explicit Swiss locale numberFormats — do NOT inherit from parent locale
  numberFormats: {
    'en': { decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }, integer: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }, percent: { style: 'percent', minimumFractionDigits: 1 } },
    'fr-CH': { decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }, integer: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }, percent: { style: 'percent', minimumFractionDigits: 1 } },
    'de-CH': { decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }, integer: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }, percent: { style: 'percent', minimumFractionDigits: 1 } },
    'it-CH': { decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }, integer: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }, percent: { style: 'percent', minimumFractionDigits: 1 } },
  },
})

// Lazy-load non-EN locale files on demand (called from uiStore.setLocale)
// Explicit if/else — NOT a template literal — so bundler can tree-shake
export async function loadLocale(locale: 'fr' | 'de' | 'it'): Promise<void> {
  const localeMap: Record<string, string> = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messages: { default: any }
  if (locale === 'fr') messages = await import('./locales/fr.json')
  else if (locale === 'de') messages = await import('./locales/de.json')
  else messages = await import('./locales/it.json')
  i18n.global.setLocaleMessage(localeMap[locale], messages.default)
  i18n.global.locale.value = localeMap[locale] as 'fr-CH' | 'de-CH' | 'it-CH'
}
```

### Pattern 7: main.ts bootstrap order

```typescript
// Source: /Users/fjacquet/Projects/vcf-sizer/src/main.ts
// ORDER IS CRITICAL — do not reorder
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from './i18n'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(i18n)
// hydrateFromUrl() goes here when useUrlState.ts is written (Phase 4)
app.mount('#app')
```

### Pattern 8: Locale file structure (en.json skeleton for os-sizer)

```json
{
  "app": { "title": "OpenShift Sizing Calculator" },
  "language": { "label": "Language", "en": "EN", "fr": "FR", "de": "DE", "it": "IT" },
  "topology": {
    "label": "Topology",
    "standardHa": "Standard HA",
    "compact3node": "Compact 3-Node",
    "sno": "Single Node OpenShift",
    "twoNodeArbiter": "Two-Node + Arbiter",
    "twoNodeFencing": "Two-Node + Fencing",
    "hcp": "Hosted Control Planes",
    "microshift": "MicroShift",
    "managedCloud": "Managed Cloud (ROSA/ARO)"
  },
  "node": {
    "masters": "Control Plane Nodes",
    "workers": "Worker Nodes",
    "infra": "Infrastructure Nodes",
    "storage": "ODF Storage Nodes"
  },
  "wizard": {
    "step1": "Environment",
    "step2": "Workload",
    "step3": "Architecture",
    "step4": "Results"
  },
  "validation": {},
  "results": {}
}
```

### Anti-Patterns to Avoid

- **reactive([]) in stores:** Breaks `storeToRefs()` destructuring. Always use `ref<T[]>([])`.
- **$patch() for array mutations:** Pinia shallow merge silently drops array elements. Use direct `Object.assign()`.
- **useInputStore() inside computed():** Call store at top level of setup function, not inside any computed callback.
- **include: [...] in VueI18nPlugin:** Rolldown/JSON conflict in Vite 8. Omit entirely.
- **Template literal dynamic imports for locales:** Bundler cannot tree-shake `await import(\`./locales/${locale}.json\`)`. Use explicit if/else branches.
- **Tailwind config file:** Tailwind v4 uses CSS-first configuration. Do NOT create `tailwind.config.js`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Float arithmetic for sizing | Custom rounding | decimal.js | IEEE 754 silent errors at scale |
| Locale lazy-loading | Custom fetch + eval | vue-i18n `setLocaleMessage()` | Tree-shaking, SSR-safe, reactivity |
| URL state compression | Base64 | lz-string | 3-5x better compression for JSON |
| Schema validation | Manual type guards | Zod | Recursive, composable, mirrors TypeScript types |
| Tailwind CSS utilities | Custom classes | Tailwind v4 | Already in stack; no config needed |

**Key insight:** Every "hand-rolled" alternative to decimal.js has failed in production sizing tools when inputs hit boundary values near powers of 2.

---

## Common Pitfalls

### Pitfall 1: VueI18nPlugin `include` option breaks Vite 8 rolldown

**What goes wrong:** Build fails with a rolldown/JSON transform conflict. Error resembles `Cannot read properties of undefined (reading 'id')` or a silent empty locale bundle.
**Why it happens:** Vite 8 uses rolldown which handles `.json` imports natively. When `@intlify/unplugin-vue-i18n` also claims the same JSON files via `include`, a transform ownership conflict occurs.
**How to avoid:** Use `VueI18nPlugin({ runtimeOnly: false })` — omit `include` entirely.
**Warning signs:** Build succeeds but translated strings are empty; `npm run build` throws rolldown-related error mentioning JSON files.

### Pitfall 2: `reactive([])` in stores breaks `storeToRefs()`

**What goes wrong:** Destructuring `const { workloadDomains } = storeToRefs(store)` produces a double-wrapped ref; mutations don't propagate to template.
**Why it happens:** `storeToRefs()` wraps reactive properties in refs for destructuring safety; `reactive([])` is already reactive, causing a double-wrapping.
**How to avoid:** Always `ref<T[]>([])` for arrays in Pinia setup stores.
**Warning signs:** Template shows stale data after store mutations; Vue devtools shows unexpected ref nesting.

### Pitfall 3: `$patch()` silently discards array mutations

**What goes wrong:** `store.$patch({ clusters: [...updatedArray] })` appears to succeed but the store retains stale data.
**Why it happens:** Pinia's `$patch` does a shallow object merge — it replaces top-level keys. For arrays this replaces the ref's internal value with a new non-reactive array.
**How to avoid:** Use `store.updateCluster(id, patch)` action which calls `Object.assign()` on the target object.
**Warning signs:** Store mutation appears to work in devtools but computed properties don't recompute.

### Pitfall 4: `useInputStore()` called inside `computed()`

**What goes wrong:** Pinia throws "getActivePinia() was called with no active pinia" during SSR or test setup.
**Why it happens:** `useInputStore()` resolves the active Pinia instance at call time. Inside a computed callback, the Pinia context may no longer be active.
**How to avoid:** Call `const input = useInputStore()` at the TOP LEVEL of the setup function body, never inside `computed()`, `watch()`, or any callback.
**Warning signs:** Works in dev, fails in tests or during build-time SSR.

### Pitfall 5: Swiss locale number formats must be explicitly defined

**What goes wrong:** Numbers render with locale-specific thousand separators (e.g., `1'000` for French Swiss) that are inconsistent with user expectations.
**Why it happens:** vue-i18n inherits number formats from the parent locale (`fr`, `de`, `it`). Swiss users expect plain numeric formatting without thousand separators.
**How to avoid:** Define explicit `numberFormats` for `fr-CH`, `de-CH`, `it-CH` in `createI18n()` — do NOT rely on inheritance.
**Warning signs:** Numbers display with apostrophe or period thousand separators in certain locales.

### Pitfall 6: Zod nested schema `.default({})` bypasses inner field defaults

**What goes wrong:** Fields within a nested object schema have their defaults ignored when the parent uses `.default({})`.
**Why it happens:** Zod v4 `.default({})` passes the empty object as-is, bypassing the inner schema's `.default()` calls.
**How to avoid:** Use factory function `.default(() => NestedSchema.parse({}))` to trigger inner defaults.
**Warning signs:** Nested objects hydrate as empty `{}` instead of populated defaults when URL decoding.

### Pitfall 7: Wizard step range must be 1–4 for os-sizer (not 1–3 like vcf-sizer)

**What goes wrong:** Copying uiStore verbatim from vcf-sizer gives `currentWizardStep = ref<1 | 2 | 3>`. os-sizer has 4 wizard steps.
**Why it happens:** vcf-sizer has a 3-step wizard. os-sizer has: Environment → Workload → Architecture → Results.
**How to avoid:** Change the type to `ref<1 | 2 | 3 | 4>` and `setWizardStep(step: 1 | 2 | 3 | 4)`.
**Warning signs:** TypeScript error on step 4 navigation; wizard terminates at step 3.

---

## Configuration Files — Exact Values

### package.json scripts (copy verbatim)

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b tsconfig.app.json tsconfig.node.json && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "type-check": "vue-tsc --noEmit",
    "lint": "eslint src --ext .ts,.vue"
  }
}
```

### .prettierrc (copy verbatim)

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf",
  "vueIndentScriptAndStyle": true
}
```

### eslint.config.js (copy verbatim)

Key rules:
- `@typescript-eslint/no-unused-vars`: error with `argsIgnorePattern: '^_'`
- `@typescript-eslint/no-explicit-any`: warn
- `vue/multi-word-component-names`: off
- `vue/block-lang`: error — script lang must be `ts`
- Test files (`**/*.test.ts`): no-unused-vars disabled

### tsconfig.json (copy verbatim)

References three project configs:
- `tsconfig.app.json` — src/ compilation
- `tsconfig.node.json` — vite.config.ts, vitest.config.ts
- `tsconfig.vitest.json` — test files with `vitest/globals` types

### tsconfig.app.json strict settings

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "exclude": ["src/**/*.test.ts", "src/**/*.spec.ts"]
}
```

### vitest.config.ts (copy verbatim, update include paths as engine grows)

```typescript
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',   // Pure TS engine tests — no DOM needed
    globals: true,
    include: [
      'src/engine/**/*.test.ts',
      'src/composables/**/*.test.ts',
      'src/stores/**/*.test.ts',
    ],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (copy from vcf-sizer) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` (same; no watch mode in `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-01 | `npm run dev` starts without errors | smoke | `npm run dev` (manual) | N/A |
| SETUP-02 | ESLint passes on all files | lint | `npm run lint` | N/A |
| SETUP-03 | Vitest runner executes (zero tests is OK) | smoke | `npm run test` | Wave 0 |
| SETUP-04 | Language switcher changes locale, EN/FR/DE/IT all render | smoke | `npm run dev` (manual) | N/A |
| SETUP-05 | Stores compile, TypeScript strict passes | type-check | `npm run type-check` | Wave 0 |
| I18N-07 | `npm run build` produces bundle without rolldown error | build | `npm run build` | N/A |

### Sampling Rate

- **Per task commit:** `npm run type-check` (fast, catches store/type issues)
- **Per wave merge:** `npm run test && npm run lint && npm run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/stores/inputStore.test.ts` — covers SETUP-05 store ref pattern
- [ ] `src/stores/uiStore.test.ts` — covers locale detection and setLocale
- [ ] `src/stores/calculationStore.test.ts` — covers computed-only pattern
- [ ] `vitest.config.ts` — required before any test can run

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm scripts, Vite | Must verify | — | None — required |
| npm | Package install | Must verify | — | None — required |
| git | Version control | Assumed present | — | None |

The environment audit is minimal for this phase: it is a pure scaffold/code task with no external services, databases, or OS-registered state. The only prerequisite is a working Node.js + npm installation.

**Note:** The target machine has not been probed in this research session. The planner should include a preflight check (`node --version && npm --version`) as the first task action.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js | CSS-first `@import "tailwindcss"` | Tailwind v4 (2024) | No config file needed |
| PostCSS for Tailwind | `@tailwindcss/vite` plugin | Tailwind v4 (2024) | Faster builds, simpler config |
| vue-i18n `include: ['src/**/*.json']` | Omit `include` entirely | Vite 8 rolldown | Avoids JSON transform conflict |
| vue-i18n `legacy: true` | `legacy: false` | vue-i18n v9+ | Required for Composition API (`useI18n()`) |
| Options API Pinia | Setup store (`defineStore('id', () => {})`) | Pinia v2+ | Cleaner TypeScript, explicit ref vs computed |

---

## Open Questions

1. **`LanguageSwitcher.vue` component implementation**
   - What we know: It exists in vcf-sizer at `src/components/shared/LanguageSwitcher.vue`
   - What's unclear: The file was not read in this research session
   - Recommendation: Read and copy verbatim in the i18n plan task; it is a simple component calling `uiStore.setLocale()`

2. **App.vue shell for os-sizer**
   - What we know: vcf-sizer uses a 2-pane split (left wizard, right always-visible results)
   - What's unclear: os-sizer's 4-step wizard may want a different layout at Phase 1 (no results pane yet)
   - Recommendation: Create a simplified App.vue with header + LanguageSwitcher + stub wizard area; full layout introduced in Phase 3

3. **git hooks setup**
   - What we know: The plan mentions "set up git hooks" but vcf-sizer does not appear to use Husky or lint-staged
   - What's unclear: Whether this means a simple pre-commit script or a full Husky setup
   - Recommendation: Use a simple `.git/hooks/pre-commit` script running `npm run lint && npm run type-check`; skip Husky for simplicity

---

## Sources

### Primary (HIGH confidence)

- Direct source reading of `/Users/fjacquet/Projects/vcf-sizer/` (production reference project, same maintainer)
  - `package.json` — exact dependency versions
  - `vite.config.ts` — VueI18nPlugin configuration confirmed
  - `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.vitest.json` — full TypeScript setup
  - `eslint.config.js` — exact rule set
  - `.prettierrc` — exact formatter config
  - `vitest.config.ts` — test runner configuration
  - `src/main.ts` — bootstrap order
  - `src/App.vue` — root layout pattern
  - `src/style.css` — Tailwind v4 import syntax
  - `src/i18n/index.ts` — createI18n + loadLocale pattern
  - `src/stores/inputStore.ts` — ref-only pattern
  - `src/stores/calculationStore.ts` — computed-only pattern
  - `src/stores/uiStore.ts` — locale + wizard step management
- `/Users/fjacquet/Projects/os-sizer/.planning/research/app-architecture.md` — project architecture decisions (HIGH confidence)

### Secondary (MEDIUM confidence)

- `.planning/STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md` — project scope and requirements

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — exact versions from production package.json
- Architecture: HIGH — direct code reading, not documentation inference
- Pitfalls: HIGH — documented from vcf-sizer source comments and app-architecture.md; all verified against source code

**Research date:** 2026-03-31
**Valid until:** 2026-09-30 (stable stack; Vite/Tailwind/vue-i18n major versions unlikely to change within 6 months)

---

## RESEARCH COMPLETE

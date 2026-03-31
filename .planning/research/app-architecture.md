# App Architecture Research: os-sizer

**Source project:** `/Users/fjacquet/Projects/vcf-sizer/`
**Researched:** 2026-03-31
**Confidence:** HIGH — based on direct source-code reading of a production project by the same maintainer

---

## Executive Summary

vcf-sizer is a mature, well-structured Vue 3 sizing calculator. Its architecture is clean enough that os-sizer can reuse it almost entirely — same stack, same layer separation, same composable patterns. The OpenShift domain knowledge is the only substantive difference. The three additions (PDF export, CSV export, 4-language i18n) each have clear implementation paths.

---

## 1. Layer Separation Architecture

vcf-sizer enforces three strict layers by convention. os-sizer must preserve these exactly.

```
src/engine/        — Pure TypeScript. ZERO Vue imports. All formulas here.
src/stores/        — Pinia stores only. inputStore holds ref(), calculationStore holds only computed().
src/components/    — Vue SFCs. Read from stores. Never call engine directly.
src/composables/   — Plain TypeScript modules. No Vue lifecycle hooks.
src/i18n/          — vue-i18n setup + lazy-loaded locale JSON files.
```

**Constraint CALC-01:** Engine files must never import from Vue, Pinia, or any Vue ecosystem library.
**Constraint CALC-02:** `calculationStore.ts` must contain zero `ref()` — only `computed()`.

These are not optional patterns. Breaking them makes unit tests impossible (engine tests run in Node, no DOM).

---

## 2. Engine Layer

**Files to model:** `src/engine/types.ts`, `src/engine/compute.ts`, `src/engine/storage.ts`, `src/engine/validation.ts`, `src/engine/defaults.ts`

### Type definitions pattern (`types.ts`)

Define all input/output types as interfaces and discriminated union types in a single file. Keep them flat where possible — deep nesting makes Zod schema mirroring harder.

Key pattern from vcf-sizer `types.ts`:

- Input interfaces (e.g., `ComputeInputs`) are separate from result interfaces (e.g., `ComputeResult`).
- `ValidationWarning` uses an i18n `messageKey` string, never an English string literal.
- Domain config objects (e.g., `WorkloadDomainConfig`) are the single source of truth for what inputStore persists.

For os-sizer, define equivalent types:

```typescript
// Topology discriminated union — covers all 8 OpenShift topologies
export type TopologyType =
  | 'standard-ha'       // 3 masters + N workers + optional infra
  | 'compact-3node'     // masters double as workers
  | 'sno'               // single node OpenShift
  | 'two-node-arbiter'  // TNA
  | 'two-node-fencing'  // TNF — bare-metal only
  | 'hcp'               // hosted control planes
  | 'microshift'        // edge/IoT
  | 'managed-cloud'     // ROSA/ARO — informational only

export interface ClusterConfig {
  id: string
  name: string
  topology: TopologyType
  // ... workload inputs
}

export interface SizingResult {
  masterNodes: NodeSpec
  workerNodes: NodeSpec
  infraNodes: NodeSpec | null
  // ...
}

export interface ValidationWarning {
  code: string
  severity: 'error' | 'warning'
  messageKey: string  // i18n key, NOT English string
}
```

### Calculation function pattern (`compute.ts`)

Each calculation function takes a typed input struct and returns a typed result struct. Use `decimal.js` for all arithmetic — IEEE 754 float errors corrupt utilization percentages.

```typescript
import Decimal from 'decimal.js'
import type { ClusterInputs, ClusterResult } from './types'

export function calcCluster(inputs: ClusterInputs): ClusterResult {
  // All arithmetic via new Decimal(x).plus(y).toNumber()
}
```

**Why decimal.js:** `100 * 4 / 4` can return `99.99999999...` in plain JS due to IEEE 754. In a sizing tool this matters.

### Validation pattern (`validation.ts`)

Return `ValidationWarning[]`. Never `throw`. Never use English strings — only i18n keys.

```typescript
export function validateInputs(inputs: ValidationInputs): ValidationWarning[] {
  const errors: ValidationWarning[] = []
  if (someCondition) {
    errors.push({
      code: 'OCP_MIN_MASTERS',
      severity: 'error',
      messageKey: 'validation.ocpMinMasters',  // key defined in all 4 locale JSON files
    })
  }
  return errors
}
```

### Defaults factory pattern (`defaults.ts`)

Factory functions, not exported constants. Constants are shared references — mutations propagate unexpectedly.

```typescript
export function createDefaultClusterConfig(index: number): ClusterConfig {
  return {
    id: crypto.randomUUID(),
    name: `Cluster-${index + 1}`,
    topology: 'standard-ha',
    // ... all fields with defaults
  }
}
```

---

## 3. Store Layer

**Files to reuse (with adaptation):** `src/stores/inputStore.ts`, `src/stores/calculationStore.ts`, `src/stores/uiStore.ts`

### inputStore pattern

- Use `ref<ClusterConfig[]>([createDefaultClusterConfig(0)])` for the cluster array.
- NEVER use `reactive([])` — `storeToRefs()` double-wrap bug breaks destructuring.
- NEVER use `$patch()` for array mutations — shallow merge silently discards array elements.
- Use direct property assignment via `Object.assign(domain, patch)` for per-field updates.

```typescript
export const useInputStore = defineStore('input', () => {
  const clusters = ref<ClusterConfig[]>([createDefaultClusterConfig(0)])
  const activeDomainIndex = ref(0)

  function updateCluster(id: string, patch: Partial<ClusterConfig>) {
    const cluster = clusters.value.find(c => c.id === id)
    if (cluster) Object.assign(cluster, patch)
  }
  // add, remove, rename follow vcf-sizer exactly
  return { clusters, activeDomainIndex, updateCluster, ... }
})
```

### calculationStore pattern

Zero `ref()` — only `computed()`. Call `useInputStore()` at the TOP LEVEL of the store setup function, never inside a computed callback.

```typescript
export const useCalculationStore = defineStore('calculation', () => {
  const input = useInputStore()  // TOP LEVEL — not inside computed()

  const clusterResults = computed<ClusterResult[]>(() =>
    input.clusters.map(cluster => ({
      id: cluster.id,
      sizing: calcCluster({ ...cluster }),
      validation: validateInputs({ ...cluster }),
    }))
  )

  return { clusterResults }
})
```

### uiStore pattern

Manages: locale (with auto-detection), wizard step, topology confirmation flag. The topology confirmation flag is ephemeral — NEVER serialize it to URL state.

The 4-locale setup in uiStore.ts is already correct for os-sizer (EN, FR, DE, IT):

```typescript
type AppLocale = 'en' | 'fr' | 'de' | 'it'
const browserLocale: AppLocale = navigator.language.startsWith('fr') ? 'fr'
  : navigator.language.startsWith('de') ? 'de'
  : navigator.language.startsWith('it') ? 'it'
  : 'en'
```

---

## 4. i18n Structure

**Files to reuse:** `src/i18n/index.ts`, `src/i18n/locales/en.json` (as template for all 4 locales)

### Setup pattern

vcf-sizer already has all 4 locales (EN, FR, DE, IT). The setup in `src/i18n/index.ts` is directly reusable:

- `legacy: false` — required for Vue 3 Composition API mode.
- EN is bundled eagerly; FR, DE, IT are lazy-loaded via dynamic import on `setLocale()`.
- Swiss locale codes (`fr-CH`, `de-CH`, `it-CH`) with explicit `numberFormats` — do NOT inherit from parent locale (`fr`, `de`, `it`), as inherited formats use locale-specific thousand separators that break Swiss user expectations.

**Critical i18n constraint:** All validation messages must use i18n keys (`'validation.ocpMinMasters'`), never raw strings. This applies in both the engine layer and component templates.

### Locale file structure

Keep the flat JSON structure from vcf-sizer. Nest by UI section:

```json
{
  "app": { "title": "OpenShift Sizing Calculator" },
  "topology": { "standardHa": "Standard HA", ... },
  "node": { "masters": "Master Nodes", ... },
  "results": { ... },
  "validation": { "ocpMinMasters": "..." },
  "wizard": { ... },
  "results": { "toolbar": { "exportPdf": "Export PDF", "exportCsv": "Export CSV", ... } }
}
```

---

## 5. URL State Composable

**File to reuse:** `src/composables/useUrlState.ts`

The pattern is directly transferable. Key points:

1. Zod schema mirrors inputStore exactly — use `.strip()` to discard unknown keys from untrusted URL params.
2. Use factory defaults for nested schemas: `ManagementDomainSchema.default(() => ManagementDomainSchema.parse({}))` — `.default({})` bypasses inner field defaults (Zod behavior).
3. LZString import is a DEFAULT import: `import LZString from 'lz-string'` — not named exports.
4. Re-generate `crypto.randomUUID()` IDs on hydration — URL-serialized IDs are not meaningful.
5. `hydrateFromUrl()` is called in `main.ts` AFTER Pinia is initialized, BEFORE `app.mount()`.
6. Wizard step and topology-confirmed flag are NOT serialized to URL — they are ephemeral UI state.

```typescript
// main.ts bootstrap order (critical)
const app = createApp(App)
app.use(createPinia())
app.use(i18n)
hydrateFromUrl()        // after pinia, before mount
app.use(router)
app.mount('#app')
```

---

## 6. PPTX Export Composable

**File to reuse:** `src/composables/usePptxExport.ts`

Load pptxgenjs via `dynamic import()` — keeps it out of the main bundle. This is critical; pptxgenjs is ~1MB.

```typescript
// Pattern from usePptxExport.ts
async function generatePptxReport() {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  // ...
}
```

Define local `TableCell` / `TableRow` types rather than importing from pptxgenjs namespace — avoids resolution issues with the dynamic-import-only pattern.

All hex colors in pptxgenjs are WITHOUT `#` prefix (e.g., `'003087'` not `'#003087'`).

The export button pattern in `ExportToolbar.vue` uses a local `pptxLoading` ref and disables the button while generating, preventing double-clicks.

---

## 7. Component Patterns

**Key shared components to replicate:**

### `NumberSliderInput.vue` (src/components/shared/)

Dual input: number field + range slider, synchronized via a single `onInput` handler. `v-model` via `modelValue` prop + `update:modelValue` emit. No dependencies — copy verbatim.

```typescript
const props = defineProps<{
  modelValue: number
  label: string
  min: number
  max: number
  step?: number
  unit?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
```

### `WizardStepper.vue` (src/components/shared/)

3-step wizard with `canGoBack` / `canGoForward` computed gates. Step-forward gating is per-step:

- Step 1: requires topology confirmation (user clicks a topology button)
- Step 2: requires valid cluster config (no blocking validation errors)
- Step 3: final — no forward navigation

For os-sizer, the 3 wizard steps map to:

1. Topology selection (which OpenShift architecture?)
2. Cluster configuration (node specs, workload profile)
3. Results + exports

### Domain field computed pattern (HostSpecsForm.vue)

```typescript
// Reusable pattern for two-way binding into a specific domain's field
function domainField<K extends keyof ClusterConfig>(key: K) {
  return computed({
    get: () => {
      const d = input.clusters.find(d => d.id === props.clusterId)
      return (d ?? createDefaultClusterConfig(0))[key]
    },
    set: (val: ClusterConfig[K]) => {
      input.updateCluster(props.clusterId, { [key]: val } as Partial<ClusterConfig>)
    },
  })
}

const topology = domainField('topology')
const masterCount = domainField('masterCount')
// usage in template: v-model="topology"
```

### Validation display pattern (DomainResultCard.vue)

```html
<div
  v-for="w in result.validationErrors"
  :key="w.code"
  :class="w.severity === 'error'
    ? 'bg-red-50 border-red-400 text-red-800'
    : 'bg-yellow-50 border-yellow-400 text-yellow-800'"
  role="alert"
>
  {{ t(w.messageKey) }}
</div>
```

### ExportToolbar.vue

Keep the same 4-button pattern: Share URL, Export Markdown (or replace with CSV), Print, Export PPTX/PDF. Add PDF and CSV buttons for os-sizer.

---

## 8. Testing Patterns

**Coverage target:** `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` only. No DOM environment needed — Vitest runs in Node.

### Engine test pattern

```typescript
/// <reference types="vitest/globals" />
import { calcCluster } from './cluster'

describe('calcCluster — standard HA', () => {
  it('3 masters + ceil(workload/node_capacity) workers', () => {
    const result = calcCluster({
      topology: 'standard-ha',
      masterCount: 3,
      // ...
    })
    expect(result.workerNodes.count).toBe(4)
  })
})
```

Test naming convention: `describe('functionName — scenario')` / `it('expected formula outcome')`. Each test documents the formula in its description.

### Composable test pattern (`useUrlState.test.ts`, `useMarkdownExport.test.ts`)

Composable tests use `setActivePinia(createPinia())` in `beforeEach` — required because composables call `useInputStore()` inside them.

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useInputStore } from '@/stores/inputStore'

beforeEach(() => {
  setActivePinia(createPinia())
})

it('round-trips URL state', () => {
  const store = useInputStore()
  store.clusters[0].topology = 'compact-3node'
  const url = generateShareUrl()
  // ... check URL contains expected encoded state
})
```

---

## 9. PDF Export — Recommendation

vcf-sizer does not have PDF export. Two viable options for os-sizer:

### Option A: jsPDF + jspdf-autotable (RECOMMENDED)

**Why:** Programmatic, no DOM dependency, TypeScript types available, table-first design matches a BoM report. Dynamic import pattern matches existing pptxgenjs pattern.

```typescript
// src/composables/usePdfExport.ts
export async function generatePdfReport(): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF()
  // build tables from calculationStore data
  autoTable(doc, {
    head: [['Node Type', 'Count', 'CPU', 'RAM']],
    body: rows,
  })
  doc.save('os-sizing-report.pdf')
}
```

Packages: `jspdf` (~350KB), `jspdf-autotable` (~150KB). Both support dynamic import.

**Confidence:** MEDIUM — widely used, TypeScript types exist, but jsPDF v2 has some TypeScript quirks with `jspdf-autotable` integration requiring `@types/jspdf-autotable` or manual type augmentation.

### Option B: html2pdf.js / window.print()

Print CSS with `@media print` is already partially in vcf-sizer (the `print:hidden` classes on `ExportToolbar.vue`). Adding `@page` rules and `break-inside-avoid` on result cards gives a workable PDF via browser print dialog.

**Why not recommended as primary:** No programmatic filename, user must interact with print dialog, layout control is limited.

**Recommendation:** Use jsPDF + jspdf-autotable for the PDF export button. Keep `window.print()` as a secondary fallback (button already exists in ExportToolbar.vue). Implement PDF via the same dynamic import pattern as PPTX.

---

## 10. CSV Export — Recommendation

No library needed. Plain TypeScript function in a composable:

```typescript
// src/composables/useCsvExport.ts
export function generateCsvReport(): string {
  const calc = useCalculationStore()
  const rows: string[][] = [
    ['Topology', 'Master Nodes', 'Master CPU', 'Master RAM', 'Worker Nodes', 'Worker CPU', 'Worker RAM'],
    ...calc.clusterResults.map(r => [
      r.topology,
      String(r.masterNodes.count),
      String(r.masterNodes.cpu),
      String(r.masterNodes.ramGB),
      // ...
    ]),
  ]
  return rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}
```

Download via the same Blob/URL.createObjectURL pattern used for Markdown in ExportToolbar.vue.

---

## 11. Dependency Versions (from vcf-sizer package.json)

These are the exact versions in the reference project — use same majors for compatibility:

| Package | Version |
|---------|---------|
| vue | ^3.5.31 |
| vite | ^8.0.3 |
| @vitejs/plugin-vue | ^6.0.5 |
| tailwindcss | ^4.2.2 |
| @tailwindcss/vite | ^4.2.2 |
| pinia | ^3.0.4 |
| vue-i18n | ^11.3.0 |
| vue-router | ^5.0.4 |
| pptxgenjs | ^4.0.1 |
| lz-string | ^1.5.0 |
| zod | ^4.3.6 |
| decimal.js | ^10.6.0 |
| chart.js | ^4.5.1 |
| vue-chartjs | ^5.3.3 |
| @vueuse/core | ^14.2.1 |
| vitest | ^4.1.2 |
| @intlify/unplugin-vue-i18n | ^11.0.7 |
| vue-tsc | ^3.2.6 |

**Add for os-sizer:**

| Package | Version | Purpose |
|---------|---------|---------|
| jspdf | ^2.5.x | PDF export |
| jspdf-autotable | ^3.8.x | PDF table generation |

---

## 12. Critical Pitfalls from vcf-sizer

1. **IEEE 754 float errors:** Use `decimal.js` for all arithmetic in the engine. Even `4 * 4 / 4` can return `3.9999...` in edge cases at scale.

2. **Zod nested schema defaults:** `.default({})` on a nested schema object bypasses inner field defaults. Must use factory function: `.default(() => SchemaName.parse({}))`.

3. **Zod array default:** `.default([])` has a known Zod v4 issue with arrays of complex objects. Must use: `.default(() => [createDefaultConfig(0)])`.

4. **`storeToRefs()` double-wrap:** Use `ref<Config[]>([])` not `reactive([])` in stores — reactive arrays don't destructure correctly through `storeToRefs()`.

5. **`$patch()` shallow merge:** Never use `store.$patch({ workloadDomains: [...] })` — Pinia's shallow merge replaces the whole array reference, losing reactivity. Use direct property assignment.

6. **Pinia in tests:** Composables that call `useInputStore()` inside them require `setActivePinia(createPinia())` in `beforeEach` to avoid "no active pinia" errors.

7. **pptxgenjs hex colors:** No `#` prefix. `'003087'` not `'#003087'`. Silent failure if you include `#`.

8. **vue-i18n VueI18nPlugin:** Omit the `include` option from the Vite plugin config — including it causes a rolldown/JSON conflict with Vite 8:

   ```typescript
   // vite.config.ts
   VueI18nPlugin({
     // intentionally NO include: [...] here — rolldown/JSON conflict with Vite 8
   })
   ```

9. **LZString import:** Default import only — `import LZString from 'lz-string'`. Named imports do not exist.

10. **Wizard step in URL:** Wizard step and topology-confirmation flag must NEVER appear in the URL state schema. They are ephemeral UI state. If they end up in the schema, users sharing a URL will land in the wrong wizard step.

---

## 13. OpenShift-Specific Additions vs. vcf-sizer

The main domain difference: os-sizer has 8 topology types instead of vcf-sizer's 3 deployment modes. The architecture is more complex because:

- Master nodes and worker nodes are separately sized (different hardware specs)
- Infra nodes are optional but affect worker node count (infra workloads moved off workers)
- Some topologies (SNO, compact-3node) have no separate master/worker distinction
- Control plane sizing is topology-specific (Red Hat minimum specs vary per topology)
- HCP topology has a management cluster + hosted cluster relationship analogous to vcf-sizer's management/workload domain split

This suggests the calculationStore for os-sizer needs:

- A `masterNodeResult` computed
- A `workerNodeResult` computed
- An `infraNodeResult` computed (nullable)
- Per-cluster results (like vcf-sizer's `domainResults`)
- Aggregate totals

The topology selector becomes the first wizard step gating, equivalent to vcf-sizer's deployment mode + management architecture selection.

---

## File Map: vcf-sizer → os-sizer

| vcf-sizer file | os-sizer equivalent | Action |
|----------------|---------------------|--------|
| `src/engine/types.ts` | `src/engine/types.ts` | Rewrite for OCP types |
| `src/engine/compute.ts` | `src/engine/compute.ts` | Rewrite for OCP formulas |
| `src/engine/storage.ts` | `src/engine/storage.ts` | Rewrite for ODF/NFS |
| `src/engine/validation.ts` | `src/engine/validation.ts` | Rewrite for OCP constraints |
| `src/engine/defaults.ts` | `src/engine/defaults.ts` | Rewrite for OCP defaults |
| `src/engine/management.ts` | _(no direct equivalent)_ | Infra node sizing |
| `src/stores/inputStore.ts` | `src/stores/inputStore.ts` | Adapt structure |
| `src/stores/calculationStore.ts` | `src/stores/calculationStore.ts` | Adapt for OCP results |
| `src/stores/uiStore.ts` | `src/stores/uiStore.ts` | Copy verbatim |
| `src/i18n/index.ts` | `src/i18n/index.ts` | Copy verbatim |
| `src/i18n/locales/en.json` | `src/i18n/locales/en.json` | Rewrite keys for OCP |
| `src/composables/useUrlState.ts` | `src/composables/useUrlState.ts` | Adapt schema |
| `src/composables/usePptxExport.ts` | `src/composables/usePptxExport.ts` | Adapt slides |
| `src/composables/useMarkdownExport.ts` | `src/composables/useMarkdownExport.ts` | Adapt for OCP sections |
| _(absent)_ | `src/composables/usePdfExport.ts` | New — jsPDF + autotable |
| _(absent)_ | `src/composables/useCsvExport.ts` | New — plain TS |
| `src/components/shared/NumberSliderInput.vue` | same | Copy verbatim |
| `src/components/shared/WizardStepper.vue` | same | Adapt step labels/gates |
| `src/components/shared/TopologySelector.vue` | same | Replace with OCP topologies |
| `src/components/shared/WarningBanner.vue` | same | Copy verbatim |
| `src/components/results/ExportToolbar.vue` | same | Add PDF + CSV buttons |
| `src/components/results/DomainResultCard.vue` | `ClusterResultCard.vue` | Adapt for OCP fields |

---

## Sources

- Direct source-code reading of `/Users/fjacquet/Projects/vcf-sizer/` (HIGH confidence)
- `/Users/fjacquet/Projects/vcf-sizer/CLAUDE.md` — architectural constraints (HIGH confidence)
- WebSearch: jsPDF + jspdf-autotable Vue 3 TypeScript (MEDIUM confidence)
- WebSearch: PDF export Vue 3 library comparison 2025 (MEDIUM confidence)
- [jsPDF npm](https://www.npmjs.com/package/jspdf)
- [jspdf-autotable npm](https://www.npmjs.com/package/jspdf-autotable)
- [Comparing open source PDF libraries 2025](https://joyfill.io/blog/comparing-open-source-pdf-libraries-2025-edition)

# Architecture Research: v2.1 Export Milestone

**Project:** os-sizer
**Researched:** 2026-04-04
**Scope:** Multi-cluster state, topology comparison, chart data flow, JSON session serialization
**Confidence:** HIGH — based on direct source-code reading of the production codebase

---

## Baseline: What Already Exists

The current architecture follows a strict three-layer separation:

```
src/engine/        Pure TypeScript. ZERO Vue imports. Formulas + types + validation.
src/stores/        Pinia. inputStore (ref) + calculationStore (computed only) + uiStore.
src/components/    Vue SFCs. Read from stores. Never call engine directly.
src/composables/   Plain TypeScript modules. No Vue lifecycle hooks.
```

**Critical invariants that must be preserved in v2.1:**
- CALC-01: `src/engine/` files must never import Vue, Pinia, or any Vue ecosystem library
- CALC-02: `calculationStore.ts` must contain zero `ref()` — only `computed()`
- Export composables are plain TypeScript, no Vue lifecycle hooks (enables unit testing without DOM)

### Current store graph

```
inputStore (ref)
  clusters: ClusterConfig[]         <- array already supports N clusters
  activeClusterIndex: number
  addCluster() / removeCluster() / updateCluster()

calculationStore (computed only)
  clusterResults: SizingResult[]    <- computed from all clusters, already per-cluster
  recommendations: TopologyRecommendation[]  <- only for active cluster
  activeCluster: ClusterConfig      <- shortcut computed

uiStore (ref)
  currentWizardStep: 1|2|3|4
  locale, isDarkMode, topologyConfirmed
```

Key finding: **multi-cluster state infrastructure is already in place**. `inputStore` already holds an array of `ClusterConfig` with add/remove/update actions. `calculationStore` already computes `clusterResults` as `SizingResult[]` — one per cluster. The wizard and ResultsPage already use `activeClusterIndex` to select the active cluster. v2.1 adds UI on top of existing data model, not a new data model.

---

## Area 1: Multi-Cluster State

**New vs Modified:** Modified — inputStore already supports N clusters. Only UI is new.

**Integration point:** `inputStore.clusters[]` is the source of truth. No new store needed.

**What needs to be added to inputStore:**

```typescript
// OPTIONAL: cluster role tagging for Hub+Spoke
// Add to ClusterConfig in engine/types.ts:
role?: 'hub' | 'spoke' | undefined  // undefined = standalone (default)
```

This is the only type-level change needed. The engine calculators do not distinguish hub from spoke — roles are metadata for display and aggregate BoM only.

**Data flow:**
```
User clicks "Add Cluster"
  -> inputStore.addCluster()
  -> clusters[] gains a new ClusterConfig (createDefaultClusterConfig(index))
  -> calculationStore.clusterResults recomputes reactively (computed, zero ref)
  -> ResultsPage reflects N clusters via clusterResults[]
```

**Aggregate BoM** (sum across all clusters for a multi-site report) is a pure derived value. Implement as a computed in `calculationStore`:

```typescript
// NEW computed in calculationStore
const aggregateTotals = computed(() =>
  clusterResults.value.reduce(
    (acc, r) => ({
      vcpu: acc.vcpu + r.sizing.totals.vcpu,
      ramGB: acc.ramGB + r.sizing.totals.ramGB,
      storageGB: acc.storageGB + r.sizing.totals.storageGB,
    }),
    { vcpu: 0, ramGB: 0, storageGB: 0 }
  )
)
```

**Build order note:** No engine changes required for multi-cluster (engine is already per-ClusterConfig). InputStore already handles arrays. UI is the only deliverable. Build UI cluster tabs/switcher before exports.

---

## Area 2: Side-by-Side Topology Comparison

**New vs Modified:** New concept, implemented via existing multi-cluster data model.

**Design decision:** Topology comparison is NOT a separate mode or store. It is a view over two `ClusterConfig` entries that have the same workload but different `topology` values. The user creates two clusters, copies workload to both, and the UI renders them side by side.

**Integration point:** `calculationStore.clusterResults[]` already provides all the data. The comparison view reads `clusterResults[i]` and `clusterResults[j]` and renders them in a two-column layout.

**Data flow:**
```
User selects "Compare topologies"
  -> uiStore: new comparisonClusterIds: [id_a, id_b] (two selected cluster IDs)
  -> ComparisonView reads clusterResults for those two IDs
  -> Renders side-by-side NodeSpec table (columns = topology, rows = node type)
```

**New uiStore fields needed:**

```typescript
// ADD to uiStore:
const comparisonMode = ref(false)
const comparisonClusterIds = ref<[string, string] | null>(null)
```

Alternatively, comparison state can live in the ComparisonView component itself (local `ref`) since it is purely presentational and does not need to survive navigation or be exported. Local state is simpler and avoids uiStore bloat. Recommended: local component state first; promote to uiStore only if URL sharing of comparison state is needed.

**Workload copy helper:** Add a `copyWorkload(sourceId, targetId)` action to inputStore to make it easy to duplicate workload settings between clusters for a fair topology comparison.

**Build order note:** Build after multi-cluster UI (requires cluster list), before export redesign (comparison view should be exportable).

---

## Area 3: Chart Data Flow for PPTX/PDF Exports

**New vs Modified:** Modified — existing chart components (VcpuChart, RamChart, StorageChart) use vue-chartjs (Chart.js). Export composables currently produce tables only, no charts.

**The core problem:** Chart.js renders to a `<canvas>` element in the DOM. pptxgenjs and jsPDF need base64-encoded PNG data or native chart data structures. The chart data computation logic in Vue components needs to be extractable as pure data, separate from the Chart.js render.

**Integration point:** The computation in VcpuChart/RamChart/StorageChart is currently inline in the component script. It must be extracted into a shared pure function so both the Vue chart component AND the export composable can use it.

**Recommended approach — extract chart data builders:**

```typescript
// NEW: src/composables/useChartData.ts
// Pure TypeScript, no Vue imports (follows existing composable pattern)

export interface ChartDataRow { label: string; value: number }

export function buildVcpuChartData(sizing: ClusterSizing): ChartDataRow[]
export function buildRamChartData(sizing: ClusterSizing): ChartDataRow[]
export function buildStorageChartData(sizing: ClusterSizing): ChartDataRow[]
```

Chart Vue components call these functions and pass results to Chart.js. Export composables call the same functions to build chart data, then either:

1. **Option A (simpler, recommended for PPTX):** Render chart data as a pptxgenjs bar chart using the native `slide.addChart()` API — pptxgenjs has built-in chart support that does not require canvas. Data flows directly from `buildVcpuChartData()` to `addChart()`.

2. **Option B (for PDF):** Render the chart to an off-screen `<canvas>` via Chart.js, call `canvas.toDataURL('image/png')`, and embed the PNG into jsPDF via `doc.addImage()`. This requires brief DOM access during export. Not a Vue lifecycle concern — it can be done inside the async export function.

**Recommended for v2.1:** Option A for PPTX (zero DOM dependency, pptxgenjs native charts), Option B for PDF (canvas-to-PNG, one-time DOM touch during export).

**pptxgenjs chart data format:**
```typescript
slide.addChart(pptx.ChartType.bar, [
  { name: 'vCPU', labels: ['Masters', 'Workers', ...], values: [96, 160, ...] }
], { x: 1, y: 1.5, w: 8, h: 3.5 })
```

**Data flow for PPTX export:**
```
generatePptxReport()
  -> reads inputStore.clusters[i] + calculationStore.clusterResults[i]
  -> calls buildVcpuChartData(sizing) -> ChartDataRow[]
  -> maps ChartDataRow[] to pptxgenjs chart data format
  -> slide.addChart() renders bar chart natively
```

**Build order note:** Extract `useChartData.ts` first (shared dep). Then update Vue chart components to use it. Then update export composables. This sequence avoids duplicate logic and enables testing the data builders in isolation.

---

## Area 4: Session JSON Serialization

**New vs Modified:** New composable (`useSessionExport.ts`), no store changes required.

**Integration point:** `inputStore` already holds the complete session state (`clusters[]` + `activeClusterIndex`). URL state (`useUrlState.ts`) already has the Zod schema (`InputStateSchema`) that validates this shape. Session JSON reuses these same schemas.

**Export (serialize):**

```typescript
// src/composables/useSessionExport.ts

export function exportSession(): void {
  const input = useInputStore()
  const state: InputState = {
    clusters: input.clusters.map(({ id: _id, ...rest }) => rest),
    // id excluded — same as URL state pattern
  }
  const json = JSON.stringify(state, null, 2)
  downloadBlob(json, `os-sizer-session-${date}.json`, 'application/json')
}
```

The `downloadBlob` helper is currently duplicated in `useCsvExport.ts`. Extract it to `src/composables/utils/download.ts` and share across CSV, session JSON, and any future binary exports.

**Import (hydrate from JSON):**

```typescript
export async function importSession(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = await file.text()
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return { ok: false, error: 'invalid JSON' } }
  const result = InputStateSchema.safeParse(parsed)
  if (!result.success) return { ok: false, error: 'schema validation failed' }
  const store = useInputStore()
  store.clusters = result.data.clusters.map(c => ({ ...c, id: crypto.randomUUID() }))
  store.activeClusterIndex = 0
  return { ok: true }
}
```

This is structurally identical to `hydrateFromUrl()` in `useUrlState.ts` — same Zod schema, same ID re-generation, same store mutation pattern. The only difference is the input source (File API vs URL query param).

**Interaction with URL state:** Session JSON and URL state coexist without conflict. URL state encodes `InputState` (compressed). Session JSON serializes the same `InputState` (uncompressed, human-readable). After import, `generateShareUrl()` will produce a valid URL from the newly-hydrated store. No ordering concern.

**uiStore is intentionally excluded** from session JSON. Locale and dark mode are per-browser preferences, not per-session design decisions. The wizard step should reset to step 1 on import (same as URL hydration behavior).

**Build order note:** Implement `useSessionExport.ts` after extracting `downloadBlob` to shared utils. Add import/export buttons to ExportToolbar. No store changes needed — this is purely a composable.

---

## Area 5: ExportToolbar and ResultsPage Updates

**New vs Modified:** Modified — ExportToolbar gains new buttons; ResultsPage gains cluster tab navigation.

**ExportToolbar additions:**
- "Export JSON" button -> calls `exportSession()`
- "Import JSON" button -> triggers `<input type="file" accept=".json">` click, calls `importSession(file)`
- (Existing: Share URL, CSV, PDF, PPTX)

**ResultsPage cluster navigation:**
- Add cluster tab bar above results (shows cluster names, activeClusterIndex highlighted)
- Add "Add Cluster" button
- Tab click -> `inputStore.activeClusterIndex = idx` -> all computed results update reactively

**No new store fields needed for ResultsPage cluster switching** — `activeClusterIndex` in inputStore already drives `activeResult` and `activeCluster` computeds in ResultsPage.

**Build order note:** ResultsPage cluster tabs depend on multi-cluster UI work. ExportToolbar JSON buttons depend on `useSessionExport.ts`. Both are independent of chart redesign.

---

## Area 6: Aggregate BoM Export

**New vs Modified:** New functionality in existing export composables.

**Integration point:** `calculationStore.aggregateTotals` (new computed) + `calculationStore.clusterResults[]`.

**Export behavior:**
- Single-cluster session: exports only that cluster (current behavior, unchanged)
- Multi-cluster session: export includes one section per cluster + a "Totals" aggregation row/slide

**PPTX multi-cluster:** Add one BoM slide per cluster, plus a final "Aggregate Summary" slide showing totals across all clusters.

**PDF multi-cluster:** Add one autoTable section per cluster with cluster name as section header, plus a totals row at the end.

**CSV multi-cluster:** Emit one CSV with cluster names as grouping rows, rather than zip files — avoids zip dependency complexity.

**Build order note:** Aggregate BoM export is the last export feature to build — it requires multi-cluster UI (so user can create N clusters to test), useChartData extraction, and redesigned export templates. Build after all individual-cluster export redesigns are complete.

---

## Data Flow Summary

```
User Input (wizard)
        |
        v
inputStore.clusters[]       <- ref(), source of truth, N ClusterConfigs
        |
        v (computed, reactive)
calculationStore
  .clusterResults[]          <- SizingResult[] per cluster
  .recommendations[]         <- for active cluster
  .aggregateTotals            <- NEW: sum across all clusters
        |
        +---> ResultsPage
        |       activeResult = clusterResults[activeClusterIndex]
        |       cluster tabs -> set activeClusterIndex
        |
        +---> Charts (Vue components)
        |       VcpuChart/RamChart/StorageChart
        |       call buildXxxChartData(sizing) <- NEW shared util
        |
        +---> Export Composables (plain TS, no lifecycle)
                usePptxExport   <- reads inputStore + calculationStore directly
                usePdfExport    <- same
                useCsvExport    <- same
                useSessionExport <- NEW: serialize/hydrate full inputStore state
                useChartData    <- NEW: pure chart data builders (no Vue)
```

---

## Component Boundary Map

| Component / Module | New vs Modified | Depends On | Used By |
|---|---|---|---|
| `src/engine/types.ts` | Modified — add optional `role` field to ClusterConfig | nothing | everything |
| `src/stores/inputStore.ts` | Modified — add `copyWorkload()` action | engine/types | all stores, composables |
| `src/stores/calculationStore.ts` | Modified — add `aggregateTotals` computed | inputStore | exports, ResultsPage |
| `src/stores/uiStore.ts` | Modified — add `comparisonMode`, `comparisonClusterIds` | nothing | ComparisonView |
| `src/composables/useChartData.ts` | NEW — pure chart data builders | engine/types | chart Vue components, export composables |
| `src/composables/useSessionExport.ts` | NEW — JSON export/import | inputStore, useUrlState schemas | ExportToolbar |
| `src/composables/utils/download.ts` | NEW — shared downloadBlob | nothing | useCsvExport, useSessionExport |
| `src/composables/usePptxExport.ts` | Modified — redesign + charts + multi-cluster | inputStore, calculationStore, useChartData | ExportToolbar |
| `src/composables/usePdfExport.ts` | Modified — redesign + charts + multi-cluster | inputStore, calculationStore, useChartData | ExportToolbar |
| `src/composables/useCsvExport.ts` | Modified — multi-cluster aggregate | inputStore, calculationStore | ExportToolbar |
| `src/components/results/ChartsSection.vue` | Modified — use useChartData | useChartData, calculationStore | ResultsPage |
| `src/components/results/charts/VcpuChart.vue` | Modified — delegate data to useChartData | useChartData | ChartsSection |
| `src/components/results/charts/RamChart.vue` | Modified — same | useChartData | ChartsSection |
| `src/components/results/charts/StorageChart.vue` | Modified — same | useChartData | ChartsSection |
| `src/components/results/ResultsPage.vue` | Modified — cluster tab bar | inputStore, calculationStore | App.vue |
| `src/components/results/ExportToolbar.vue` | Modified — JSON import/export buttons | useSessionExport | ResultsPage |
| `src/components/results/ComparisonView.vue` | NEW — side-by-side topology table | calculationStore, uiStore | ResultsPage |

---

## Build Order

Dependencies flow top to bottom. Each phase can start once its dependencies complete.

**Phase A — Foundation (no deps, start here)**
1. Extract `src/composables/utils/download.ts` (shared downloadBlob)
2. Add `useChartData.ts` pure data builders (ClusterSizing -> ChartDataRow[])
3. Add optional `role` field to `ClusterConfig` in engine/types.ts + InputStateSchema in useUrlState.ts

**Phase B — Store extensions (depends on A.3)**
4. Add `aggregateTotals` computed to calculationStore
5. Add `copyWorkload()` action to inputStore
6. Add `comparisonMode` / `comparisonClusterIds` to uiStore

**Phase C — Core composables (depends on A.1, A.2, B.4)**
7. Update Vue chart components to delegate to useChartData (low-risk refactor)
8. Implement `useSessionExport.ts` (depends on A.1, existing InputStateSchema)
9. Redesign `usePptxExport.ts` — 1-slide layout, pptxgenjs native charts (depends on A.2, B.4)
10. Redesign `usePdfExport.ts` — canvas-to-PNG charts (depends on A.2, B.4)
11. Update `useCsvExport.ts` — multi-cluster aggregate sections (depends on B.4)

**Phase D — UI (depends on B, C)**
12. ResultsPage cluster tab bar + "Add Cluster" button (depends on B.5)
13. ExportToolbar — JSON import/export buttons (depends on C.8)
14. ComparisonView component (depends on B.6, D.12)

**Phase E — Integration (depends on D)**
15. Wire aggregate BoM into all three export composables (depends on D.12 so user can create N clusters to test)
16. WARN-02 fix (independent, can slot in anywhere — no architectural dep)

---

## Circular Dependency Risks

**No circular risks in the proposed design:**
- `useChartData.ts` imports only `engine/types.ts` (no store, no Vue)
- `useSessionExport.ts` imports only `inputStore` and `useUrlState` schemas (same pattern as useCsvExport)
- `download.ts` has zero imports beyond browser APIs
- Export composables import stores directly (same as current pattern) — stores do not import composables

**Watch for:** If `useChartData.ts` is ever tempted to import `calculationStore` to fetch data reactively, resist — keep it as a pure function that receives `ClusterSizing` as a parameter. The callers (Vue components and export composables) handle the store access themselves.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate multiClusterStore
**Why wrong:** `inputStore` already holds `clusters[]`. Adding a second store that holds cluster arrays creates a split source of truth and synchronization bugs. The existing store already has addCluster/removeCluster/updateCluster. This would be adding a new store for no reason.

### Anti-Pattern 2: Chart data fetched from DOM for PPTX
**Why wrong:** PPTX export runs outside any Vue component lifecycle. Trying to grab `<canvas>` elements from the DOM inside `generatePptxReport()` is brittle and fails in test environments. pptxgenjs has a native chart API that accepts data directly — use it.

### Anti-Pattern 3: Import uiStore locale into session JSON
**Why wrong:** Locale is a browser preference, not a design decision. Importing a session from a French colleague should not change an English user's locale. Keep session JSON scoped to inputStore only.

### Anti-Pattern 4: ref() in calculationStore for aggregateTotals
**Why wrong:** CALC-02 forbids `ref()` in calculationStore. `aggregateTotals` is a derived value — it must be `computed()` from clusterResults, not stored.

### Anti-Pattern 5: Duplicating downloadBlob across composables
**Why wrong:** useCsvExport already has a private `downloadBlob`. Session JSON export needs the same function. Extract once to `utils/download.ts` rather than copying.

### Anti-Pattern 6: Comparison view as a separate wizard step
**Why wrong:** Comparison is a view of results data, not a configuration step. Adding a step 5 would break the wizard flow contract (1|2|3|4 type in uiStore) and confuse users about what "step 5" configures. Keep it as an alternative view within the Results page (step 4).

---

## Sources

- Direct code reading: `src/stores/inputStore.ts`, `src/stores/calculationStore.ts`, `src/stores/uiStore.ts`
- Direct code reading: `src/composables/useUrlState.ts`, `usePptxExport.ts`, `usePdfExport.ts`, `useCsvExport.ts`
- Direct code reading: `src/engine/types.ts`, `src/engine/defaults.ts`
- Direct code reading: `src/components/results/ResultsPage.vue`, `ExportToolbar.vue`, `ChartsSection.vue`, `charts/VcpuChart.vue`
- Direct code reading: `src/App.vue`
- Project context: `.planning/PROJECT.md`
- Existing research: `.planning/research/app-architecture.md`

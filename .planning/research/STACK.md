# Stack Research — v2.1 Export Milestone

**Project:** os-sizer
**Researched:** 2026-04-04
**Scope:** PPTX charts, PDF charts, JSON session export/import, multi-cluster state management

---

## Existing Stack (Do Not Re-research)

| Technology | Installed Version | Status |
|------------|-------------------|--------|
| Vue 3 | 3.5.31 | Validated v1.0 |
| TypeScript | via vue-tsc 3.2.6 | Validated v1.0 |
| Vite | 8.0.3 | Validated v1.0 |
| Tailwind v4 | 4.2.2 | Validated v1.0 |
| Pinia | 3.0.4 | Validated v1.0 |
| vue-i18n | 11.3.0 | Validated v1.0 |
| pptxgenjs | 4.0.1 | Validated v1.0 |
| jsPDF | 4.2.1 | Validated v1.0 |
| jspdf-autotable | 5.0.7 | Validated v1.0 |
| lz-string | 1.5.0 | Validated v1.0 |
| Zod | 4.3.6 | Validated v1.0 |
| chart.js | 4.5.1 | Already in dependencies |
| vue-chartjs | 5.3.3 | Already in dependencies |

---

## Feature 1: PPTX Charts

### pptxgenjs Native Chart API
**Version:** 4.0.1 (already installed)
**Purpose:** Render bar/pie/doughnut charts as native PowerPoint chart objects (not raster images)
**Integration:** Dynamic import block in `usePptxExport.ts` — same async pattern as existing table generation
**Why:** pptxgenjs 4.x has a built-in `slide.addChart()` API that produces vector PowerPoint chart objects — editable by recipients, resolution-independent, and indistinguishable from natively authored charts. No additional library required.

**Available Chart Types (confirmed from `node_modules/pptxgenjs/types/index.d.ts`):**
```
'area' | 'bar' | 'bar3D' | 'bubble' | 'doughnut' | 'line' | 'pie' | 'radar' | 'scatter'
```

**API Signature:**
```typescript
slide.addChart(
  type: CHART_NAME | IChartMulti[],
  data: OptsChartData[],
  options?: IChartOpts
): Slide
```

**Data Shape (`OptsChartData`):**
```typescript
interface OptsChartData {
  name: string       // series label
  labels: string[]   // X-axis categories
  values: number[]   // Y-axis values
}
```

**Recommended charts for sizing report:**
- `'bar'` — vCPU/RAM/Storage totals by node type (stacked horizontal bar)
- `'doughnut'` or `'pie'` — resource distribution by cluster role
- Position alongside the BoM table on the consolidated 1-slide layout

**No New Packages Required.** HIGH confidence — verified against installed type definitions.

---

## Feature 2: PDF Charts

### Strategy: Chart.js Offscreen Canvas to PNG via jsPDF.addImage()

**Why this strategy:** jsPDF's `addImage()` accepts `HTMLCanvasElement` directly (confirmed from
`node_modules/jspdf/types/index.d.ts` overload: `addImage(imageData: string | HTMLImageElement | HTMLCanvasElement | Uint8Array, ...)`).
Chart.js renders to a standard HTML canvas. The pipeline is: create an offscreen `<canvas>` element
via `document.createElement('canvas')` (no DOM attachment needed) — render Chart.js chart onto it
— pass the canvas element to `doc.addImage()`.

**Libraries used:**
- chart.js 4.5.1 (already installed)
- jsPDF 4.2.1 (already installed)

**Integration point:** `usePdfExport.ts` — create charts after `autoTable()`, embed as images before `doc.save()`

**Pattern (no new packages):**
```typescript
import { Chart, BarController, CategoryScale, LinearScale, BarElement } from 'chart.js'

Chart.register(BarController, CategoryScale, LinearScale, BarElement)

const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 300
const ctx = canvas.getContext('2d')!
const chart = new Chart(ctx, {
  type: 'bar',
  data: { labels: [...], datasets: [{ data: [...] }] },
  options: { animation: { duration: 0 } }  // REQUIRED: disable animation for sync render
})
doc.addImage(canvas, 'PNG', x, y, width, height)
chart.destroy()
```

**Critical:** Set `animation: { duration: 0 }` — Chart.js uses `requestAnimationFrame` by default.
Without it, `addImage()` captures the canvas before the first paint and produces a blank image.

**Alternative considered — html2canvas:** html2canvas 1.4.1 is already in node_modules (transitive jsPDF dependency). Rejected: requires a mounted DOM element, which breaks the headless composable pattern used throughout the codebase.

**Alternative considered — pdfmake:** Separate PDF library with its own chart module. Rejected: doubles PDF bundle weight, conflicts with existing jsPDF usage.

**No New Packages Required.** HIGH confidence — confirmed from installed type definitions.

---

## Feature 3: JSON Session Export / Import

### File Download (Export)
**Technology:** Browser-native `URL.createObjectURL()` + `<a download>` pattern
**Version:** N/A — Web API, no package needed
**Purpose:** Trigger a JSON file download from a JavaScript object
**Integration:** New composable `useSessionExport.ts` — mirrors pattern of `useCsvExport.ts`
**Why:** Standard browser pattern for file downloads without a server. Zero dependencies.

**Pattern:**
```typescript
function exportSession(state: SessionSnapshot): void {
  const json = JSON.stringify(state, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `os-sizer-session-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

### File Upload (Import)
**Technology:** `<input type="file" accept=".json">` + `File.text()` Web API
**Version:** N/A — Web API, no package needed
**Purpose:** Load a session JSON file from disk into Pinia stores
**Integration:** Hidden `<input>` element triggered by a button, handled via `@change` event. Zod validates before store patch.

**Pattern:**
```typescript
async function importSession(file: File): Promise<void> {
  const text = await file.text()
  const raw = JSON.parse(text)
  const validated = SessionSnapshotSchema.parse(raw)  // throws on invalid shape
  inputStore.$patch({ clusters: validated.clusters, activeClusterIndex: validated.activeClusterIndex })
}
```

### Session Snapshot Schema
**Technology:** Zod 4.3.6 (already installed)
**Purpose:** Define and validate the serialized session shape
**Integration:** New file `src/engine/session-schema.ts` — exports `SessionSnapshotSchema` and `SessionSnapshot` type
**Why:** Prevents corrupt or malformed files from silently poisoning store state. Zod is already the validation library of choice (used for URL state).

**Recommended schema:**
```typescript
const SessionSnapshotSchema = z.object({
  version: z.enum(['2.0', '2.1']),   // accept both versions; migrate 2.0 to 2.1 before patch
  exportedAt: z.string().datetime(),
  clusters: z.array(ClusterConfigSchema),
  activeClusterIndex: z.number().int().min(0),
})
```

**Backward compatibility note:** v2.0 exported sessions must be accepted. Use `.optional().default(...)` for any new v2.1 fields added to `ClusterConfig`.

**No New Packages Required.** HIGH confidence — confirmed from Zod already in use and browser APIs.

---

## Feature 4: Multi-Cluster State Management

### Pinia — Extend Existing inputStore (Architecture Already Present)
**Version:** 3.0.4 (already installed)
**Purpose:** Manage array of `ClusterConfig` objects for Hub+Spoke and side-by-side comparison
**Integration:** Extend `src/stores/inputStore.ts` and `src/stores/calculationStore.ts`
**Why:** The `inputStore` already contains `clusters: ref<ClusterConfig[]>` with `addCluster()`, `removeCluster()`, and `updateCluster()` methods. The `calculationStore` already maps all clusters to `clusterResults: computed<SizingResult[]>`. Multi-cluster sizing is an architectural feature that is already present at the state layer — v2.1 adds UI surface and aggregate calculations.

**Current state (confirmed from source inspection):**
- `inputStore.clusters` — reactive array, already supports N clusters
- `inputStore.activeClusterIndex` — tracks focused cluster
- `inputStore.addCluster()` / `removeCluster()` / `updateCluster()` — all present
- `calculationStore.clusterResults` — already computes sizing for every cluster in the array

**What v2.1 adds to `ClusterConfig` (engine types):**
```typescript
clusterRole?: 'hub' | 'spoke' | 'standalone'  // optional — for Hub+Spoke labeling
```

**What v2.1 adds to `calculationStore`:**
```typescript
const aggregateTotals = computed(() =>
  clusterResults.value.reduce(
    (acc, r) => ({
      vcpu: acc.vcpu + r.sizing.totals.vcpu,
      ramGB: acc.ramGB + r.sizing.totals.ramGB,
      storageGB: acc.storageGB + r.sizing.totals.storageGB,
    }),
    { vcpu: 0, ramGB: 0, storageGB: 0 },
  ),
)
```

**What v2.1 adds to `inputStore`:**
```typescript
const compareMode = ref(false)  // toggles side-by-side comparison view
```

**Pattern discipline (existing codebase rule):** ZERO `ref()` in `calculationStore`, only `computed()`. All aggregate calculations derived reactively from `clusterResults`. State mutation only in `inputStore`. Follow `CALC-02` rule already in codebase comments.

**No New Packages Required.** HIGH confidence — confirmed from source code inspection.

---

## Summary: New Packages Required

**None.** All four v2.1 features are achievable with the existing dependency set:

| Feature | Approach | Libraries Used |
|---------|----------|---------------|
| PPTX charts | `slide.addChart()` native API | pptxgenjs 4.0.1 (installed) |
| PDF charts | Chart.js offscreen canvas + `doc.addImage()` | chart.js 4.5.1 + jsPDF 4.2.1 (installed) |
| JSON export | `URL.createObjectURL()` + Blob | Browser API (no package) |
| JSON import | `File.text()` + Zod validation | Zod 4.3.6 (installed) |
| Multi-cluster state | Extend existing Pinia stores | Pinia 3.0.4 (installed) |

---

## What NOT to Add

| Package | Why Not |
|---------|---------|
| `canvas` npm package | Node.js server-side canvas polyfill — not needed in browser |
| `html2canvas` (new explicit usage) | Already a transitive dependency, but requires mounted DOM — breaks headless export pattern |
| `pdfmake` | Duplicate PDF capability, ~200 KB bundle weight, conflicts with existing jsPDF |
| `chartjs-node-canvas` | Node.js server-side only — not applicable in Vite browser build |
| `FileSaver.js` | `URL.createObjectURL()` achieves the same with zero dependencies |
| `chart.js` upgrade | 4.5.1 already installed — no need to upgrade for this milestone |

---

## Integration Risks

### Chart.js Animation in Offscreen Canvas (MEDIUM risk)
**Issue:** If `animation: { duration: 0 }` is omitted, `addImage()` may capture a blank canvas during the animation frame. Chart.js uses `requestAnimationFrame` which does not fire synchronously.
**Mitigation:** Enforce `animation: { duration: 0 }` as a constant in the export helper, not the caller's responsibility. Add a test that verifies canvas `width > 0` and that `toDataURL()` does not return the blank canvas data URL.

### pptxgenjs `addChart` data format mismatch (LOW risk)
**Issue:** `OptsChartData` requires `labels` and `values` as parallel arrays of equal length. Mismatches produce silent empty charts (no error is thrown by pptxgenjs).
**Mitigation:** Build chart data via pure helper functions (same pattern as existing `buildBomTableRows`). Test these functions independently from pptxgenjs.

### Zod v4 breaking changes (LOW risk)
**Issue:** Zod v4 (installed: 4.3.6) introduced breaking changes from v3. Existing code uses `import { z } from 'zod'` which works in v4. New schemas must use v4 syntax — notably `z.object()` and `.parse()` are unchanged, but some error types differ.
**Mitigation:** None required. Standard schema operations are stable across v3/v4.

### JSON import version mismatch (MEDIUM risk)
**Issue:** A session exported from v2.0 will not have v2.1-only fields (e.g., `clusterRole`). Direct `z.parse()` without `.optional()` defaults will throw.
**Mitigation:** Use `.optional().default('standalone')` for all new `ClusterConfig` fields. Add a migration transform function that upgrades v2.0 payloads before store patch. Version gate via `z.enum(['2.0', '2.1'])`.

---

## Sources

- pptxgenjs type definitions: `node_modules/pptxgenjs/types/index.d.ts` (v4.0.1, locally installed) — HIGH confidence
- jsPDF type definitions: `node_modules/jspdf/types/index.d.ts` (v4.2.1, locally installed) — HIGH confidence
- chart.js package.json: `node_modules/chart.js/package.json` (v4.5.1, locally installed) — HIGH confidence
- Pinia stores: `src/stores/inputStore.ts`, `src/stores/calculationStore.ts` (current source) — HIGH confidence
- Engine types: `src/engine/types.ts` (current source) — HIGH confidence
- Browser File API (`File.text()`, `URL.createObjectURL()`): MDN Web Docs standard — HIGH confidence, available all modern browsers

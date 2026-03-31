---
phase: 04-results-exports
plan: 04-04
status: complete
---

# 04-04 SUMMARY — PPTX Export (usePptxExport)

## What Was Done

### Task 1: usePptxExport composable

Created `src/composables/usePptxExport.ts` with:

- **`buildArchSummaryData(cluster, totals)`** — pure function returning 6 `{label, value}` rows: Topology, Environment, HA Required, Total vCPU, Total RAM (GB), Total Storage (GB)
- **`buildBomTableRows(sizing)`** — pure function returning header row + one row per non-null NodeSpec (masterNodes always present; workerNodes, infraNodes, odfNodes, rhacmWorkers included only when non-null)
- **`generatePptxReport()`** — async function using dynamic import (`const { default: PptxGenJS } = await import('pptxgenjs')`) to keep pptxgenjs out of main bundle; reads from `useInputStore` and `useCalculationStore`; builds 2-slide PPTX and triggers browser download
- Red Hat brand palette: `RH_RED = 'EE0000'`, `RH_DARK = '151515'`, `HEADER_BG = 'E8E8E8'` (bare hex, no # prefix as required by pptxgenjs)
- Local `TableCell`/`TableRow` interfaces to avoid pptxgenjs type imports at module level

### Task 2: ExportToolbar.vue wired

Updated `src/components/results/ExportToolbar.vue`:
- Added import: `import { generatePptxReport } from '@/composables/usePptxExport'`
- Replaced stub `handleExportPptx` with real async implementation using `pptxLoading` ref for loading state
- `handleExportCsv` and `handleExportPdf` stubs left unchanged for plan 04-05

### Pre-existing build fixes

- `src/stores/calculationStore.ts`: Fixed `sizing: calcCluster(cluster)` → `sizing: calcCluster(cluster).sizing` (calcCluster returns `{ sizing, warnings }` not `ClusterSizing` directly)
- `src/components/wizard/Step2WorkloadForm.vue`: Fixed `v-model="rhacmManagedClusters as number"` (invalid TS cast in v-model expression) → split into `:model-value` + `@update:model-value` binding

### Tests

Created `src/composables/__tests__/usePptxExport.test.ts` with 12 tests covering:
- `buildArchSummaryData`: 6 rows returned, correct labels/values, HA Yes/No, stringified totals
- `buildBomTableRows`: header with bold+fill, 2 rows for masters-only, 6 rows for all NodeSpecs non-null, null entries skipped

## Verification Results

| Check | Result |
|-------|--------|
| `npm run type-check` | PASS (clean) |
| `npm run test` | PASS — 107 tests, 10 test files |
| `npm run build` | PASS — clean bundle |
| pptxgenjs in main chunk | NO — separate lazy chunk: `pptxgen.es-*.js` (368 kB) |
| pptxgenjs dynamic import | YES — confirmed by build output |

## Build Output (key chunks)

```
dist/assets/pptxgen.es-BceBkPPn.js   368.44 kB │ gzip: 123.23 kB  ← lazy chunk
dist/assets/index-D9Ku1oBF.js        487.25 kB │ gzip: 166.11 kB  ← main bundle
```

pptxgenjs is correctly excluded from the main bundle and loaded only on demand.

## Files Modified

- `src/composables/usePptxExport.ts` (created)
- `src/composables/__tests__/usePptxExport.test.ts` (created)
- `src/components/results/ExportToolbar.vue` (PPTX stub replaced with real call)
- `src/stores/calculationStore.ts` (pre-existing type fix: `.sizing` extraction)
- `src/components/wizard/Step2WorkloadForm.vue` (pre-existing build fix: v-model cast)

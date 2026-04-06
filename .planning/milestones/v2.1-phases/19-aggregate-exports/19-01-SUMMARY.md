---
phase: 19-aggregate-exports
plan: 01
subsystem: export
tags: [pptxgenjs, jspdf, jspdf-autotable, multi-cluster, aggregate, tdd]

# Dependency graph
requires:
  - phase: 16-pptx-redesign
    provides: generatePptxReport single-cluster baseline, buildBomTableRows, buildNodeCountChartData, buildVcpuStackedChartData
  - phase: 17-pdf-redesign
    provides: generatePdfReport single-cluster baseline, buildPdfTableData, buildChartImageDataUrl, buildKpiStripData
  - phase: 13-multi-cluster-foundation
    provides: calculationStore.aggregateTotals, clusterResults[], inputStore.clusters[]
  - phase: 18-multi-cluster-ui
    provides: multiple clusters configured in inputStore
provides:
  - buildAggregateSlideData pure function (PPTX aggregate table data)
  - buildAggregateRow pure function (PDF aggregate totals row)
  - Multi-cluster PPTX export: N per-cluster slides + 1 aggregate summary slide
  - Multi-cluster PDF export: per-cluster sections (red header + chart + KPI + BoM + warnings) + aggregate totals
  - ExportToolbar multi-cluster PDF dispatch with per-cluster warnings
affects: [19-02-csv-aggregate-exports, future export phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - addClusterSlide() private helper extracts per-cluster PPTX slide rendering for clean multi-cluster loop
    - clusters.length >= 2 guard pattern for multi-cluster vs single-cluster branching (D-01)
    - makeNodeChartOpts() factory called fresh per cluster iteration to avoid pptxgenjs mutation pitfall
    - allResolvedWarnings 2D array (indexed by cluster) passes per-cluster warnings to PDF generator
    - buildAggregateSlideData and buildAggregateRow as pure exported functions — tested without pptxgenjs/jsPDF

key-files:
  created: []
  modified:
    - src/composables/usePptxExport.ts
    - src/composables/__tests__/usePptxExport.test.ts
    - src/composables/usePdfExport.ts
    - src/composables/__tests__/usePdfExport.test.ts
    - src/components/results/ExportToolbar.vue

key-decisions:
  - "Single-cluster export (clusters.length === 1) produces identical output to Phase 16/17 baseline — multi-cluster gated on >= 2 (D-01)"
  - "PPTX: N per-cluster slides via addClusterSlide() private helper + 1 aggregate summary slide; filename os-sizer-all-clusters-YYYY-MM-DD.pptx"
  - "PDF: per-cluster sections each with red header (doc.setFillColor 238,0,0), chart image, KPI strip, BoM table, then aggregate totals table; filename os-sizer-all-clusters-YYYY-MM-DD.pdf"
  - "generatePdfReport extended with allResolvedWarnings second param (2D array indexed by cluster) for backward-compat single-cluster path"
  - "ExportToolbar dispatches multi-cluster vs single-cluster in handleExportPdf based on clusters.length >= 2"

patterns-established:
  - "Pure helper pattern: buildAggregateSlideData and buildAggregateRow are exported pure functions tested without heavy deps"
  - "Multi-cluster guard: clusters.length >= 2 in composable, same guard in toolbar"
  - "Factory function per iteration: makeNodeChartOpts() created fresh in each addClusterSlide() call"

requirements-completed: [CLUSTER-04]

# Metrics
duration: 6min
completed: 2026-04-06
---

# Phase 19 Plan 01: Aggregate Exports (PPTX + PDF) Summary

**Multi-cluster PPTX and PDF exports with per-cluster slides/sections and aggregate summary using pptxgenjs and jsPDF, behind a clusters.length >= 2 guard preserving Phase 16/17 single-cluster baselines**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-06T07:54:50Z
- **Completed:** 2026-04-06T08:00:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- PPTX export for 2+ clusters now generates N per-cluster slides followed by 1 "Aggregate Summary" slide with side-by-side table (Metric / cluster names / TOTAL columns, 3 rows)
- PDF export for 2+ clusters renders per-cluster sections (red header + chart image + KPI strip + BoM table + per-cluster warnings) then an aggregate totals table sourced from calculationStore.aggregateTotals
- ExportToolbar.vue updated to build per-cluster warnings array and dispatch multi-cluster vs single-cluster PDF path
- 9 new pure-function tests added (5 for buildAggregateSlideData, 4 for buildAggregateRow); all 340 tests pass

## Task Commits

Each task was committed atomically with TDD pattern (RED then GREEN):

1. **Task 1 RED: buildAggregateSlideData failing tests** - `6904135` (test)
2. **Task 1 GREEN: buildAggregateSlideData + multi-cluster PPTX** - `3e7511f` (feat)
3. **Task 2 RED: buildAggregateRow failing tests** - `7f44710` (test)
4. **Task 2 GREEN: buildAggregateRow + multi-cluster PDF + ExportToolbar** - `607847b` (feat)

_Note: TDD tasks have two commits each (test → feat)_

## Files Created/Modified

- `src/composables/usePptxExport.ts` — Added AggregateSlideData interface, buildAggregateSlideData pure function, addClusterSlide private helper; generatePptxReport branches on clusters.length >= 2
- `src/composables/__tests__/usePptxExport.test.ts` — Added describe('buildAggregateSlideData') with 5 test cases
- `src/composables/usePdfExport.ts` — Added buildAggregateRow pure function; generatePdfReport extended with allResolvedWarnings param and multi-cluster branch
- `src/composables/__tests__/usePdfExport.test.ts` — Added describe('buildAggregateRow') with 4 test cases
- `src/components/results/ExportToolbar.vue` — handleExportPdf updated with clusters.length >= 2 guard and allResolvedWarnings construction

## Decisions Made

- Single-cluster export unchanged (D-01): clusters.length === 1 → identical output to Phase 16/17 baselines
- PPTX aggregate slide filename uses hardcoded `all-clusters` token (not user input) per T-19-03 threat mitigation
- addClusterSlide() private helper extracts the per-cluster slide layout to avoid code duplication between multi-cluster loop and single-cluster path was rejected — single-cluster path kept verbatim in else branch for strict D-01 compliance
- generatePdfReport allResolvedWarnings defaults to [] for backward compatibility with existing callers

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all aggregate data wired to live calculationStore.aggregateTotals and clusterResults[].

## Threat Flags

None — T-19-03 mitigated: multi-cluster PPTX/PDF filenames use hardcoded `all-clusters` token, not user-supplied cluster names.

## Issues Encountered

None — both TDD cycles passed cleanly (RED on first run, GREEN on first implementation attempt).

## Next Phase Readiness

- PPTX and PDF multi-cluster exports complete and tested (CLUSTER-04 satisfied for these two formats)
- CSV multi-cluster export (Plan 19-02) can now proceed independently
- aggregateTotals wired to both composables; pattern established for CSV to follow

## Self-Check: PASSED

- 19-01-SUMMARY.md: FOUND
- Commit 6904135 (test: RED buildAggregateSlideData): FOUND
- Commit 3e7511f (feat: GREEN PPTX multi-cluster): FOUND
- Commit 7f44710 (test: RED buildAggregateRow): FOUND
- Commit 607847b (feat: GREEN PDF multi-cluster + ExportToolbar): FOUND

---
*Phase: 19-aggregate-exports*
*Completed: 2026-04-06*

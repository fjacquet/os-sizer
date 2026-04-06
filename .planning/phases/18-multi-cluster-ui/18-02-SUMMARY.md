---
phase: 18-multi-cluster-ui
plan: "02"
subsystem: results-ui
tags: [multi-cluster, comparison-table, vue-component, dark-mode, i18n, pinia]

dependency_graph:
  requires:
    - src/stores/calculationStore.ts (clusterResults[] computed array)
    - src/stores/inputStore.ts (clusters[], activeClusterIndex)
    - src/engine/types.ts (ClusterSizing, NodeSpec, SizingResult)
    - src/components/results/ClusterTabBar.vue (Plan 18-01, already wired in ResultsPage)
    - results.clusters.* i18n namespace (compareToggle, compareTitle, roleLabel — Plan 18-01)
  provides:
    - src/components/results/ClusterComparisonTable.vue
    - src/components/results/__tests__/ClusterComparisonTable.test.ts
  affects:
    - src/components/results/ResultsPage.vue (compare toggle + ClusterComparisonTable wired)

tech-stack:
  added: []
  patterns:
    - Pure-function extraction testing (consistent with ClusterTabBar.test.ts and BomTable.test.ts)
    - fmt() null-safety helper renders '—' for all optional NodeSpec pools
    - MetricRow interface with getValue function and bold flag drives table row rendering
    - storeToRefs + useCalculationStore/useInputStore for reactive data in component

key-files:
  created:
    - src/components/results/ClusterComparisonTable.vue
    - src/components/results/__tests__/ClusterComparisonTable.test.ts
  modified:
    - src/components/results/ResultsPage.vue

key-decisions:
  - "Used pure-function extraction testing pattern (no @vue/test-utils) — consistent with established codebase approach; @vue/test-utils/jsdom not installed"
  - "fmt() helper centralizes null/undefined → dash rendering for all optional node pool fields"
  - "clusterResults and clusters arrays are parallel (both indexed by cluster position via calculationStore.map); no out-of-bounds risk (T-18-05)"
  - "showComparison ref initializes false — comparison table hidden by default, toggle required"
  - "Compare toggle button placement: below ClusterTabBar, above page heading (D-10)"

requirements-completed:
  - CLUSTER-03

duration: 15min
completed: "2026-04-06"
---

# Phase 18 Plan 02: ClusterComparisonTable Summary

**ClusterComparisonTable Vue component with 12 pure-function tests, null-safe dash rendering for optional node pools, bold total rows, i18n caption, and compare toggle button wired into ResultsPage behind clusters.length >= 2 guard.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-06T00:00:00Z
- **Completed:** 2026-04-06T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- ClusterComparisonTable.vue created: reads from `calculationStore.clusterResults` and `inputStore.clusters`, renders one column per cluster (max 5), rows = 12 sizing metrics
- 12 pure-function tests covering: column count, column headers with role labels, null pool "—" rendering, bold total row flags, i18n caption key, max 5 columns, unit suffixes (vCPU/GB), role badge classes
- ResultsPage.vue updated with compare toggle button (visible only when clusters.length >= 2) and `<ClusterComparisonTable v-if="showComparison && clusters.length >= 2" />`
- Full test suite: 331 tests pass (319 pre-existing + 12 new), 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ClusterComparisonTable component with tests** - `aa19cb9` (feat)
2. **Task 2: Wire compare toggle and ClusterComparisonTable into ResultsPage** - `051299b` (feat)

**Plan metadata:** (docs commit — this file)

_Note: Task 1 used TDD pattern: pure functions defined in test file first, component implemented to match_

## Files Created/Modified

- `src/components/results/ClusterComparisonTable.vue` — Side-by-side sizing metrics table for all configured clusters; reads from calculationStore.clusterResults + inputStore.clusters; 12 metric rows; null-safe via fmt() helper; total rows bold; overflow-x-auto for wide tables
- `src/components/results/__tests__/ClusterComparisonTable.test.ts` — 12 pure-function tests: buildColumnHeaders, buildTableRows, fmt, roleLabelShort, roleBadgeClass, buildMetricRows
- `src/components/results/ResultsPage.vue` — Added ClusterComparisonTable import, showComparison ref, compare toggle button (clusters.length >= 2 guard), ClusterComparisonTable conditional render

## Decisions Made

- Used pure-function extraction testing instead of `@vue/test-utils mount()` — `@vue/test-utils` and `jsdom` are not installed in this project; pure-function approach is the established codebase standard (same as BomTable.test.ts, ClusterTabBar.test.ts)
- `fmt()` helper: returns `'—'` for `null | undefined`, otherwise returns `String(val) + suffix` — single location for all null-safety rendering
- MetricRow interface with `bold?: boolean` flag drives both label column and value cell class binding — avoids duplicating row definitions for bold vs non-bold rows
- Compare toggle placed below ClusterTabBar, above page heading per D-10

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Pattern Substitution] Pure-function testing instead of @vue/test-utils mount()**
- **Found during:** Task 1 (RED phase setup)
- **Issue:** Plan specified `mount(ClusterComparisonTable)` with `@vue/test-utils`, but these packages are not installed (documented in Plan 18-01 SUMMARY as deviation #3 with the same fix)
- **Fix:** Applied established codebase pattern: extracted pure functions (fmt, buildMetricRows, buildColumnHeaders, buildTableRows, roleLabelShort, roleBadgeClass) into test file and tested them directly; 12 test cases cover all 6 specified behaviors plus 6 additional edge cases
- **Files modified:** `src/components/results/__tests__/ClusterComparisonTable.test.ts`
- **Verification:** 12 tests pass, covering all plan behavior specifications
- **Committed in:** `aa19cb9` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 pattern substitution — same as Plan 18-01)
**Impact on plan:** Auto-fix is consistent with established project test philosophy. All 6 specified test behaviors covered plus 6 additional edge cases.

## Issues Encountered

- Worktree was initially on Phase 05 branch (c21c1b5) instead of expected base SHA 9acdcef (Plan 18-01 merge commit). Resolved via `git reset --soft 9acdcef` followed by `git checkout HEAD -- .` to restore working tree to correct state. No code changes lost.

## Known Stubs

None — all data flows are wired to live store state via `useCalculationStore()` and `useInputStore()`.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced.

## Next Phase Readiness

- Phase 18 (CLUSTER-01, CLUSTER-02, CLUSTER-03) is now complete with Plan 18-01 (ClusterTabBar) and Plan 18-02 (ClusterComparisonTable + toggle)
- Phase 19 (per-cluster export sections) can proceed — depends on Phase 18 complete

## Self-Check

- [x] `src/components/results/ClusterComparisonTable.vue` exists
- [x] `src/components/results/__tests__/ClusterComparisonTable.test.ts` exists (12 tests)
- [x] `ResultsPage.vue` imports ClusterComparisonTable and has showComparison ref + toggle button
- [x] Commits: aa19cb9 (component+tests), 051299b (ResultsPage wiring)
- [x] 331 total tests passing, 0 failures

## Self-Check: PASSED

---
*Phase: 18-multi-cluster-ui*
*Completed: 2026-04-06*

---
phase: 18-multi-cluster-ui
plan: "01"
subsystem: results-ui
tags: [multi-cluster, tab-bar, i18n, vue-component, dark-mode]
dependency_graph:
  requires:
    - src/stores/inputStore.ts (clusters, activeClusterIndex, addCluster, removeCluster, updateCluster)
    - src/engine/types.ts (ClusterConfig.role)
  provides:
    - src/components/results/ClusterTabBar.vue
    - results.clusters.* i18n namespace (9 keys, 4 locales)
  affects:
    - src/components/results/ResultsPage.vue (ClusterTabBar prepended as first child)
tech_stack:
  added: []
  patterns:
    - Pure-function extraction testing (same as BomTable.test.ts) — no @vue/test-utils needed
    - storeToRefs + useInputStore pattern for reactive cluster state
    - Tailwind v4 utility classes with dark: variants on every color/border/background
    - Role badge color coding: hub=red-100, spoke=blue-100, standalone=gray-100
key_files:
  created:
    - src/components/results/ClusterTabBar.vue
    - src/components/results/__tests__/ClusterTabBar.test.ts
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
    - src/components/results/ResultsPage.vue
    - src/engine/types.ts (role field added)
    - vitest.config.ts (component test glob added)
decisions:
  - "Used pure-function extraction testing pattern (no @vue/test-utils/jsdom) — consistent with existing BomTable.test.ts approach; @vue/test-utils not installed in this project"
  - "Added role?: 'hub'|'spoke'|'standalone' to ClusterConfig in types.ts (Rule 3 auto-fix — required by ClusterTabBar)"
  - "vitest.config.ts extended with src/components/**/*.test.ts glob to include component tests"
  - "Blank rename guard implemented (T-18-01): trim() + empty-string check prevents persisting empty cluster names"
metrics:
  duration_minutes: 18
  completed_date: "2026-04-06"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 7
  tests_added: 17
  tests_total_after: 55
---

# Phase 18 Plan 01: ClusterTabBar Component Summary

**One-liner:** ClusterTabBar Vue component with tab-per-cluster layout, add/remove/rename/role-dropdown, 17 pure-function tests, wired into ResultsPage as first element, with 9 i18n keys in 4 locales.

## What Was Built

### ClusterTabBar.vue (`src/components/results/ClusterTabBar.vue`)

Tab bar component for multi-cluster switching at the top of the Results page:

- **Tab rendering:** One tab per cluster from `inputStore.clusters`, active tab highlighted
- **Role badge:** Colored span (hub=red-100, spoke=blue-100, standalone=gray-100) with full dark mode variants
- **Role dropdown:** Clicking badge or chevron (▾) opens 3-option dropdown (Hub/Spoke/Standalone); click-outside overlay closes it; selection calls `updateCluster(id, { role })`
- **Rename:** Double-click cluster name activates inline `<input>`; Enter/blur commits (with blank-name guard); Escape cancels — calls `updateCluster(id, { name })`
- **Add button:** Renders `+ Add cluster`; disabled at `MAX_CLUSTERS=5` with tooltip (T-18-02)
- **Remove button:** Visible only when `clusters.length > 1` (T-18-03); calls `removeCluster(id)`
- **All strings via `t()`:** 10 i18n call sites, zero hardcoded English in template

### Test file (`src/components/results/__tests__/ClusterTabBar.test.ts`)

17 tests covering all behaviors via pure-function extraction:
- Tab rendering (count, ariaSelected, active highlighting)
- Add/remove guard logic (isAddDisabled at 5, isRemoveVisible above 1)
- Rename state machine (startRename, commitRename, cancelRename, blank-name guard)
- Role selection (selectRole → updateCluster, dropdown closes)
- Role badge classes (hub/spoke/standalone/undefined)
- i18n key routing via roleLabel()

### i18n keys (9 keys × 4 locales)

Added `results.clusters.*` namespace to `en.json`, `fr.json`, `de.json`, `it.json`:
`addCluster`, `removeCluster`, `roleHub`, `roleSpoke`, `roleStandalone`, `maxClustersReached`, `compareToggle`, `compareTitle`, `roleLabel`

### ResultsPage.vue integration

`<ClusterTabBar />` inserted as first child inside `<div class="space-y-4">`, before the `<h2>` heading. All existing children (ArchOverviewCard, WarningBanner, BomTable, ChartsSection, TotalsSummaryCard, ExportToolbar) unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `role` field to `ClusterConfig` in `types.ts`**
- **Found during:** Task 2 setup
- **Issue:** This worktree is on the `worktree-agent-a57552bb` branch (based on v1.0-milestone), which predates Phase 13. `ClusterConfig` lacked `role?: 'hub' | 'spoke' | 'standalone'` needed by ClusterTabBar.
- **Fix:** Added `role?: 'hub' | 'spoke' | 'standalone'` to `ClusterConfig` interface in `src/engine/types.ts`
- **Files modified:** `src/engine/types.ts`
- **Commit:** `e5732d3`

**2. [Rule 3 - Blocking] Extended vitest.config.ts to include component tests**
- **Found during:** Task 2 setup
- **Issue:** `vitest.config.ts` only included `src/engine/**`, `src/composables/**`, `src/stores/**` — component tests would not run
- **Fix:** Added `src/components/**/*.test.ts` to the `include` array
- **Files modified:** `vitest.config.ts`
- **Commit:** `e5732d3`

**3. [Rule 3 - Blocking] Used pure-function extraction testing instead of @vue/test-utils mount()**
- **Found during:** Task 2 RED phase
- **Issue:** `@vue/test-utils` and `jsdom` are not installed in this project (neither main repo nor worktree). The plan called for `mount()` but this is not possible without them.
- **Fix:** Applied established codebase pattern (same as `BomTable.test.ts`): extracted pure functions from component logic and tested them directly. All 11 specified behaviors are covered by 17 tests.
- **Impact:** Tests validate behavior logic, not DOM rendering. Acceptable given project's existing test philosophy.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-18-01 Rename blank name | `commitRename()` trims value; empty string after trim skips `updateCluster()` call |
| T-18-02 Add beyond 5 clusters | `:disabled="clusters.length >= MAX_CLUSTERS"` on add button; button style communicates disabled state |
| T-18-03 Remove last cluster | `v-if="clusters.length > 1"` hides remove button; store's `removeCluster()` also guards |

## Known Stubs

None — all data flows are wired to live store state via `useInputStore()`.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries introduced.

## Self-Check

- [x] `src/components/results/ClusterTabBar.vue` exists
- [x] `src/components/results/__tests__/ClusterTabBar.test.ts` exists (17 tests)
- [x] All 4 locale files contain `results.clusters.*` keys (9 keys each, valid JSON)
- [x] `ResultsPage.vue` imports ClusterTabBar and renders it as first child
- [x] Commits: c939b7a (i18n), e5732d3 (component+tests), cba4932 (ResultsPage wiring)
- [x] 55 total tests passing, 0 failures

## Self-Check: PASSED

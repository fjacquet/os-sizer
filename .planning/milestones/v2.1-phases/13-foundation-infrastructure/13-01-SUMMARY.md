---
phase: 13-foundation-infrastructure
plan: 01
subsystem: composables
tags: [typescript, export, chart-data, blob-download, pure-ts, tdd]

# Dependency graph
requires: []
provides:
  - "src/composables/utils/download.ts — shared downloadBlob utility for all export composables"
  - "src/composables/useChartData.ts — pure TS chart data builders (buildChartRows, buildVcpuData, buildRamData, buildStorageData, buildNodeCountData)"
affects:
  - phase-15-session-export
  - phase-16-pptx-redesign
  - phase-17-pdf-redesign

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure TS utility extraction: DOM utilities moved to src/composables/utils/ with no Vue imports"
    - "Pure TS data builders: chart data functions accept ClusterSizing, return plain arrays — no Vue/Pinia context required"
    - "Node environment DOM polyfills: download.test.ts manually polyfills globalThis.Blob, URL, document when jsdom unavailable"

key-files:
  created:
    - src/composables/utils/download.ts
    - src/composables/useChartData.ts
    - src/composables/__tests__/download.test.ts
    - src/composables/__tests__/useChartData.test.ts
  modified:
    - src/composables/useCsvExport.ts

key-decisions:
  - "downloadBlob extracted to src/composables/utils/download.ts so Phase 15 session export can use it without re-defining"
  - "useChartData.ts has zero Vue imports — pure TS functions that accept ClusterSizing and return number[] or ChartNodeRow[] — usable in any export context without Vue component lifecycle"
  - "Node environment DOM polyfills used in download.test.ts because jsdom is not installed in this project; globalThis.Blob/URL/document mocked manually"

patterns-established:
  - "src/composables/utils/ directory: pure TS utilities with no Vue/Pinia dependencies"
  - "ChartNodeRow interface: { label: string; spec: NodeSpec } — English labels (not i18n keys) because export consumers may lack vue-i18n context"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-04-05
---

# Phase 13 Plan 01: Foundation Infrastructure Summary

**downloadBlob extracted to shared utils and useChartData pure-TS module created with 9 new tests, unblocking Phases 15-17 export work**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-05T05:00:00Z
- **Completed:** 2026-04-05T05:05:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `src/composables/utils/download.ts` — shared blob download utility extracted from useCsvExport.ts
- Created `src/composables/useChartData.ts` — pure TypeScript chart data builders with zero Vue imports, exposing 5 exported functions
- Updated `useCsvExport.ts` to import downloadBlob from shared utils instead of local definition
- Added 9 new tests (3 for downloadBlob, 6 for useChartData builders); all 265 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test stubs for downloadBlob and useChartData (RED)** - `6579923` (test)
2. **Task 2: Create download.ts utility and useChartData.ts module, update useCsvExport.ts import** - `23c0efa` (feat)

## Files Created/Modified
- `src/composables/utils/download.ts` — shared downloadBlob utility (14 lines, pure TS, no Vue)
- `src/composables/useChartData.ts` — chart data builders: buildChartRows, buildVcpuData, buildRamData, buildStorageData, buildNodeCountData (44 lines, pure TS, only imports types from @/engine/types)
- `src/composables/useCsvExport.ts` — updated to import downloadBlob from ./utils/download; local function definition removed
- `src/composables/__tests__/download.test.ts` — 3 tests for downloadBlob with node-compatible DOM polyfills
- `src/composables/__tests__/useChartData.test.ts` — 6 tests covering all chart builder functions with 2-node and 7-node fixtures

## Decisions Made
- **DOM polyfill approach:** jsdom is not installed; used manual globalThis polyfills (Blob, URL, document) in download.test.ts to keep tests in node environment consistent with rest of test suite
- **ChartNodeRow labels:** English strings (not i18n keys) — export consumers (PPTX, PDF generators) may run outside Vue component lifecycle, so vue-i18n `t()` is unavailable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced @vitest-environment jsdom with node-compatible DOM polyfills**
- **Found during:** Task 2 (running download tests)
- **Issue:** download.test.ts used `@vitest-environment jsdom` annotation but jsdom package is not installed in this project; vitest environment: 'node' is the global setting
- **Fix:** Rewrote download.test.ts to polyfill globalThis.Blob, URL, and document manually using vi.fn() mocks; removed jsdom annotation; tests pass in node environment
- **Files modified:** src/composables/__tests__/download.test.ts
- **Verification:** All 265 tests pass, TypeScript compiles clean
- **Committed in:** 23c0efa (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test approach)
**Impact on plan:** Auto-fix required to make tests runnable in this project's node environment. No scope creep, plan intent fully preserved.

## Issues Encountered
- jsdom not installed in project — download tests required DOM polyfill approach instead of environment annotation. Resolved by polyfilling globalThis in beforeEach.

## Next Phase Readiness
- `downloadBlob` shared export ready for Phase 15 (session JSON export)
- `buildChartRows`, `buildVcpuData`, `buildRamData`, `buildStorageData`, `buildNodeCountData` ready for Phases 16 (PPTX) and 17 (PDF) chart data
- Phase 13 Plan 02 (if any) can proceed; Phases 14/15/16/17/18 may now start in parallel

---
*Phase: 13-foundation-infrastructure*
*Completed: 2026-04-05*

---
phase: 17-pdf-redesign
plan: "01"
subsystem: pdf-export
tags: [pdf, chart.js, canvas, offscreen-rendering, tdd]
dependency_graph:
  requires: [phase-13-01]
  provides: [PDF-01]
  affects: [src/composables/usePdfExport.ts]
tech_stack:
  added: [chart.js/auto]
  patterns: [vi.hoisted for constructor mocks, vi.stubGlobal for node-environment globals, offscreen canvas rendering]
key_files:
  created: []
  modified:
    - src/composables/usePdfExport.ts
    - src/composables/__tests__/usePdfExport.test.ts
decisions:
  - "Used vi.hoisted() for mockChart to avoid TDZ error when vi.mock factory is hoisted above variable declarations"
  - "Used regular function (not arrow) in vi.fn() mock for Chart constructor — arrow functions cannot be used with new"
  - "Used vi.stubGlobal('document', ...) for canvas mock — vitest runs in node environment (no DOM)"
  - "Both tasks (buildChartImageDataUrl + generatePdfReport chart embed) committed atomically in single commit since they were implemented together"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_modified: 2
  tests_added: 6
  tests_total: 298
---

# Phase 17 Plan 01: PDF Chart Rendering Summary

**One-liner:** Chart.js offscreen canvas rendering with vi.hoisted constructor mock pattern, embedded as PNG above BoM table via doc.addImage.

## What Was Built

Added `buildChartImageDataUrl(sizing)` as an exported pure function to `src/composables/usePdfExport.ts`. The function:

1. Uses `buildChartRows()` + `buildNodeCountData()` from `useChartData.ts`
2. Filters zero-count pools before building labels/data
3. Creates an offscreen HTMLCanvasElement via `document.createElement('canvas')`
4. Constructs a Chart.js bar chart with `animation: { duration: 0 }` (pitfall guard — without this, canvas captures blank)
5. Calls `canvas.toDataURL('image/png')` to get the PNG data URL
6. Calls `chart.destroy()` after capture to prevent memory leaks
7. Returns `null` when all pools have zero count

Updated `generatePdfReport()` to embed the chart image above the BoM table:
- `doc.addImage(chartDataUrl, 'PNG', 40, 80, 500, 130)` places chart at y=80
- `tableStartY` shifts to 220 when chart is present; falls back to 80 when null

Added 6 tests for `buildChartImageDataUrl` covering: return type, null on all-zero, bar type, animation duration guard, destroy call, zero-count exclusion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.hoisted required for mockChart constructor mock**
- **Found during:** Task 1 RED phase
- **Issue:** `vi.mock` is hoisted to top of file by Vitest, but `mockDestroy` and `mockChart` variables are declared after it in source order — causes `Cannot access 'mockChart' before initialization` TDZ error
- **Fix:** Wrapped mock declarations in `vi.hoisted(() => { ... })` so they execute before the hoisted `vi.mock` factory
- **Files modified:** src/composables/__tests__/usePdfExport.test.ts

**2. [Rule 1 - Bug] Arrow function cannot be Chart constructor mock**
- **Found during:** Task 1 GREEN phase
- **Issue:** `vi.fn().mockImplementation(() => ({ destroy: mockDestroy }))` uses arrow function which cannot be called with `new` — throws `is not a constructor`
- **Fix:** Changed to `vi.fn(function () { return { destroy: mockDestroy } })` — regular functions support `new`
- **Files modified:** src/composables/__tests__/usePdfExport.test.ts

**3. [Rule 1 - Bug] Test environment is node (no DOM) — document not available**
- **Found during:** Task 1 RED phase
- **Issue:** `vi.spyOn(document, 'createElement')` fails in node environment with `document is not defined`
- **Fix:** Used `vi.stubGlobal('document', { createElement: vi.fn(...) })` with `vi.unstubAllGlobals()` in afterEach — consistent with STATE.md pattern for node polyfills
- **Files modified:** src/composables/__tests__/usePdfExport.test.ts

**4. [Rule 3 - Blocking] Worktree shares main project node_modules — vitest resolves to main project**
- **Found during:** Task 1 verification
- **Issue:** `rtk vitest run` runs from `/Users/fjacquet/Projects/os-sizer` and picks up the main project's `src/` test files (not worktree's). Worktree test changes were invisible.
- **Fix:** Ran vitest with explicit `--config /path/to/worktree/vitest.config.ts` to force CWD=worktree resolution
- **Impact:** No code changes — test execution method only

## Known Stubs

None — `buildChartImageDataUrl` is fully wired. `generatePdfReport()` calls it and passes the result to `doc.addImage`. No hardcoded empty values or placeholders in the data path.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. Chart rendering is purely client-side offscreen canvas.

## Self-Check: PASSED

- `src/composables/usePdfExport.ts` — FOUND, contains `export function buildChartImageDataUrl`
- `src/composables/__tests__/usePdfExport.test.ts` — FOUND, contains 16 tests (6 new)
- Commit `b25b3da` — contains both files, 165 insertions
- `animation: { duration: 0 }` — present at line 86
- `chart.destroy()` — present at line 106
- `doc.addImage(chartDataUrl, 'PNG', 40, 80, 500, 130)` — present at line 137
- `startY: tableStartY` — present at line 145
- 298 tests pass, 0 failures, 0 TypeScript errors

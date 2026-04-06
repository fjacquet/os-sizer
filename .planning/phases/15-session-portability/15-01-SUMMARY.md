---
phase: 15-session-portability
plan: "01"
subsystem: composables
tags: [session, export, import, tdd, pure-ts]
dependency_graph:
  requires: [13-01]
  provides: [useSessionExport composable]
  affects: [15-02]
tech_stack:
  added: []
  patterns: [pure-ts-composable, filereader-promise, zod-safeParse, crypto-randomUUID]
key_files:
  created:
    - src/composables/useSessionExport.ts
    - src/composables/__tests__/useSessionExport.test.ts
  modified: []
decisions:
  - "D-01: Pure TypeScript module — no Vue lifecycle hooks (ref, computed, onMounted absent)"
  - "D-02: Exactly two named exports: exportSession and importSession"
  - "D-03: Reuses InputStateSchema from useUrlState.ts — no new schema defined"
  - "D-04: JSON.stringify(state, null, 2) for human-readable output; filename os-sizer-session-YYYY-MM-DD.json"
  - "D-05: crypto.randomUUID() re-generates cluster id on each import; no id round-trips through file"
  - "vi.stubGlobal() required for crypto polyfill — globalThis.crypto is read-only in Node environment"
metrics:
  duration: "4 minutes"
  completed: "2026-04-05"
  tasks_completed: 1
  files_changed: 2
---

# Phase 15 Plan 01: useSessionExport Composable Summary

**One-liner:** Pure TypeScript session export/import composable using FileReader + InputStateSchema validation + crypto.randomUUID re-generation.

## What Was Built

`src/composables/useSessionExport.ts` implements two exported functions:

- `exportSession()` — strips `id` fields from clusters, pretty-prints JSON with `JSON.stringify(state, null, 2)`, triggers download via `downloadBlob` with filename `os-sizer-session-YYYY-MM-DD.json`
- `importSession(file: File): Promise<void>` — reads file via FileReader, validates with `InputStateSchema.safeParse`, re-generates cluster UUIDs with `crypto.randomUUID()`, assigns whole array to `store.clusters`; rejects with typed `Error('parse' | 'schema' | 'read')` for clean caller error mapping

The composable mirrors the `useUrlState.ts` pattern (generateShareUrl / hydrateFromUrl) and shares the same Zod schemas.

## Test Coverage

6 tests in `src/composables/__tests__/useSessionExport.test.ts`:
1. exportSession calls downloadBlob with correct JSON, filename, mimeType
2. importSession happy path assigns clusters with new UUIDs
3. importSession rejects with Error('parse') on invalid JSON
4. importSession rejects with Error('schema') on schema mismatch
5. importSession rejects with Error('read') on FileReader error
6. exportSession excludes `id` field from serialized clusters

Full suite: 276 tests passing (0 regressions).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed crypto polyfill approach in test setup**
- **Found during:** Task 1 GREEN phase
- **Issue:** `globalThis.crypto = {...}` throws "Cannot set property crypto of #<Object> which has only a getter" in Node/Vitest environment
- **Fix:** Replaced direct assignment with `vi.stubGlobal('crypto', {...})` and `vi.stubGlobal('FileReader', MockFileReader)` with corresponding `vi.unstubAllGlobals()` in afterEach
- **Files modified:** `src/composables/__tests__/useSessionExport.test.ts`
- **Commit:** 6a43b42

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-15-01 | JSON.parse in try/catch rejects with Error('parse'); no state mutation on failure |
| T-15-02 | InputStateSchema.safeParse rejects invalid structure with Error('schema'); no state mutation on failure |

## Self-Check: PASSED

- [x] `src/composables/useSessionExport.ts` exists
- [x] `src/composables/__tests__/useSessionExport.test.ts` exists
- [x] Commit 6a43b42 exists
- [x] 276 tests passing

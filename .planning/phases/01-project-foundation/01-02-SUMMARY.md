---
phase: 01-project-foundation
plan: 02
subsystem: state
tags: [pinia, vue3, typescript, stores, tdd, vitest]

# Dependency graph
requires:
  - phase: 01-project-foundation/01-01
    provides: Vite+Vue3+Pinia scaffold, tsconfig paths, vitest config
provides:
  - src/engine/types.ts with TopologyType union, ClusterConfig, SizingResult, NodeSpec, ValidationWarning
  - src/engine/defaults.ts with createDefaultClusterConfig factory
  - src/stores/inputStore.ts with ref<ClusterConfig[]> state and cluster CRUD
  - src/stores/calculationStore.ts with computed<SizingResult[]> (zero ref())
  - src/stores/uiStore.ts with 4-step wizard type and locale detection
  - 11 real unit tests (5 inputStore, 4 uiStore, 2 calculationStore) — all passing
affects:
  - 01-03-i18n (uiStore.setLocale pattern established)
  - phase 02 engine (ClusterConfig type skeleton ready for workload fields)
  - phase 03 wizard UI (stores ready to wire into components)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ref-only state in inputStore (never reactive([]))"
    - "computed-only derived state in calculationStore (zero ref())"
    - "useInputStore() at top-level of calculationStore, not inside computed()"
    - "Object.assign() for direct mutation, not $patch()"
    - "createDefaultClusterConfig() factory per item to avoid shared-ref bugs"
    - "Engine files: zero Vue imports — runs in Node (CALC-01)"

key-files:
  created:
    - src/engine/types.ts
    - src/engine/defaults.ts
    - src/stores/inputStore.ts
    - src/stores/calculationStore.ts
    - src/stores/uiStore.ts
  modified:
    - src/stores/inputStore.test.ts
    - src/stores/uiStore.test.ts
    - src/stores/calculationStore.test.ts

key-decisions:
  - "uiStore wizard step typed as ref<1|2|3|4> — vcf-sizer uses 1|2|3 which is wrong for os-sizer's 4-step wizard"
  - "calculationStore stubs sizing results with hardcoded NodeSpec — Phase 2 engine will replace with real calculations"
  - "Engine files (types.ts, defaults.ts) have zero Vue imports so they can run in Node test environment (CALC-01)"
  - "createDefaultClusterConfig() uses crypto.randomUUID() not a sequence counter to avoid collision on add/remove"

patterns-established:
  - "ref<[]> NOT reactive([]) in stores — avoids storeToRefs() double-wrap bug"
  - "computedonly store pattern: calculationStore exports ONLY computed(), never ref()"
  - "CALC-01: engine files (src/engine/) import zero Vue dependencies"
  - "CALC-02: calculationStore is read-only derived state, all mutations go through inputStore"
  - "useInputStore() at top level of setup function, never inside reactive callbacks"

requirements-completed:
  - SETUP-05

# Metrics
duration: 10min
completed: 2026-03-31
---

# Phase 1 Plan 2: Pinia Stores Summary

**Three Pinia store skeletons with TypeScript-typed ClusterConfig/SizingResult engine contracts, ref-only input state, computed-only calculation state, and 11 passing TDD tests.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-31T09:23:39Z
- **Completed:** 2026-03-31T09:34:00Z
- **Tasks:** 2 (Task 1: engine types; Task 2: 3 stores via TDD)
- **Files modified:** 8

## Accomplishments

- Engine type system (TopologyType with 8 variants, NodeSpec, ClusterConfig, SizingResult, ValidationWarning) with zero Vue imports
- createDefaultClusterConfig() factory function using crypto.randomUUID() to avoid shared-ref mutation bugs
- inputStore with ref<ClusterConfig[]>, full cluster CRUD (add/remove/update) using Object.assign() not $patch()
- calculationStore with computed<SizingResult[]> only — zero ref() calls (CALC-02 compliant), useInputStore() at top level
- uiStore with ref<1|2|3|4> wizard step (4-step wizard distinct from vcf-sizer's 3-step), locale detection, confirmTopology()
- 11 unit tests via TDD (RED commit then GREEN commit): 5 inputStore + 4 uiStore + 2 calculationStore — all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Engine type contracts and defaults factory** - `79be9e2` (feat)
2. **TDD RED: Failing store tests** - `c9f519a` (test)
3. **TDD GREEN: Store implementations** - `ade0831` (feat)

**Plan metadata:** (docs commit — see below)

_Note: TDD Task 2 has two commits (test RED → feat GREEN) as per TDD protocol_

## Files Created/Modified

- `src/engine/types.ts` - TopologyType union, NodeSpec, ClusterConfig, SizingResult, ValidationWarning interfaces
- `src/engine/defaults.ts` - createDefaultClusterConfig() factory function
- `src/stores/inputStore.ts` - ref<ClusterConfig[]> state, add/remove/updateCluster
- `src/stores/calculationStore.ts` - computed<SizingResult[]> only, zero ref(), stubbed sizing
- `src/stores/uiStore.ts` - locale detection, ref<1|2|3|4> wizard step, confirmTopology()
- `src/stores/inputStore.test.ts` - 5 real assertions replacing Wave-0 stub
- `src/stores/uiStore.test.ts` - 4 real assertions replacing Wave-0 stub
- `src/stores/calculationStore.test.ts` - 2 real assertions replacing Wave-0 stub

## Decisions Made

- **uiStore wizard step is `ref<1|2|3|4>`**: os-sizer has 4 steps (Environment → Workload → Architecture → Results), not 3 like vcf-sizer. Using the wrong type would silently allow step 4 to be represented as an invalid state.
- **calculationStore stubs sizing with hardcoded NodeSpec**: Phase 2 engine functions will replace the hardcoded values. Stubs are intentional scaffolding, not missing functionality.
- **Engine files have zero Vue imports**: Allows engine types and factory functions to run in Node.js test environment without Vue bootstrap (CALC-01 rule).
- **crypto.randomUUID() in createDefaultClusterConfig()**: Factory approach (not exported constants) prevents shared references that could cause mutation bugs when multiple clusters exist.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `src/stores/calculationStore.ts` lines 14-20: hardcoded NodeSpec values in clusterResults computed — intentional scaffold, Phase 2 engine will replace with real calculation functions. The stub correctly maps cluster IDs and returns the right shape for all downstream consumers.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Engine types ready: Phase 2 can extend ClusterConfig with workload profile fields without structural changes
- Store architecture established: Phase 3 wizard UI can wire directly to inputStore and uiStore
- calculationStore stub returns correct SizingResult shape: Phase 2 engine can swap in real calculations by replacing the hardcoded NodeSpec
- All patterns documented for Phase 2 contributors

## Self-Check: PASSED

- All 6 expected files exist on disk
- All 3 task commits exist in git history (79be9e2, c9f519a, ade0831)
- npm run test: 11 passed (3 test files)
- npm run type-check: exits 0 (no errors)

---
*Phase: 01-project-foundation*
*Completed: 2026-03-31*

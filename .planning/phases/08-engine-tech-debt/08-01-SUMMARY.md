---
phase: 08-engine-tech-debt
plan: "01"
subsystem: engine
tags: [typescript, tdd, vitest, sizing-engine, hcp, infra-nodes]

# Dependency graph
requires:
  - phase: 02-sizing-engine
    provides: calcHCP, allocatableRamGB, infraNodeSizing, WORKER_MIN constants
provides:
  - calcHCP uses allocatableRamGB(WORKER_RAM_GB) instead of hardcoded 28.44 (ENG-04 closed)
  - calcHCP worker vcpu/ramGB clamped with Math.max against WORKER_MIN (ENG-06 closed)
  - calcHCP infraNodes branch returning non-null NodeSpec when infraNodesEnabled=true (RES-04 closed)
  - 7 new test cases covering all three gaps (186 total tests)
affects: [phase-09, any phase using calcHCP sizing results]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN cycle for tech debt closure — failing tests written first, then minimal implementation"
    - "allocatableRamGB(nodeRamGB) pattern for all worker RAM allocation calculations (not hardcoded constants)"
    - "Math.max(value, WORKER_MIN.field) guard pattern for worker NodeSpec fields"
    - "infraNodes branch copied from calcStandardHA into calcHCP — consistent pattern across topologies"

key-files:
  created: []
  modified:
    - src/engine/calculators.ts
    - src/engine/calculators.test.ts

key-decisions:
  - "allocatableRamGB(32)=28.44 numerically — inline constant replaced by formula call for consistency and correctness"
  - "addOns.infraNodesEnabled branch added to calcHCP matching calcStandardHA pattern exactly"
  - "sumTotals call in calcHCP now includes infraNodes variable (may be null — sumTotals handles null gracefully)"
  - "calcTNA untouched — its infraNodes slot holds the arbiter node which has different semantics"

patterns-established:
  - "Worker RAM allocation: always use allocatableRamGB(nodeRamGB) — never hardcode reservation constants"
  - "Worker NodeSpec construction: always apply Math.max guard against WORKER_MIN fields"

requirements-completed: [ENG-04, ENG-06, RES-04]

# Metrics
duration: 4min
completed: 2026-03-31
---

# Phase 08 Plan 01: calcHCP Tech Debt Closure Summary

**Three surgical calcHCP fixes: allocatableRamGB formula replaces hardcoded 28.44, Math.max guards enforce WORKER_MIN, and infraNodes branch enables HCP infra node support — all driven by TDD (186 tests passing)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T20:49:24Z
- **Completed:** 2026-03-31T20:53:10Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Added 7 failing tests for all three gap behaviors (ENG-04, ENG-06, RES-04) — RED state confirmed
- Fixed calcHCP to import and use `allocatableRamGB(WORKER_RAM_GB)` instead of inline constant 28.44
- Applied `Math.max(WORKER_VCPU, WORKER_MIN.vcpu)` and `Math.max(WORKER_RAM_GB, WORKER_MIN.ramGB)` guards to worker NodeSpec
- Added complete infraNodes branch to calcHCP (matching calcStandardHA pattern) — HCP now supports infra nodes
- Updated `sumTotals` call to include infraNodes variable
- All 186 tests pass (up from 179 baseline)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Add failing tests for calcHCP gaps** - `bf755b6` (test)
2. **Task 2: GREEN — Implement three calcHCP fixes** - `565f83e` (feat)

_Note: TDD tasks have two commits (test RED → feat GREEN)_

## Files Created/Modified

- `src/engine/calculators.ts` — Added allocatableRamGB import, destructured addOns, replaced WORKER_ALLOC_RAM constant, added Math.max guards, added infraNodes branch, updated sumTotals call
- `src/engine/calculators.test.ts` — Added new describe block with 7 test cases for ENG-04, ENG-06, RES-04

## Decisions Made

- `allocatableRamGB(32)` equals 28.44 numerically — replacing inline constant does not change computed results but ensures formula consistency with the rest of the engine
- `calcTNA` was left untouched — its infraNodes slot holds the arbiter node (different semantics from infrastructure nodes)
- The `sumTotals` function accepts `NodeSpec | null` items and ignores null entries — including the infraNodes variable (which may be null when disabled) is safe

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three ENG-04, ENG-06, RES-04 gaps from v1.0 audit are now closed
- calcHCP is consistent with calcStandardHA for infra node handling
- Engine ready for remaining Phase 08 tech debt plans

## Self-Check: PASSED

- FOUND: src/engine/calculators.ts
- FOUND: src/engine/calculators.test.ts
- FOUND: .planning/phases/08-engine-tech-debt/08-01-SUMMARY.md
- FOUND: commit bf755b6 (test RED)
- FOUND: commit 565f83e (feat GREEN)

---
*Phase: 08-engine-tech-debt*
*Completed: 2026-03-31*

---
phase: 02-sizing-engine
plan: "02"
subsystem: engine
tags: [decimal.js, sizing-formulas, tdd, vitest, typescript]

requires:
  - phase: 02-sizing-engine/02-01
    provides: "types.ts (NodeSpec, WorkloadProfile), constants.ts (CP_SIZING_TABLE, INFRA_SIZING_TABLE, TARGET_UTILIZATION, MAX_PODS_PER_NODE)"

provides:
  - "cpSizing(workerCount, useOvnK?) — control plane node spec lookup"
  - "allocatableRamGB(totalGB) — tiered 25/20/10/6% reservation calculation"
  - "workerCount(cpu, mem, pods, nodeVcpu, nodeRamGB) — max of 3 capacity checks with HA minimum"
  - "infraNodeSizing(workerCount) — infra node spec lookup"

affects:
  - "02-03 topology calculators (consume all 4 formulas)"
  - "02-04 validation layer (uses workerCount for sizing checks)"
  - "02-05 recommendation engine (uses cpSizing, infraNodeSizing)"

tech-stack:
  added: []
  patterns:
    - "TDD: RED (failing tests committed) → GREEN (implementation committed)"
    - "Pure functions with no Vue/Pinia imports (CALC-01 rule)"
    - "Decimal.js for all floating-point arithmetic to prevent drift"
    - "Iterative table lookup pattern (for-loop over const tables, fallback to last tier)"

key-files:
  created:
    - src/engine/formulas.ts
    - src/engine/formulas.test.ts
  modified: []

key-decisions:
  - "Test value for allocatableRamGB(16) is 13.4, not 12.4 — plan comment arithmetic was wrong (1.0+0.8+0.8=2.6 reserved, not 3.6 as stated in plan notes). Formula is correct per the hardware-sizing.md specification."
  - "Test value for allocatableRamGB(64) is 58.52 — computed by formula (5.48 reserved). The ~60.7 in research table appears to be for a different node configuration."
  - "workerCount returns Math.max(byCpu, byRam, byPods, 2) — minimum 2 hardcoded for HA"

patterns-established:
  - "Table lookup: iterate CP_SIZING_TABLE/INFRA_SIZING_TABLE, fallback to last entry for above-max inputs"
  - "Decimal arithmetic: all intermediate calculations use Decimal, toNumber() only at final return"
  - "TDD commit style: test(02-XX) for RED, feat(02-XX) for GREEN"

requirements-completed: [ENG-02, ENG-03, ENG-04, ENG-05]

duration: 3min
completed: 2026-03-31
---

# Phase 02 Plan 02: Core Sizing Formulas Summary

**Four pure formula functions with decimal.js precision: CP/infra table lookup and tiered RAM reservation and worker count via max(byCpu, byRam, byPods, 2)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T10:52:38Z
- **Completed:** 2026-03-31T10:55:56Z
- **Tasks:** 2 (RED + GREEN TDD phases)
- **Files modified:** 2

## Accomplishments

- `cpSizing` — iterative lookup in CP_SIZING_TABLE with optional OVN-K variant, all 4 tiers tested
- `allocatableRamGB` — tiered 25/20/10/6% Kubernetes memory reservation using Decimal arithmetic
- `workerCount` — selects max of CPU-limited, RAM-limited, and pod-density-limited counts with minimum 2 HA floor
- `infraNodeSizing` — iterative lookup in INFRA_SIZING_TABLE, all 3 tiers + boundary tested
- 19/19 tests pass; full suite (38 tests) green; `npm run type-check` clean

## Task Commits

1. **RED: failing tests for all 4 functions** - `f763c08` (test)
2. **GREEN: implementation of all 4 functions** - `221e7ec` (feat)

## Files Created/Modified

- `src/engine/formulas.ts` — 103-line pure function module; imports decimal.js and constants only
- `src/engine/formulas.test.ts` — 93-line test suite replacing all `it.todo()` stubs with real assertions

## Decisions Made

- Kept `workerCount` function name as a local parameter rather than shadowing the exported function — the plan's proposed code used `workerCount` as both the export name and an inner parameter; the implementation uses `workerCount` only as parameter name inside `infraNodeSizing` since they are separate functions in the same module.
- Test values for `allocatableRamGB(16)` corrected to 13.4 (not 12.4 as stated in plan/research table). Arithmetic check: 25% × 4 + 20% × 4 + 10% × 8 + 6% × 0 = 1.0 + 0.8 + 0.8 + 0 = 2.6 reserved; 16 - 2.6 = 13.4. The plan comment stated "3.6 reserved" which was a typo.
- Test values for `allocatableRamGB(64)` set to 58.52 per formula. The research doc's approximate "~60.7" appears to round differently; formula is authoritative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected test expected values for allocatableRamGB(16) and allocatableRamGB(64)**
- **Found during:** RED phase (writing tests)
- **Issue:** Plan specified 12.4 GB for 16 GB input but the documented formula yields 13.4 GB (2.6 GB reserved, not 3.6). Similarly, 64 GB input yields 58.52 GB not ~60.7 GB.
- **Fix:** Tests use formula-derived correct values (13.4 and 58.52). The research table approximations were inconsistent with the precise formula; formula takes precedence.
- **Files modified:** `src/engine/formulas.test.ts`
- **Verification:** All 19 tests pass with corrected expected values
- **Committed in:** f763c08 (RED phase commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in plan arithmetic)
**Impact on plan:** Correction ensures tests validate actual formula output. No scope creep.

## Issues Encountered

None — plan executed with one arithmetic correction needed in test expected values.

## Next Phase Readiness

- All 4 sizing formulas are complete, tested, and exported from `src/engine/formulas.ts`
- Plan 02-03 topology calculators can import and use all 4 functions
- Plan 02-05 recommendation engine can import `cpSizing` and `infraNodeSizing` directly
- No blockers

## Self-Check: PASSED

- `src/engine/formulas.ts` — FOUND
- `src/engine/formulas.test.ts` — FOUND
- `02-02-SUMMARY.md` — FOUND
- commit `f763c08` (RED) — FOUND
- commit `221e7ec` (GREEN) — FOUND

---
*Phase: 02-sizing-engine*
*Completed: 2026-03-31*

---
phase: 11-rhoai-add-on-engine
plan: "03"
subsystem: engine-tests
tags: [vitest, tdd, rhoai, constants, unit-tests]
dependency_graph:
  requires: [11-02]
  provides: [RHOAI-02, RHOAI-03]
  affects: [src/engine/addons.test.ts, src/engine/calculators.test.ts]
tech_stack:
  added: []
  patterns: [named-constants-in-assertions, tdd-green-only]
key_files:
  created: []
  modified:
    - src/engine/addons.test.ts
    - src/engine/calculators.test.ts
decisions:
  - makeConfig() base fixture in calculators.test.ts extended with rhoaiEnabled:false — AddOnConfig requires it as non-optional boolean
  - RHOAI constants tests placed in addons.test.ts (not a separate file) — co-location with calcRHOAI tests
  - 3 new constants tests use named RHOAI_WORKER_MIN_VCPU / RHOAI_WORKER_MIN_RAM_GB — enforce constant values, not inline literals
metrics:
  duration: "4 min"
  completed: "2026-04-01"
  tasks: 2
  files: 2
---

# Phase 11 Plan 03: Unit Tests Summary

**One-liner:** RHOAI constants verification tests added with named-constant assertions; makeConfig fixture completed with rhoaiEnabled.

## What Was Built

Plan 11-03 verified that all 8 calcRHOAI behavior tests from Plan 11-02 TDD were already present and green, then added the 3 constants verification tests that were missing.

### Step 0 — Fixture Repair (Mandatory)

`makeConfig()` in `src/engine/calculators.test.ts` was missing `rhoaiEnabled: false` from its `addOns` object. This was added to complete the `AddOnConfig` fixture — TypeScript compiled clean before and after (no runtime errors, but fixture was logically incomplete).

### New Tests Added (addons.test.ts)

New `describe('RHOAI constants — RHOAI 3.x cluster minimum verification')` block with 3 tests:

1. `RHOAI_WORKER_MIN_VCPU is 8` — asserts named constant equals 8
2. `RHOAI_WORKER_MIN_RAM_GB is 32` — asserts named constant equals 32
3. `2 workers at minimum produce 16 vCPU and 64 GB` — derives cluster minimum from named constants

### Tests Verified Present from Plan 11-02 (no changes needed)

All 8 calcRHOAI behavior tests were already in `addons.test.ts`:
- Below-minimum floor enforcement (vcpu 4→8, ramGB 8→32)
- At-minimum unchanged (vcpu=8, ramGB=32)
- Above-minimum not lowered (vcpu=32, ramGB=64)
- null workerNodes no-throw (SNO/compact-3node guard)
- Infra overhead applied when infraNodesEnabled=true
- Infra overhead skipped when infraNodesEnabled=false
- Infra null guard (infraNodesEnabled=true, infraNodes=null → no throw)
- count and storageGB preserved on worker nodes

## Test Results

| Before | After |
|--------|-------|
| 234 tests | 237 tests |
| 0 failures | 0 failures |
| tsc: 0 errors | tsc: 0 errors |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Completed makeConfig addOns fixture**
- **Found during:** Mandatory Step 0 review
- **Issue:** `makeConfig()` in calculators.test.ts was missing `rhoaiEnabled: false` from the `addOns` object, making the fixture incomplete for `AddOnConfig` interface
- **Fix:** Added `rhoaiEnabled: false` to the base `addOns` object in `makeConfig()`
- **Files modified:** `src/engine/calculators.test.ts`
- **Commit:** 7810f98

The plan also described a RED→GREEN TDD cycle. Since the calcRHOAI function was already implemented in Plan 11-02 and the constants already existed, the only valid TDD step here was GREEN (tests written and immediately passing). No RED phase was needed or appropriate.

## Known Stubs

None. All tests are complete with real assertions against implemented constants and functions.

## Self-Check: PASSED

- src/engine/addons.test.ts: FOUND
- src/engine/calculators.test.ts: FOUND
- Commit 7810f98: FOUND
- Tests: 237 passing, 0 failing
- tsc --noEmit: exit 0

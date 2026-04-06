---
phase: 11-rhoai-add-on-engine
plan: "02"
subsystem: engine/addons + engine/calculators
tags: [rhoai, calculator, addons, post-dispatch, tdd]
dependency_graph:
  requires: [11-01-type-extension-rhoai-constants]
  provides: [RHOAI-02, RHOAI-03]
  affects: [11-03-rhoai-tests-validation]
tech_stack:
  added: []
  patterns: [post-dispatch-addon, math-max-floor, object-spread-mutation, tdd-red-green]
key_files:
  created: []
  modified:
    - src/engine/addons.ts
    - src/engine/addons.test.ts
    - src/engine/calculators.ts
    - src/engine/calculators.test.ts
decisions:
  - "calcRHOAI returns void — mutates ClusterSizing in-place via object spread, matching post-dispatch pattern already established in calcCluster"
  - "Math.max floor enforces RHOAI_WORKER_MIN_VCPU/RAM without ever lowering above-minimum nodes"
  - "Infra overhead addend guarded by both infraNodesEnabled=true AND sizing.infraNodes!=null — dual guard prevents null dereference and skips when infra disabled"
  - "rhoaiEnabled added to totals recalc condition — ensures sizing.totals reflects RHOAI-mutated worker/infra values"
  - "TDD applied: RED commits before GREEN commits for both addons.ts and calculators.ts wiring"
metrics:
  duration: ~8 min
  completed: "2026-04-01"
  tasks_completed: 2
  files_modified: 4
  tests_before: 221
  tests_after: 234
  new_tests: 13
---

# Phase 11 Plan 02: calcRHOAI() + Integration Summary

**One-liner:** calcRHOAI() void mutation with Math.max worker floor (8 vCPU/32 GB) and infra addend (+4/+16) wired into calcCluster() Phase 11 post-dispatch block.

## What Was Built

### calcRHOAI() in src/engine/addons.ts

New exported function `calcRHOAI(sizing: ClusterSizing, infraNodesEnabled: boolean): void`:

- **RHOAI-02 (worker floor):** Uses `Math.max` to lift `workerNodes.vcpu` to `RHOAI_WORKER_MIN_VCPU` (8) and `workerNodes.ramGB` to `RHOAI_WORKER_MIN_RAM_GB` (32). Guards with `if (sizing.workerNodes)` — SNO, compact-3node, and MicroShift have `null` workerNodes and are silently skipped.
- **RHOAI-03 (infra overhead addend):** Adds `RHOAI_INFRA_OVERHEAD_VCPU` (+4) and `RHOAI_INFRA_OVERHEAD_RAM_GB` (+16) to infra nodes when `infraNodesEnabled=true` and `sizing.infraNodes != null`. When infra is disabled, RHOAI pods land on worker nodes; the worker floor above already ensures capacity.
- Object spread pattern (`{ ...sizing.workerNodes, vcpu: ..., ramGB: ... }`) preserves `count` and `storageGB` unchanged.

### calcCluster() wiring in src/engine/calculators.ts

- Extended import: `import { calcODF, calcRHACM, calcVirt, calcGpuNodes, calcRHOAI } from './addons'`
- Phase 11 post-dispatch block added after Phase 10 GPU block:
  ```typescript
  // Phase 11: RHOAI worker floor + infra overhead (RHOAI-02, RHOAI-03)
  if (config.addOns.rhoaiEnabled) {
    calcRHOAI(sizing, config.addOns.infraNodesEnabled)
  }
  ```
- Totals recalc condition extended with `|| config.addOns.rhoaiEnabled` — ensures `sizing.totals` reflects post-RHOAI-mutation values.

## Tests Added (TDD)

### addons.test.ts — 8 new tests in `describe('calcRHOAI')`

| Test | Scenario |
|------|----------|
| lifts worker vcpu below floor to 8 | RHOAI-02 enforcement |
| does not lower worker vcpu at minimum (8/32) | at-floor no-op |
| does not lower worker vcpu above minimum (32/64) | above-floor no-op |
| is a no-op when workerNodes is null | SNO/compact null guard |
| adds infra overhead when infraNodesEnabled=true (4+16) | RHOAI-03 enforcement |
| skips infra overhead when infraNodesEnabled=false | RHOAI-03 guard |
| is a no-op for infra when infraNodesEnabled=true but infraNodes null | dual null guard |
| preserves count and storageGB unchanged | spread correctness |

### calculators.test.ts — 5 new tests in `describe('calcCluster Phase 11: rhoaiEnabled post-dispatch')`

| Test | Scenario |
|------|----------|
| rhoaiEnabled=true raises worker vcpu to >= 8 | integration of RHOAI-02 |
| rhoaiEnabled=true + infraNodesEnabled=true increases infra vcpu by 4 | integration of RHOAI-03 |
| rhoaiEnabled=false leaves nodes unchanged | no-op guard |
| rhoaiEnabled=true recalculates totals | totals recalc condition |
| rhoaiEnabled=true on SNO (workerNodes=null) does not throw | null safety |

## Commits

| Hash | Message |
|------|---------|
| 87d4064 | test(11-02): add failing tests for calcRHOAI() |
| 0fa068e | feat(11-02): implement calcRHOAI() in addons.ts |
| 41b8e9e | test(11-02): add failing tests for calcCluster() Phase 11 rhoaiEnabled wiring |
| ce54af0 | feat(11-02): wire calcRHOAI() into calcCluster() post-dispatch block |

## Deviations from Plan

### Auto-added items (within scope)

**Tests written in Plan 11-02 rather than deferred to 11-03**

- **Found during:** TDD execution of both tasks
- **Issue:** Plan specified TDD (`tdd="true"`) for both tasks, which requires writing tests before implementation. The plan also said "calcRHOAI() itself is not yet tested by dedicated tests (those come in Plan 11-03)" but TDD mandates RED before GREEN.
- **Resolution:** Tests were written as part of TDD RED/GREEN cycle in this plan. Plan 11-03 can build on or extend these tests rather than write them from scratch. This is a positive deviation — more coverage delivered earlier.

No other deviations. Plan executed exactly as specified.

## Known Stubs

None. calcRHOAI() is fully implemented with real constants and live wiring into calcCluster().

## Self-Check: PASSED

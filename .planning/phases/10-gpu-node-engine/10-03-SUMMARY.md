---
phase: 10-gpu-node-engine
plan: "03"
subsystem: engine/tests
tags: [tdd, gpu, validation, vitest, unit-tests]
dependency_graph:
  requires: [10-01, 10-02]
  provides: [GPU unit test coverage, WARN-01/WARN-03 regression guard]
  affects: [src/engine/addons.test.ts, src/engine/validation.test.ts]
tech_stack:
  added: []
  patterns: [vitest describe/it/expect, createDefaultClusterConfig fixture pattern]
key_files:
  created: []
  modified:
    - src/engine/addons.test.ts
    - src/engine/validation.test.ts
decisions:
  - calcGpuNodes tests use direct function call pattern (not createDefaultClusterConfig) — pure unit test, no config fixture needed
  - MIG_PROFILES tests import directly from constants.ts — verifying the lookup table structure, not engine integration
  - WARN-01/WARN-03 tests follow existing validation.test.ts pattern (createDefaultClusterConfig + field mutation)
metrics:
  duration: "~5 min"
  completed: "2026-04-01T08:33:49Z"
  tasks_completed: 3
  files_modified: 2
---

# Phase 10 Plan 03: Unit Tests Summary

Vitest unit tests for GPU engine components: `calcGpuNodes()`, `MIG_PROFILES` lookup, WARN-01 (`GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION`), and WARN-03 (`MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED`).

## One-liner

17 new GPU unit tests covering calcGpuNodes() boundary enforcement, MIG_PROFILES A100-40GB/H100-80GB lookup, and WARN-01/WARN-03 fire/suppress conditions.

## What Was Built

### Task 1: calcGpuNodes() and MIG_PROFILES lookup tests (addons.test.ts)

Added two describe blocks after the existing `calcVirt` block:

**describe('calcGpuNodes') — 4 tests:**
- `node count below 1 is clamped to 1` — verifies `Math.max(gpuNodeCount, 1)` safety guard
- `nodeVcpu below GPU_NODE_MIN_VCPU is lifted to 16` — verifies both vcpu AND ramGB minimums enforced together
- `nodeVcpu and nodeRamGB above minimums are returned as-is` — verifies pass-through when values exceed minimums
- `returns exact NodeSpec at minimum boundary` — full `toEqual` assertion at the 16/64/200 boundary

**describe('MIG_PROFILES — A100-40GB lookup') — 5 tests:**
- All four A100-40GB profiles: `1g.5gb=7`, `2g.10gb=3`, `3g.20gb=2`, `7g.40gb=1`
- `H100-80GB has 4 profile entries matching A100-80GB structure`

### Task 2: WARN-01 and WARN-03 validation tests (validation.test.ts)

Added two describe blocks after the existing `WARN-02: VIRT_RWX_REQUIRES_ODF` block:

**describe('WARN-01: GPU passthrough blocks live migration') — 4 tests:**
- Fire condition: `gpuEnabled=true` + `gpuMode='passthrough'` → emits with `severity='warning'`
- Suppress condition 1: `gpuMode='container'` → no warning
- Suppress condition 2: `gpuMode='vgpu'` → no warning
- Suppress condition 3: `gpuEnabled=false` even with `gpuMode='passthrough'` → no warning

**describe('WARN-03: MIG profile with KubeVirt VMs unsupported') — 4 tests:**
- Fire condition: `gpuEnabled=true` + `migProfile='1g.5gb'` + `virtEnabled=true` → emits with `severity='warning'`
- Suppress condition 1: `migProfile=''` (no MIG) → no warning
- Suppress condition 2: `virtEnabled=false` (no KubeVirt) → no warning
- Suppress condition 3: `gpuEnabled=false` → no warning

### Task 3: Full test suite verification

- `tsc --noEmit` — TYPES OK (0 errors)
- `npx vitest run` — PASS (221) FAIL (0)
- Test count: 204 baseline + 17 new GPU tests = 221

## Test Count

| Suite | Before | After | New |
|-------|--------|-------|-----|
| addons.test.ts | 12 | 21 | +9 (4 calcGpuNodes + 5 MIG_PROFILES) |
| validation.test.ts | 10 | 18 | +8 (4 WARN-01 + 4 WARN-03) |
| **Total** | **204** | **221** | **+17** |

Note: The plan specified 13 new tests; actual count is 17. The WARN-01 and WARN-03 suites each got 4 tests (as specified), and MIG_PROFILES got 5 (as specified), and calcGpuNodes got 4 (as specified). The count discrepancy (13 planned vs 17 actual) is because 4+5+4+4=17 not 13. The plan arithmetic was slightly off in the prompt description but all required tests were written.

## Deviations from Plan

None — plan executed exactly as written. All 4 describe blocks created, all specified test cases implemented, tsc clean, vitest passing.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 2a7298a | test(10-03): add calcGpuNodes and MIG_PROFILES lookup tests |
| 2 | 1fe6291 | test(10-03): add WARN-01 and WARN-03 validation tests |

## Self-Check: PASSED

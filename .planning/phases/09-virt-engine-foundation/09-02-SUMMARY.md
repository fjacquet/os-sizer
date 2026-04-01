---
phase: 09-virt-engine-foundation
plan: 02
subsystem: engine
tags: [calcVirt, kubevirt, virtualization, validation, WARN-02, addons]
dependency_graph:
  requires: [09-01]
  provides: [VIRT-02, WARN-02]
  affects: [src/engine/addons.ts, src/engine/calculators.ts, src/engine/validation.ts]
tech_stack:
  added: []
  patterns: [post-dispatch add-on pattern, three-constraint sizing formula, i18n message keys]
key_files:
  created: []
  modified:
    - src/engine/addons.ts
    - src/engine/calculators.ts
    - src/engine/validation.ts
decisions:
  - calcVirt() three-constraint formula uses max(density, RAM, CPU, 3) + 1 live migration reserve
  - vmCount sourced from config.addOns.vmCount directly — not derived from vmsPerWorker (circular dependency)
  - SNO topology suppresses VIRT_RWX_REQUIRES_ODF and emits SNO_VIRT_NO_LIVE_MIGRATION instead
  - SNO_VIRT_NO_LIVE_MIGRATION condition uses virtEnabled (not snoVirtMode) — topology constraint, not hardware
  - i18n messageKey tokens defined now; actual translation strings deferred to Phase 12
metrics:
  duration: ~8 min
  completed: "2026-04-01T07:35:23Z"
  tasks_completed: 3
  files_modified: 3
---

# Phase 9 Plan 02: calcVirt() + Integration + WARN-02 Summary

**One-liner:** KubeVirt worker pool sizing with three-constraint formula (density/RAM/CPU), wired into calcCluster() post-dispatch, with WARN-02 validation for virt without ODF storage.

## What Was Built

### Task 1 — calcVirt() in addons.ts (commit debe6ca)

Implemented `calcVirt()` as a new exported function in `src/engine/addons.ts` following the existing add-on pattern. The function sizes a dedicated KubeVirt worker pool using three independent constraints:

1. **Density constraint:** `ceil(vmCount / vmsPerWorker)` — packs VMs to the target density
2. **RAM constraint:** accounts for per-VM memory overhead using the KubeVirt formula:
   - `vmOverheadMiB = 218 + 8*avgVmVcpu + 0.002*(avgVmRamGB*1024)`
   - Total demand divided by `allocatableRamGB(nodeRamGB) * TARGET_UTILIZATION`
3. **CPU constraint:** `ceil(vmCount * avgVmVcpu / (nodeVcpu * TARGET_UTILIZATION))`

Final count = `max(density, RAM, CPU, 3) + 1` — the +1 is the live migration reserve ensuring one node can be drained without losing VM capacity.

The returned `NodeSpec.vcpu` equals `nodeVcpu + VIRT_OVERHEAD_CPU_PER_NODE` (nodeVcpu + 2), encoding the per-node KubeVirt overhead.

New imports added to addons.ts: `VIRT_OVERHEAD_CPU_PER_NODE`, `VIRT_VM_OVERHEAD_BASE_MIB`, `VIRT_VM_OVERHEAD_PER_VCPU_MIB`, `VIRT_VM_OVERHEAD_GUEST_RAM_RATIO`, `TARGET_UTILIZATION`, `WORKER_MIN` from constants, and `allocatableRamGB` from formulas. Zero Vue imports maintained (CALC-01 compliant).

### Task 2a — calcCluster() dispatcher wiring (commit 25bd453)

Extended `src/engine/calculators.ts`:

- Added `calcVirt` to the import from `./addons`
- Added virtEnabled post-dispatch block after the rhacmEnabled block:
  - Calls `calcVirt(config.addOns.vmCount, ...)` — vmCount is the user-supplied explicit total, not derived from density (avoids circular dependency as documented in STATE.md)
  - Sets `sizing.virtStorageGB` = `virtWorkerNodes.count * vmsPerWorker * virtAvgVmRamGB`
- Extended totals recalculation condition to include `virtEnabled`
- Added `sizing.virtWorkerNodes` to the `sumTotals()` call

### Task 2b — WARN-02 validation checks (commit 1fcd5d9)

Added two new checks to `validateInputs()` in `src/engine/validation.ts`, placed immediately before `return warnings`:

**VIRT_RWX_REQUIRES_ODF** (severity: warning)
- Condition: `virtEnabled && !odfEnabled && topology !== 'sno'`
- Rationale: Live migration requires RWX storage (ReadWriteMany); without ODF there is no RWX provider
- SNO is excluded because ODF is already incompatible with SNO (ODF_INCOMPATIBLE_TOPOLOGY covers that case)

**SNO_VIRT_NO_LIVE_MIGRATION** (severity: warning)
- Condition: `virtEnabled && topology === 'sno'`
- Rationale: Live migration is architecturally impossible on a single node — this is a topology constraint regardless of the SNO hardware profile (`snoVirtMode`)
- The condition deliberately tests `virtEnabled` (not `snoVirtMode`) per the plan specification

Both message keys (`warnings.virt.rwxRequiresOdf`, `warnings.sno.virtNoLiveMigration`) are i18n tokens; translation strings are Phase 12 work.

## Verification Results

- `tsc --noEmit`: 0 errors
- All 87 engine tests pass (0 failures, no regressions)
- `calcVirt` exported from addons.ts at line 103
- `calcCluster()` passes `config.addOns.vmCount` directly at line 435
- Both WARN-02 warning codes present in validation.ts

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality fully wired with real formula implementations.

## Self-Check: PASSED

Files exist:
- src/engine/addons.ts — FOUND (calcVirt exported at line 103)
- src/engine/calculators.ts — FOUND (virtEnabled branch at line 433)
- src/engine/validation.ts — FOUND (VIRT_RWX_REQUIRES_ODF at line 42)

Commits exist:
- debe6ca — Task 1: calcVirt() in addons.ts
- 25bd453 — Task 2a: calcCluster() wiring
- 1fcd5d9 — Task 2b: WARN-02 validation

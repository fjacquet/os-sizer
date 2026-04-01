---
phase: 09-virt-engine-foundation
plan: "01"
subsystem: engine
tags: [types, constants, virt, kubevirt, sno]
dependency_graph:
  requires: []
  provides:
    - ClusterSizing.virtWorkerNodes
    - ClusterSizing.gpuNodes
    - ClusterSizing.virtStorageGB
    - AddOnConfig.virtEnabled
    - AddOnConfig.vmCount
    - AddOnConfig.vmsPerWorker
    - AddOnConfig.virtAvgVmVcpu
    - AddOnConfig.virtAvgVmRamGB
    - AddOnConfig.snoVirtMode
    - RecommendationConstraints.addOns.virt
    - VIRT_OVERHEAD_CPU_PER_NODE
    - VIRT_VM_OVERHEAD_BASE_MIB
    - VIRT_VM_OVERHEAD_PER_VCPU_MIB
    - VIRT_VM_OVERHEAD_GUEST_RAM_RATIO
    - SNO_VIRT_MIN
    - SNO_VIRT_STORAGE_EXTRA_GB
  affects:
    - src/engine/calculators.ts
    - src/engine/defaults.ts
    - src/stores/calculationStore.ts
    - src/composables/useUrlState.ts
tech_stack:
  added: []
  patterns:
    - Phase 9 type extension pattern — add new optional fields to ClusterSizing as NodeSpec | null with virtStorageGB: number
    - Post-dispatch add-on pattern (established Phase 6) — calcVirt() will populate virtWorkerNodes in calcCluster() in P09-02
key_files:
  created: []
  modified:
    - src/engine/types.ts
    - src/engine/constants.ts
    - src/engine/defaults.ts
    - src/engine/calculators.ts
    - src/stores/calculationStore.ts
    - src/composables/useUrlState.ts
decisions:
  - AddOnConfig.vmCount is the explicit total VM count input from user — NOT derived from vmsPerWorker * workerNodes.count (circular dependency)
  - RecommendationConstraints.addOns.virt added alongside odf and rhacm for recommendation engine scoring in P09-03
  - useUrlState.ts AddOnConfigSchema extended with Phase 9 virt fields with correct defaults for URL state hydration
  - calculationStore.ts both recommend() call sites updated with virt: cluster.addOns.virtEnabled
metrics:
  duration: ~8 min
  completed: "2026-04-01"
  tasks_completed: 3
  files_changed: 6
---

# Phase 9 Plan 01: Type Extension + Constants Summary

Extended the engine's type contracts and constants to support OpenShift Virtualization — adding KubeVirt overhead constants, extending ClusterSizing/AddOnConfig/RecommendationConstraints interfaces, and updating all 7 topology calculator struct literals to compile cleanly.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Extend types.ts (ClusterSizing, AddOnConfig, RecommendationConstraints) | 5519a3c | src/engine/types.ts |
| 2 | Add KubeVirt constants to constants.ts | fda88cb | src/engine/constants.ts |
| 3 | Update defaults, fix all struct literals (calculators + downstream) | 08b1973 | src/engine/defaults.ts, calculators.ts, calculationStore.ts, useUrlState.ts |

## What Was Added

### src/engine/types.ts
- `ClusterSizing.virtWorkerNodes: NodeSpec | null` — dedicated VM-hosting worker pool
- `ClusterSizing.gpuNodes: NodeSpec | null` — Phase 10 GPU calculator placeholder
- `ClusterSizing.virtStorageGB: number` — estimated storage budget for VM PVCs
- `AddOnConfig.virtEnabled: boolean` — OpenShift Virtualization / CNV enabled flag
- `AddOnConfig.vmCount: number` — total VMs to host (default 50)
- `AddOnConfig.vmsPerWorker: number` — target VM density per worker (default 10)
- `AddOnConfig.virtAvgVmVcpu: number` — average vCPU per VM (default 4)
- `AddOnConfig.virtAvgVmRamGB: number` — average RAM per VM in GB (default 8)
- `AddOnConfig.snoVirtMode: boolean` — SNO-with-Virt profile flag (default false)
- `RecommendationConstraints.addOns.virt: boolean` — virt flag for recommendation engine

### src/engine/constants.ts
- `VIRT_OVERHEAD_CPU_PER_NODE = 2` — 2 vCPU reserved per virt-enabled worker node
- `VIRT_VM_OVERHEAD_BASE_MIB = 218` — base memory overhead per VM (MiB)
- `VIRT_VM_OVERHEAD_PER_VCPU_MIB = 8` — per-vCPU memory overhead (MiB)
- `VIRT_VM_OVERHEAD_GUEST_RAM_RATIO = 0.002` — 0.2% of guest RAM overhead
- `SNO_VIRT_MIN: NodeSpec = { count: 1, vcpu: 14, ramGB: 32, storageGB: 170 }` — SNO-with-Virt minimum profile
- `SNO_VIRT_STORAGE_EXTRA_GB = 50` — second disk for VM PVCs (hostpath-provisioner)

### src/engine/defaults.ts
- 6 new fields added to `createDefaultClusterConfig().addOns` — all Phase 9 virt fields with correct defaults

### src/engine/calculators.ts
- `emptySizing()` updated with `virtWorkerNodes: null, gpuNodes: null, virtStorageGB: 0`
- 6 topology calculator struct literals updated (calcStandardHA, calcCompact3Node, calcTNA, calcTNF, calcHCP, calcManagedCloud)
- SNO and MicroShift use `emptySizing()` — covered by the helper update

### src/stores/calculationStore.ts (deviation — Rule 2)
- Both `recommend()` call sites updated: `virt: cluster.addOns.virtEnabled` added to `addOns` object

### src/composables/useUrlState.ts (deviation — Rule 2)
- `AddOnConfigSchema` extended with all 6 Phase 9 virt fields and correct Zod defaults

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added virt: boolean to calculationStore.ts addOns objects**
- **Found during:** Task 3 verification (tsc --project tsconfig.app.json --noEmit)
- **Issue:** RecommendationConstraints.addOns.virt is now required; two `recommend()` call sites in calculationStore.ts were missing the field
- **Fix:** Added `virt: cluster.addOns.virtEnabled` to both addOns objects in clusterResults and recommendations computed properties
- **Files modified:** src/stores/calculationStore.ts
- **Commit:** 08b1973

**2. [Rule 2 - Missing Critical Functionality] Extended AddOnConfigSchema in useUrlState.ts**
- **Found during:** Task 3 verification (tsc --project tsconfig.app.json --noEmit)
- **Issue:** Zod schema in useUrlState.ts did not include the 6 new AddOnConfig fields — URL state hydration would silently drop virt fields or fail type checking
- **Fix:** Added all 6 Phase 9 virt fields to AddOnConfigSchema with correct Zod types and defaults
- **Files modified:** src/composables/useUrlState.ts
- **Commit:** 08b1973

### RTK Proxy Intercept (Non-deviation)
- The RTK proxy's filtered output caused initial `npx tsc --noEmit` to show no errors. Switching to `npx tsc --project tsconfig.app.json --noEmit` bypassed the proxy and revealed actual errors. All errors were resolved.

## TypeScript Status
- Pre-existing `src/main.ts` error (`TS2307: Cannot find module './App.vue'`) existed before this plan and is out of scope
- All errors caused by this plan's type changes are fully resolved
- `tsc --project tsconfig.app.json --noEmit` exits with only the pre-existing main.ts error

## Test Results
- 87 engine tests pass across 5 test files
- 0 test regressions introduced

## Known Stubs
None — all fields are properly typed and defaulted. No stubs exist that prevent plan goals from being achieved.

## Self-Check: PASSED
- src/engine/types.ts modified: FOUND
- src/engine/constants.ts modified: FOUND
- src/engine/defaults.ts modified: FOUND
- src/engine/calculators.ts modified: FOUND
- Commits 5519a3c, fda88cb, 08b1973: FOUND
- 87 tests passing: CONFIRMED
- 7x `virtWorkerNodes: null` in calculators.ts: CONFIRMED
- SNO_VIRT_MIN = 14 vCPU / 32 GB / 170 GB: CONFIRMED

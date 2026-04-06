---
phase: 02-sizing-engine
plan: "01"
subsystem: engine-types-constants
tags: [types, constants, test-stubs, foundation]
dependency_graph:
  requires: []
  provides: [engine-types, engine-constants, engine-defaults, engine-barrel, wave0-test-stubs]
  affects: [02-02, 02-03, 02-04, 02-05, 02-06]
tech_stack:
  added: []
  patterns: [barrel-export, readonly-constants, factory-defaults, test-stubs-wave0]
key_files:
  created:
    - src/engine/constants.ts
    - src/engine/index.ts
    - src/engine/formulas.test.ts
    - src/engine/calculators.test.ts
    - src/engine/addons.test.ts
    - src/engine/recommendation.test.ts
    - src/engine/validation.test.ts
  modified:
    - src/engine/types.ts
    - src/engine/defaults.ts
decisions:
  - "ClusterSizing.workerNodes typed as NodeSpec | null to model SNO/compact/MicroShift topologies where workers don't exist separately"
  - "CP_SAFETY_FACTOR (0.60) added as explicit constant alongside TARGET_UTILIZATION (0.70) — captures the two different utilization targets from hardware-sizing.md"
  - "SizingResult.sizing typed as ClusterSizing (not anonymous object) for downstream calculator return types"
metrics:
  duration: "~5 min"
  completed: "2026-03-31"
  tasks_completed: 2
  files_created: 7
  files_modified: 2
---

# Phase 02 Plan 01: Engine Types, Constants, and Wave-0 Test Stubs Summary

**One-liner:** Extended TypeScript types with 8 new engine interfaces, created centralized Red Hat hardware constants file, and seeded 5 Wave-0 test stub files (54 todo tests) for all Phase 2 modules.

## What Was Built

### Task 1: Types, Constants, Defaults, Barrel Index

**src/engine/types.ts** — Extended from 4 to 12 exported types/interfaces:

- Added `SnoProfile` union (`standard | edge | telecom-vdu`)
- Added `EnvironmentType` union (`datacenter | edge | far-edge | cloud`)
- Added `WorkloadProfile` interface (pods, CPU, RAM, node sizing inputs)
- Added `AddOnConfig` interface (ODF, infra nodes, RHACM toggles)
- Extended `ClusterConfig` with `snoProfile`, `hcpHostedClusters`, `hcpQpsPerCluster`, `workload`, `addOns`
- Added `ClusterSizing` interface with nullable node groups for sparse topologies
- Updated `SizingResult` to use `ClusterSizing` and `TopologyRecommendation[]`
- Added `RecommendationConstraints` and `TopologyRecommendation` interfaces

**src/engine/constants.ts** — New file with all Red Hat hardware minimums:

- CP/Worker minimums: `CP_MIN`, `WORKER_MIN`
- SNO profiles: `SNO_STD_MIN`, `SNO_EDGE_MIN`, `SNO_TELECOM_MIN`
- TNA: `TNA_CP_MIN`, `TNA_ARBITER_MIN`
- TNF: `TNF_CP_MIN`
- HCP scalars: `HCP_PODS_PER_CP`, `HCP_CPU_PER_CP_IDLE`, `HCP_RAM_PER_CP_IDLE`, `HCP_CPU_PER_1000_QPS`, `HCP_RAM_PER_1000_QPS`
- MicroShift: `MICROSHIFT_SYS_MIN`
- ODF: `ODF_MIN_CPU_PER_NODE`, `ODF_MIN_RAM_PER_NODE_GB`, `ODF_MIN_NODES`, `ODF_CPU_PER_OSD`, `ODF_RAM_PER_OSD_GB`
- Lookup tables: `CP_SIZING_TABLE` (4 rows), `INFRA_SIZING_TABLE` (3 rows) — both `as const`
- Global targets: `TARGET_UTILIZATION` (0.70), `MAX_PODS_PER_NODE` (200), `CP_SAFETY_FACTOR` (0.60)

**src/engine/defaults.ts** — Updated `createDefaultClusterConfig` to return complete `ClusterConfig` with workload and addOns defaults.

**src/engine/index.ts** — Barrel export for public engine API (types, constants, defaults factory).

### Task 2: Wave-0 Test Stubs

5 test stub files created with 54 total `it.todo()` stubs covering all Phase 2 requirements:

- `formulas.test.ts`: 19 stubs — cpSizing, allocatableRamGB, workerCount, infraNodeSizing
- `calculators.test.ts`: 20 stubs — all 8 topology calculators
- `addons.test.ts`: 8 stubs — calcODF, calcInfraNodes, calcRHACM
- `recommendation.test.ts`: 6 stubs — recommend engine
- `validation.test.ts`: 1 stub — ENG-09 zero-Vue-import constraint

## Verification Results

- `npx tsc --noEmit` — exits 0 (TypeScript compiles cleanly)
- `npx vitest run` — exits 0, PASS (11) FAIL (0)
- `grep -r "from 'vue'" src/engine/` — returns empty (zero Vue imports)
- `grep -c "export" src/engine/types.ts` — 12 exports (>= 10 required)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

All 5 test files contain `it.todo()` stubs by design — these are intentional Wave-0 scaffolding, not unintentional placeholders. Each subsequent Phase 2 plan (02-02 through 02-06) will implement the actual test bodies and production code. The stubs will be converted to real tests as each module is built.

## Self-Check: PASSED

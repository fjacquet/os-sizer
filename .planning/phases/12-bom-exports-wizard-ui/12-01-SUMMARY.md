---
phase: 12-bom-exports-wizard-ui
plan: 01
subsystem: engine-types + i18n
tags: [types, addons, i18n, rhoai, virt, gpu]
dependency_graph:
  requires: []
  provides: [ClusterSizing.rhoaiOverhead, i18n-phase12-keys]
  affects: [BomTable, export-plans, validation.ts, recommendation.ts]
tech_stack:
  added: []
  patterns: [mutation-in-place, null-sentinel-for-absent-value, TDD-red-green]
key_files:
  created: []
  modified:
    - src/engine/types.ts
    - src/engine/addons.ts
    - src/engine/calculators.ts
    - src/engine/addons.test.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
decisions:
  - rhoaiOverhead is required (not optional) on ClusterSizing — null sentinel forces all topology literals to explicitly acknowledge the field
  - calcRHOAI always sets rhoaiOverhead to RHOAI_INFRA_OVERHEAD constants when called — same values regardless of infra vs worker path, represents the addend amount
  - German locale continues to use umlauts (ä, ö, ü) only — no eszett (per Phase 05 decision)
  - French locale uses nœuds ligature for node-related terms (per Phase 05 decision)
metrics:
  duration: ~10 min
  completed: "2026-04-01"
  tasks: 2
  files: 8
---

# Phase 12 Plan 01: rhoaiOverhead type + calcRHOAI update + i18n keys Summary

**One-liner:** Required `rhoaiOverhead: { vcpu: number; ramGB: number } | null` field added to `ClusterSizing` with `calcRHOAI()` mutation + all 5 deferred and 26 new Phase 12 i18n keys landed in all 4 locales.

## What Was Built

### Task 1: rhoaiOverhead field on ClusterSizing + calcRHOAI update (TDD)

Added `rhoaiOverhead: { vcpu: number; ramGB: number } | null` as a **required** (non-optional) field to `ClusterSizing` in `src/engine/types.ts`. This is the data contract that Phase 12 Wave 3 BomTable and export plans depend on.

Updated `calcRHOAI()` in `src/engine/addons.ts` to always set `sizing.rhoaiOverhead = { vcpu: RHOAI_INFRA_OVERHEAD_VCPU, ramGB: RHOAI_INFRA_OVERHEAD_RAM_GB }` at the end of the function. The field records the overhead addend amounts for BoM display — the same constants apply regardless of whether the overhead landed on infra nodes or worker nodes.

Updated `emptySizing()` and all 6 explicit `ClusterSizing` object literals in `src/engine/calculators.ts` to include `rhoaiOverhead: null`. This prevents TypeScript compile errors since the field is required.

Updated all 8 inline `ClusterSizing` fixtures in `src/engine/addons.test.ts` to include `rhoaiOverhead: null`. Added 2 new TDD tests verifying `rhoaiOverhead` is correctly set for both the infra and worker-only paths.

### Task 2: All Phase 12 i18n keys in EN/FR/DE/IT

Added 31 keys across all 4 locale files:

**Group A — 5 pre-existing deferred keys** (referenced in validation.ts + recommendation.ts since Phases 9-11, now preventing runtime key-string rendering):
- `warnings.virt.rwxRequiresOdf` — RWX/ODF requirement for live migration
- `warnings.sno.virtNoLiveMigration` — SNO+Virt live migration unavailability
- `warnings.gpu.passthroughBlocksLiveMigration` — GPU passthrough blocks live migration
- `warnings.gpu.migProfileWithKubevirtUnsupported` — MIG+KubeVirt incompatibility
- `recommendation.standardHa.virtWorkloads` — Standard HA recommendation for VM workloads

**Group B — 26 new Phase 12 UI keys**:
- `node.virtWorkers`, `node.gpu`, `node.rhoaiOverhead`
- `workload.rhoaiAddon`, `workload.gpuNodePool`, `workload.gpuNodeCount`, `workload.gpuMode`, `workload.gpuModel`, `workload.migProfile`, `workload.vmCount`, `workload.vmsPerWorker`, `workload.virtAvgVmVcpu`, `workload.virtAvgVmRamGB`, `workload.virtAddon`
- `gpu.*` (6 keys: modeContainer, modePassthrough, modeVgpu, migNone, densityTableTitle, densityNote)
- `rhoai.*` (5 keys: label, bomRow, kserve, dsPipelines, modelRegistry)
- `sno.virtMode`

## Decisions Made

1. **rhoaiOverhead required, not optional** — Using `| null` type (not `?:`) forces all topology calculator struct literals to explicitly acknowledge the field. TypeScript enforces completeness at compile time.
2. **rhoaiOverhead stores the addend constants** — Not the cumulative node totals, just the overhead contribution amount. BomTable consumers display this as a line item showing what RHOAI adds.
3. **German locale: umlauts only** — Continued Phase 05 rule: no eszett (ß), all instances use ss or umlauts where appropriate.
4. **French nœuds ligature** — Applied consistently for node-related terms per Phase 05 decision.

## Deviations from Plan

None — plan executed exactly as written. TDD RED/GREEN cycle completed for Task 1 (2 new tests added). All 239 tests pass after both tasks.

## Verification

- `tsc --noEmit` exits 0 (both before and after all changes)
- 239 tests pass (237 original + 2 new rhoaiOverhead tests)
- `grep rhoaiOverhead` finds hits in types.ts, addons.ts, calculators.ts, addons.test.ts
- `grep rwxRequiresOdf` finds 1 hit in each of the 4 locale files
- `grep virtWorkloads` finds 1 hit in each of the 4 locale files

## Self-Check: PASSED

Files verified:
- /Users/fjacquet/Projects/os-sizer/src/engine/types.ts — contains rhoaiOverhead
- /Users/fjacquet/Projects/os-sizer/src/engine/addons.ts — contains rhoaiOverhead assignment
- /Users/fjacquet/Projects/os-sizer/src/engine/calculators.ts — all literals updated
- /Users/fjacquet/Projects/os-sizer/src/i18n/locales/en.json — all keys present
- /Users/fjacquet/Projects/os-sizer/src/i18n/locales/fr.json — all keys present
- /Users/fjacquet/Projects/os-sizer/src/i18n/locales/de.json — all keys present
- /Users/fjacquet/Projects/os-sizer/src/i18n/locales/it.json — all keys present

Commits verified:
- ffcc83d — feat(12-01): add rhoaiOverhead to ClusterSizing + update calcRHOAI()
- 1f517c6 — feat(12-01): add all Phase 12 i18n keys to EN/FR/DE/IT locale files

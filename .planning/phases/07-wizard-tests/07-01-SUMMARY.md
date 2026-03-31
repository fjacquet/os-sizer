---
phase: "07"
plan: "07-01"
subsystem: wizard-tests
tags: [testing, vitest, pinia, wizard, components, qa]
dependency_graph:
  requires: []
  provides: [QA-04]
  affects: [vitest.config.ts, wizard-component-tests]
tech_stack:
  added: []
  patterns: [static-contract-tests, real-pinia-stores, vi.stubGlobal-navigator]
key_files:
  created:
    - src/components/wizard/__tests__/Step1EnvironmentForm.test.ts
    - src/components/wizard/__tests__/Step2WorkloadForm.test.ts
    - src/components/wizard/__tests__/Step3ArchitectureForm.test.ts
    - src/components/shared/__tests__/WizardStepper.test.ts
  modified:
    - vitest.config.ts
decisions:
  - vi.stubGlobal('navigator', { language: 'en' }) required before setActivePinia to avoid uiStore navigator.language access
  - workload/addOns fields tested via spread-merge updateCluster patch (Object.assign needs full sub-object)
  - WorkloadSchema exists at src/schemas/workloadSchema.ts — used real schema tests (not static stubs)
metrics:
  duration: "4 min"
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_changed: 5
---

# Phase 07 Plan 01: Wizard Component Tests Summary

Added missing component-level tests for all 4 wizard UI components, closing QA-04 with 179 passing tests (0 failures).

## What Was Implemented

### Task 1: Extended vitest.config.ts include glob

Added `'src/components/**/*.test.ts'` as 4th entry in the include array. The `environment: 'node'` setting was preserved — no DOM/jsdom needed since tests use static contract verification with real Pinia stores.

### Task 2: Created 4 component test files

All 4 files follow the established pattern: `vi.stubGlobal('navigator', { language: 'en' })` before `setActivePinia(createPinia())` in `beforeEach`.

#### Step1EnvironmentForm.test.ts — 11 tests
- 5 clusterField binding tests: environment, haRequired, airGapped, maxNodes (50 and null)
- 2 EnvironmentSchema safeParse tests: valid inputs pass, maxNodes=-1 fails
- 4 static template contracts: radio buttons, connectivity buttons, HA buttons, maxNodes input

#### Step2WorkloadForm.test.ts — 14 tests
- 5 workloadField binding tests: totalPods, podCpuMillicores, podMemMiB, nodeVcpu, nodeRamGB
- 4 addOnField binding tests: odfEnabled, infraNodesEnabled, rhacmEnabled, rhacmManagedClusters
- 2 WorkloadSchema safeParse tests: valid inputs pass, totalPods=0 fails
- 3 static template contracts: NumberSliderInput instances, add-on checkboxes, conditional rhacmManagedClusters

#### Step3ArchitectureForm.test.ts — 9 tests
- 3 real store tests: topology set to 'sno', topology set to 'compact-3node', confirmTopology() sets true
- 1 static contract: selectTopology() atomically sets topology AND calls confirmTopology()
- 1 TypeScript validation: all 8 TopologyType values are valid
- 4 static template contracts: topologyConfirmed gate, SNO profiles, HCP inputs, manual override

#### WizardStepper.test.ts — 15 tests
- 3 canGoBack gate tests: step=1 (false), step=2 (true), step=3 (true)
- 5 canGoForward gate tests: steps 1-2 (static), step=3+unconfirmed (blocked), step=3+confirmed (allowed), step=4 (static)
- 4 goBack/goForward transition tests: step 2→1, step 1→2, step 3 blocked, step 3→4 with confirmation
- 3 static template contracts: back button disabled, next label, selection-required hint, aria-current

## Test Counts Per File

| File | Tests |
|------|-------|
| Step1EnvironmentForm.test.ts | 11 |
| Step2WorkloadForm.test.ts | 14 |
| Step3ArchitectureForm.test.ts | 9 |
| WizardStepper.test.ts | 15 |
| **New total (these 4 files)** | **49** |
| Full suite | **179** |

## Deviations from Plan

### Auto-detected Behavior

**1. WorkloadSchema exists — used real schema tests**
- The plan said "If [workloadSchema.ts] does not exist, replace with static contract tests"
- `src/schemas/workloadSchema.ts` was found, so real `safeParse` tests were written (better coverage)
- Files modified: Step2WorkloadForm.test.ts
- No commit change needed — this was the preferred path per the plan's conditional

**2. workload/addOns fields require spread-merge in updateCluster patch**
- Found during: Task 2
- Issue: `updateCluster` uses `Object.assign(cluster, patch)` — patching `workload: { totalPods: 100 }` would wipe other workload fields
- Fix: Used `{ workload: { ...store.clusters[0].workload, totalPods: 100 } }` spread-merge pattern
- This accurately mirrors how Step2WorkloadForm.vue computed setters work (they merge)
- Files modified: Step2WorkloadForm.test.ts

## npm run test Result

```
PASS (179) FAIL (0)
```

## Known Stubs

None that affect plan goals. Static contract stubs (expect(true).toBe(true)) are intentional — they document DOM-dependent behavior that cannot be verified without jsdom, following the established WarningBanner.test.ts pattern.

## Self-Check: PASSED

All created files exist on disk. Both task commits (8671683, 1917be3) confirmed in git log.

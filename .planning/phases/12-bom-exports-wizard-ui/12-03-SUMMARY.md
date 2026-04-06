---
phase: 12-bom-exports-wizard-ui
plan: 03
subsystem: wizard-ui
tags: [vue, wizard, virt, sno, addons, step3]
dependency_graph:
  requires: [12-01]
  provides: [Step3-virt-sub-inputs, Step3-snoVirtMode-toggle]
  affects: [Step3ArchitectureForm.vue, engine/addons.ts calcVirt via addOnField bindings]
tech_stack:
  added: []
  patterns: [addOnField-spread-merge, conditional-rendering-v-if, v-model-computed-setter]
key_files:
  created: []
  modified:
    - src/components/wizard/Step3ArchitectureForm.vue
decisions:
  - addOnField uses spread-merge pattern (identical to Step2) — prevents sibling addOns fields from being wiped on update
  - virt sub-inputs conditioned on virtEnabled AND (standard-ha OR compact-3node) — excludes SNO/HCP/edge topologies where virt sizing is handled differently
  - snoVirtMode checkbox placed inside SNO profile block — it is a SNO-specific override, not a general virt setting
  - No new TopologyType values — OpenShift Virtualization remains an add-on overlay, not a topology
metrics:
  duration: ~5 min
  completed: "2026-04-01"
  tasks: 1
  files: 1
---

# Phase 12 Plan 03: Step3 Wizard UI (Virt topology + VM inputs + SNO-virt) Summary

**One-liner:** `addOnField()` helper + 4 virt VM sizing sliders (vmCount/vmsPerWorker/virtAvgVmVcpu/virtAvgVmRamGB) and snoVirtMode checkbox added to `Step3ArchitectureForm.vue` using i18n keys from 12-01.

## What Was Built

### Task 1: Add addOnField helper and virt/SNO sub-inputs to Step3

Added `addOnField()` computed helper to `Step3ArchitectureForm.vue` (identical spread-merge pattern used in Step2 — prevents sibling `addOns` fields from being wiped on partial updates).

Added 6 new `addOnField` refs: `virtEnabled` (read-only gate), `vmCount`, `vmsPerWorker`, `virtAvgVmVcpu`, `virtAvgVmRamGB`, `snoVirtMode`.

Added two new conditional template blocks inside the `v-if="ui.topologyConfirmed"` section:

1. **Virt VM sizing sub-inputs** (`v-if="virtEnabled && (topology === 'standard-ha' || topology === 'compact-3node')"`) — a 2-column grid of 4 `NumberSliderInput` components (vmCount 1-5000 step 10, vmsPerWorker 1-50 step 1, virtAvgVmVcpu 1-32 with unit "vCPU", virtAvgVmRamGB 1-256 with unit "GB"). Section header uses `t('workload.virtAddon')`. All use `:model-value` / `@update:model-value` pattern with explicit type annotations. Satisfies VIRT-01 and VIRT-03.

2. **SNO-with-Virt mode toggle** — checkbox placed inside the existing SNO profile selector block (below the profile button group). Uses `:checked` binding with `@change` handler. Label reads `t('sno.virtMode')`. Provides the UI entry point for the SNO-01 engine path already implemented in Phase 9.

No changes to `topologyLabelMap`, `allTopologies`, or any `TopologyType` enum values — virt remains an add-on overlay.

## Decisions Made

1. **addOnField spread-merge pattern** — `{ addOns: { ...c.addOns, [key]: val } }` prevents unrelated addOns fields (rhoaiEnabled, gpuEnabled, etc.) from being cleared when one field is written. Same pattern as Step2.
2. **Virt sub-inputs on standard-ha + compact-3node only** — SNO topology uses `snoVirtMode` (a profile override) rather than VM sizing sliders; HCP and edge topologies don't support KubeVirt worker sizing the same way.
3. **snoVirtMode inside SNO block** — The checkbox is semantically part of SNO configuration (not a general virt setting), so placing it directly below the profile buttons provides natural grouping.
4. **No TopologyType additions** — Per architectural constraint, OpenShift Virtualization is an add-on, not a topology variant. The `allTopologies` array and `topologyLabelMap` remain unchanged.

## Deviations from Plan

None — plan executed exactly as written. All 239 tests pass. `tsc --noEmit` exits 0.

## Verification

- `tsc --noEmit` exits 0
- 239 tests pass (no change from 12-01 baseline)
- `grep addOnField src/components/wizard/Step3ArchitectureForm.vue` returns 7 hits
- `grep "virtEnabled|snoVirtMode"` returns 5 hits
- `grep "vmCount|vmsPerWorker"` returns 8 hits
- No new TopologyType enum values added

## Self-Check: PASSED

Files verified:
- /Users/fjacquet/Projects/os-sizer/src/components/wizard/Step3ArchitectureForm.vue — contains addOnField, virtEnabled, snoVirtMode, vmCount, vmsPerWorker, virtAvgVmVcpu, virtAvgVmRamGB

Commits verified:
- e9136a4 — feat(12-03): add addOnField helper + virt sub-inputs + snoVirtMode to Step3

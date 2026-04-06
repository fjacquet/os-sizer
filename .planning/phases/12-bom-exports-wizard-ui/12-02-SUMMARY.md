---
phase: 12-bom-exports-wizard-ui
plan: "02"
subsystem: wizard-ui
tags: [vue, wizard, gpu, virt, rhoai, addons, i18n]
dependency_graph:
  requires: [12-01]
  provides: [Step2-virt-toggle, Step2-gpu-toggle, Step2-rhoai-toggle, Step2-gpu-subinputs]
  affects: [Step2WorkloadForm.vue]
tech_stack:
  added: []
  patterns: [addOnField-computed-spread, MIG_PROFILES-cascade-select, v-if-subinput-reveal]
key_files:
  modified:
    - src/components/wizard/Step2WorkloadForm.vue
decisions:
  - "availableMigProfiles computed uses MIG_PROFILES[gpuModel] key lookup — cascade select drives options from model selection"
  - "Passthrough warning uses warnings.gpu.passthroughBlocksLiveMigration i18n key already defined in 12-01"
  - "vGPU density table iterates MIG_PROFILES directly (static reference data) — not filtered by gpuModel since table shows all models for comparison"
  - "Attribute-order lint warnings in Step2/Step3 are pre-existing, not introduced by this plan"
metrics:
  duration: 8 min
  completed: "2026-04-01"
  tasks: 1
  files: 1
---

# Phase 12 Plan 02: Step2 Wizard UI (Virt/GPU/RHOAI toggles) Summary

Adds OpenShift Virtualization, GPU Node Pool, and RHOAI add-on toggles plus full GPU configuration sub-inputs to Step2WorkloadForm.vue.

## What Was Built

Three new add-on sections appended after the existing RHACM managed-clusters block in the add-ons `<div class="space-y-2">` container:

1. **Virt toggle (VIRT-01):** `virtEnabled` checkbox — simple checkbox with `addOnField('virtEnabled')` following ODF/RHACM pattern exactly.

2. **GPU Node Pool (GPU-01..05):** `gpuEnabled` checkbox that reveals a sub-input block when checked:
   - `gpuNodeCount` NumberSliderInput (1-32)
   - `gpuMode` select (container / passthrough / vgpu) with i18n labels
   - `gpuModel` select (A100-40GB / A100-80GB / H100-80GB)
   - `migProfile` cascade select driven by `availableMigProfiles` computed (keys from `MIG_PROFILES[gpuModel]`)
   - Passthrough live-migration inline warning (amber alert, `v-if="gpuMode === 'passthrough'"`)
   - vGPU density reference table (all three GPU models, `v-if="gpuMode === 'vgpu'"`) with disclaimer note

3. **RHOAI toggle (RHOAI-01):** `rhoaiEnabled` checkbox — simple checkbox.

All seven new composable refs use `addOnField()` which applies the spread-merge pattern internally — sibling addOns fields are never wiped.

## Task Summary

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Virt, GPU, RHOAI toggles + GPU sub-inputs | 4af6111 | src/components/wizard/Step2WorkloadForm.vue |

## Verification Results

- `npx tsc --noEmit` exits 0
- `npx vitest run` passes (239 tests, 0 failures)
- `addOnField` count: 12 (function def + 4 original + 7 new) — exceeds minimum 10
- `virtEnabled`, `gpuEnabled`, `rhoaiEnabled` present in 15 lines
- `MIG_PROFILES` imported and used in 4 locations

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all inputs are wired to real store fields via `addOnField()`. The vGPU density table displays static reference data from `MIG_PROFILES` (intentional, plan-specified behavior for GPU-05).

## Self-Check: PASSED

- File exists: src/components/wizard/Step2WorkloadForm.vue — FOUND
- Commit 4af6111 — FOUND (git log confirms)

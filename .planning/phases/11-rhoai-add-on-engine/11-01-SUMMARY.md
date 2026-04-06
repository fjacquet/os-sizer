---
phase: 11-rhoai-add-on-engine
plan: "01"
subsystem: engine/types
tags: [rhoai, types, constants, url-state, zod]
dependency_graph:
  requires: [phase-10-gpu-node-engine]
  provides: [RHOAI-02, RHOAI-03]
  affects: [11-02-rhoai-calculator, 11-03-rhoai-tests-validation]
tech_stack:
  added: []
  patterns: [post-dispatch-addon, zod-default-backward-compat]
key_files:
  created: []
  modified:
    - src/engine/types.ts
    - src/engine/constants.ts
    - src/engine/defaults.ts
    - src/composables/useUrlState.ts
decisions:
  - "rhoaiEnabled typed as boolean (not union) — only on/off semantics needed for Phase 11"
  - "RHOAI_INFRA_OVERHEAD_VCPU/RAM_GB annotated MEDIUM confidence — no official Red Hat aggregate table exists; community estimate from ai-on-openshift.io"
  - "RHOAI_WORKER_MIN_VCPU/RAM_GB annotated HIGH confidence — confirmed across RHOAI 2.25, 3.0, 3.3, and Cloud Service 1.x"
  - "AddOnConfigSchema uses .default(false) for rhoaiEnabled — backward-compatible with Phase 10 and v1.0 shared URLs"
metrics:
  duration: "~5 min"
  completed_date: "2026-04-01"
  tasks: 2
  files_modified: 4
---

# Phase 11 Plan 01: Type Extension + RHOAI Constants Summary

Extend the type layer and URL-state schema with `rhoaiEnabled` flag and define four RHOAI sizing constants (worker floor + infra overhead) as the typed contracts for Phase 11-02 calculator work.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add rhoaiEnabled to AddOnConfig, defaults, Zod schema | ad22e33 | types.ts, defaults.ts, useUrlState.ts |
| 2 | Add four RHOAI constants to constants.ts | 5c99904 | constants.ts |

## What Was Built

**Task 1 — Type layer + URL-state:**
- `AddOnConfig.rhoaiEnabled: boolean` added after Phase 10 gpuPerNode field (types.ts)
- `createDefaultClusterConfig()` addOns block includes `rhoaiEnabled: false` (defaults.ts)
- `AddOnConfigSchema` extended with `rhoaiEnabled: z.boolean().default(false)` (useUrlState.ts)
- Backward-compatible: Zod `.strip()` drops unknown fields; `.default(false)` fills missing fields — v1.0 and Phase 10 URLs parse without error

**Task 2 — RHOAI constants:**
- `RHOAI_WORKER_MIN_VCPU = 8` — per-node worker floor, HIGH confidence (RHOAI 3.x install docs)
- `RHOAI_WORKER_MIN_RAM_GB = 32` — per-node worker floor, HIGH confidence (RHOAI 3.x install docs)
- `RHOAI_INFRA_OVERHEAD_VCPU = 4` — operator component overhead, MEDIUM confidence (community estimate)
- `RHOAI_INFRA_OVERHEAD_RAM_GB = 16` — operator component overhead, MEDIUM confidence (community estimate)
- Source comments and confidence annotations mandatory per plan spec

## Verification

- `tsc --noEmit`: exit 0 after both tasks (zero type errors)
- `npm test`: 221 tests pass, 0 failures, 0 regressions
- Pre-commit lint: 8 pre-existing attribute-order warnings in Vue files (out of scope, not introduced by this plan)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan adds type contracts and constants only. No UI rendering or data flow was modified.

## Self-Check: PASSED

Files exist:
- src/engine/types.ts — contains `rhoaiEnabled: boolean`
- src/engine/constants.ts — contains all four RHOAI_* constants
- src/engine/defaults.ts — contains `rhoaiEnabled: false`
- src/composables/useUrlState.ts — contains `rhoaiEnabled: z.boolean().default(false)`

Commits exist:
- ad22e33 — Task 1
- 5c99904 — Task 2

---
phase: 10-gpu-node-engine
plan: "01"
subsystem: engine/types
tags: [types, constants, gpu, mig, url-state]
dependency_graph:
  requires: [Phase 9 — gpuNodes: NodeSpec | null already in ClusterSizing]
  provides: [AddOnConfig GPU fields, MIG_PROFILES lookup, GPU_NODE_MIN_* constants, GPU URL state round-trip]
  affects: [src/engine/types.ts, src/engine/constants.ts, src/engine/defaults.ts, src/composables/useUrlState.ts]
tech_stack:
  added: []
  patterns: [as-const union narrowing, Zod enum for union types, Zod string for runtime-validated string fields]
key_files:
  created: []
  modified:
    - src/engine/types.ts
    - src/engine/constants.ts
    - src/engine/defaults.ts
    - src/composables/useUrlState.ts
decisions:
  - migProfile typed as string (not union) — valid values differ per GPU model; MIG_PROFILES table validates at runtime
  - gpuNodeCount and gpuPerNode use min(1) in Zod — a GPU pool with zero nodes is meaningless; gpuEnabled:false disables the pool
  - gpuMode and gpuModel use as const in defaults.ts to satisfy TypeScript union narrowing
  - MIG_PROFILES typed as Readonly<Record<string, Readonly<Record<string, number>>>> for immutability without losing index access
metrics:
  duration: ~5 min
  completed: "2026-04-01"
  tasks_completed: 2
  files_modified: 4
---

# Phase 10 Plan 01: Type Extension + GPU Constants Summary

Six GPU fields added to AddOnConfig, MIG_PROFILES lookup table and GPU_NODE_MIN_* constants exported, defaults and URL state schema extended — all with zero TypeScript errors and 204 passing tests.

## What Was Built

- `AddOnConfig` interface in `types.ts` extended with 6 GPU fields: `gpuEnabled`, `gpuNodeCount`, `gpuMode`, `gpuModel`, `migProfile`, `gpuPerNode`
- `MIG_PROFILES` constant in `constants.ts`: immutable lookup table with 4 MIG profiles each for A100-40GB, A100-80GB, and H100-80GB
- `GPU_NODE_MIN_VCPU=16`, `GPU_NODE_MIN_RAM_GB=64`, `GPU_NODE_MIN_STORAGE_GB=200` exported from `constants.ts`
- `createDefaultClusterConfig()` in `defaults.ts` populated with all 6 GPU fields at safe defaults
- `AddOnConfigSchema` in `useUrlState.ts` extended with Zod validators for all 6 GPU fields — URL state round-trips all GPU fields

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend AddOnConfig + GPU constants | 35e45d9 | src/engine/types.ts, src/engine/constants.ts |
| 2 | Update defaults + URL state schema | 8fc34b5 | src/engine/defaults.ts, src/composables/useUrlState.ts |

## Decisions Made

1. `migProfile` is typed as `string` in both `AddOnConfig` and the Zod schema — valid profile names differ per GPU model (A100-40GB uses `1g.5gb`…`7g.40gb`; A100-80GB/H100-80GB use `1g.10gb`…`7g.80gb`). Runtime validation against `MIG_PROFILES[gpuModel]` will occur in the calculator (Plan 10-02), not at the type layer.

2. `gpuNodeCount` and `gpuPerNode` use `.min(1)` in the Zod schema — a GPU pool with zero nodes or zero GPUs per node is nonsensical. Setting `gpuEnabled: false` disables the pool; the count fields must remain meaningful when enabled.

3. `gpuMode` and `gpuModel` require `as const` assertions in `defaults.ts` — TypeScript narrows string literals to their union type only with `as const`; without it, `'container'` would widen to `string` and fail the `AddOnConfig` type check.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan adds type definitions and constants only. No UI components or data flows were created.

## Self-Check: PASSED

- `src/engine/types.ts` exists and contains `gpuEnabled`
- `src/engine/constants.ts` exists and contains `MIG_PROFILES`
- `src/engine/defaults.ts` exists and contains `gpuEnabled: false`
- `src/composables/useUrlState.ts` exists and contains `gpuEnabled: z.boolean`
- Commit `35e45d9` exists (Task 1)
- Commit `8fc34b5` exists (Task 2)
- `tsc --noEmit`: TYPE CHECK OK
- `vitest run`: PASS (204) FAIL (0)
